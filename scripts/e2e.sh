#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

X_USER_ID="${X_USER_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"
SELF_ID="${SELF_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"
RIDER_EMAIL="${RIDER_EMAIL:-alice+${X_USER_ID}@example.com}"
DRIVER_EMAIL="${DRIVER_EMAIL:-bob+${SELF_ID}@example.com}"
RIDER_TOKEN=""
DRIVER_TOKEN=""
MOBILITY_DB_PASSWORD="${MOBILITY_DB_PASSWORD:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"
JWT_SECRET="${JWT_SECRET:-$(uuidgen | tr '[:upper:]' '[:lower:]')-$(uuidgen | tr '[:upper:]' '[:lower:]')}"

export MOBILITY_DB_PASSWORD
export JWT_SECRET

HTTP_STATUS=""
HTTP_BODY_FILE=""
LAST_BODY=""

cleanup() {
  local exit_code=$?
  trap - EXIT

  printf '[14/14] docker compose down -v... '
  if docker compose down -v; then
    echo "OK"
  else
    echo "FAIL"
    exit_code=1
  fi

  exit "$exit_code"
}
trap cleanup EXIT

fail_http_step() {
  local step="$1"
  local expected="$2"
  local got_status="$3"
  local body="$4"
  echo "FAIL"
  echo "  unexpected status/body for step ${step}"
  echo "  expected: ${expected}"
  echo "  got status: ${got_status}"
  echo "  got body: ${body}"
  exit 1
}

assert_jq() {
  local step="$1"
  local expr="$2"
  local body="$3"
  if ! jq -e "$expr" >/dev/null <<<"$body"; then
    echo "FAIL"
    echo "  jq assertion failed for step ${step}: ${expr}"
    echo "  body: ${body}"
    exit 1
  fi
}

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  shift 3 || true

  HTTP_BODY_FILE="$(mktemp)"
  local -a args
  args=(-sS -o "$HTTP_BODY_FILE" -w "%{http_code}" -X "$method" "$url")
  while (($#)); do
    args+=(-H "$1")
    shift
  done
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi

  HTTP_STATUS="$(curl "${args[@]}")"
  LAST_BODY="$(<"$HTTP_BODY_FILE")"
  rm -f "$HTTP_BODY_FILE"
  HTTP_BODY_FILE=""
}

wait_for_service_healthy() {
  local service="$1"
  local deadline=$((SECONDS + 120))

  while ((SECONDS < deadline)); do
    local container_id
    container_id="$(docker compose ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      local status
      status="$(
        docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
          "$container_id" 2>/dev/null || true
      )"
      if [[ "$status" == "healthy" ]]; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

wait_for_stack_healthy() {
  local services=(
    "mailpit"
    "postgres-rider"
    "postgres-driver"
    "postgres-payments"
    "payments"
    "driver"
    "rider"
  )

  local service
  for service in "${services[@]}"; do
    if ! wait_for_service_healthy "$service"; then
      return 1
    fi
  done

  local deadline=$((SECONDS + 30))
  while ((SECONDS < deadline)); do
    if curl -fsS "http://localhost:8081/health" >/dev/null \
      && curl -fsS "http://localhost:8080/health" >/dev/null \
      && curl -fsS "http://localhost:3000/health" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

printf '[1/14] docker compose up -d --build... '
if docker compose up -d --build; then
  echo "OK"
else
  echo "FAIL"
  exit 1
fi

printf '[2/14] postgres + services become healthy within 120s... '
if wait_for_stack_healthy; then
  echo "OK"
else
  echo "FAIL"
  docker compose ps || true
  exit 1
fi

# Obtain auth-stub tokens for deterministic e2e auth.
request_json "POST" "http://localhost:3000/auth/dev/token" \
  "{\"subject\":\"${X_USER_ID}\",\"email\":\"${RIDER_EMAIL}\",\"name\":\"Alice\"}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "2-auth-rider" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "2-auth-rider" '.accessToken|type=="string"' "$LAST_BODY"
RIDER_TOKEN="$(jq -r '.accessToken' <<<"$LAST_BODY")"

request_json "POST" "http://localhost:8080/auth/dev/token" \
  "{\"subject\":\"${SELF_ID}\",\"email\":\"${DRIVER_EMAIL}\",\"name\":\"Bob\"}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "2-auth-driver" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "2-auth-driver" '.token|type=="string"' "$LAST_BODY"
DRIVER_TOKEN="$(jq -r '.token' <<<"$LAST_BODY")"

printf '[3/14] create rider (201, capture riderId)... '
request_json "POST" "http://localhost:3000/riders" \
  "{\"name\":\"Alice\",\"email\":\"${RIDER_EMAIL}\"}" \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "201" ]]; then
  fail_http_step "3" "201" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "3" '.id|type=="string"' "$LAST_BODY"
assert_jq "3" '.name=="Alice"' "$LAST_BODY"
assert_jq "3" ".email==\"${RIDER_EMAIL}\"" "$LAST_BODY"
assert_jq "3" '(.balance|tonumber)==1000' "$LAST_BODY"
RIDER_ID="$(jq -r '.id' <<<"$LAST_BODY")"
echo "OK"

printf '[4/14] create driver (201, capture driverId)... '
request_json "POST" "http://localhost:8080/drivers" \
  "{\"name\":\"Bob\",\"email\":\"${DRIVER_EMAIL}\"}" \
  "Authorization: Bearer ${DRIVER_TOKEN}"
if [[ "$HTTP_STATUS" != "201" ]]; then
  fail_http_step "4" "201" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "4" '.id|type=="string"' "$LAST_BODY"
assert_jq "4" '.name=="Bob"' "$LAST_BODY"
assert_jq "4" ".email==\"${DRIVER_EMAIL}\"" "$LAST_BODY"
assert_jq "4" '(.balance|tonumber)==100' "$LAST_BODY"
DRIVER_ID="$(jq -r '.id' <<<"$LAST_BODY")"
echo "OK"

printf '[5/14] rider deposit then rider balance=1500... '
request_json "POST" "http://localhost:3000/riders/${RIDER_ID}/deposit" \
  '{"amount":500}' \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "5a" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
request_json "GET" "http://localhost:3000/riders/${RIDER_ID}" "" \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "5b" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "5" '(.balance|tonumber)==1500' "$LAST_BODY"
echo "OK"

printf '[6/14] rider pay driver, code format, rider balance=1300... '
request_json "POST" "http://localhost:3000/riders/${RIDER_ID}/pay" \
  "{\"driverId\":\"${DRIVER_ID}\",\"amount\":200}" \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "201" ]]; then
  fail_http_step "6a" "201" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "6a" '.transactionId|type=="string"' "$LAST_BODY"
assert_jq "6a" '.code|type=="string"' "$LAST_BODY"
assert_jq "6a" '(.amount|tonumber)==200' "$LAST_BODY"
assert_jq "6a" '(.code|test("^[A-Z0-9]{8}$"))' "$LAST_BODY"
CODE="$(jq -r '.code' <<<"$LAST_BODY")"
request_json "GET" "http://localhost:3000/riders/${RIDER_ID}" "" \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "6b" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "6b" '(.balance|tonumber)==1300' "$LAST_BODY"
echo "OK"

printf '[7/14] driver verifies transaction code and fields... '
request_json "GET" "http://localhost:8080/drivers/${DRIVER_ID}/transactions/${CODE}" "" \
  "Authorization: Bearer ${DRIVER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "7" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "7" '.transactionId|type=="string"' "$LAST_BODY"
assert_jq "7" ".senderId==\"${RIDER_ID}\"" "$LAST_BODY"
assert_jq "7" ".receiverId==\"${DRIVER_ID}\"" "$LAST_BODY"
assert_jq "7" '(.amount|tonumber)==200' "$LAST_BODY"
assert_jq "7" '.status=="COMPLETED"' "$LAST_BODY"
assert_jq "7" ".code==\"${CODE}\"" "$LAST_BODY"
assert_jq "7" '.createdAt|type=="string"' "$LAST_BODY"
STEP7_TRANSACTION_ID="$(jq -r '.transactionId' <<<"$LAST_BODY")"
STEP7_CREATED_AT="$(jq -r '.createdAt' <<<"$LAST_BODY")"
echo "OK"

printf '[8/14] driver balance is 300 after verification... '
request_json "GET" "http://localhost:8080/drivers/${DRIVER_ID}" "" \
  "Authorization: Bearer ${DRIVER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "8" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "8" '(.balance|tonumber)==300' "$LAST_BODY"
echo "OK"

printf '[9/14] idempotent verify: identical body, balance unchanged... '
request_json "GET" "http://localhost:8080/drivers/${DRIVER_ID}/transactions/${CODE}" "" \
  "Authorization: Bearer ${DRIVER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "9a" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "9a" ".transactionId==\"${STEP7_TRANSACTION_ID}\"" "$LAST_BODY"
assert_jq "9a" ".createdAt==\"${STEP7_CREATED_AT}\"" "$LAST_BODY"
assert_jq "9a" ".senderId==\"${RIDER_ID}\"" "$LAST_BODY"
assert_jq "9a" ".receiverId==\"${DRIVER_ID}\"" "$LAST_BODY"
assert_jq "9a" '.status=="COMPLETED"' "$LAST_BODY"
assert_jq "9a" ".code==\"${CODE}\"" "$LAST_BODY"
assert_jq "9a" '(.amount|tonumber)==200' "$LAST_BODY"
request_json "GET" "http://localhost:8080/drivers/${DRIVER_ID}" "" \
  "Authorization: Bearer ${DRIVER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "9b" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "9b" '(.balance|tonumber)==300' "$LAST_BODY"
echo "OK"

printf '[10/14] insufficient rider funds returns 400... '
request_json "POST" "http://localhost:3000/riders/${RIDER_ID}/pay" \
  "{\"driverId\":\"${DRIVER_ID}\",\"amount\":99999}" \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "400" ]]; then
  fail_http_step "10" "400" "$HTTP_STATUS" "$LAST_BODY"
fi
echo "OK"

printf '[11/14] payments rejects self-transfer with 422... '
SELF_TRANSFER_RESULT="$(
  docker run --rm \
    --network mobility-net \
    -v "${ROOT_DIR}/payments/proto:/protos:ro" \
    fullstorydev/grpcurl \
    -plaintext \
    -import-path /protos \
    -proto payments/v1/payments.proto \
    -d "{\"type\":\"TRANSFER\",\"sender_id\":\"${SELF_ID}\",\"receiver_id\":\"${SELF_ID}\",\"amount\":\"50.00\",\"idempotency_key\":\"\"}" \
    payments:50051 \
    payments.v1.PaymentsService/CreateTransaction 2>&1 || true
)"
if [[ "$SELF_TRANSFER_RESULT" != *"FailedPrecondition"* ]]; then
  echo "FAIL"
  echo "  expected gRPC FailedPrecondition for self-transfer"
  echo "  got: ${SELF_TRANSFER_RESULT}"
  exit 1
fi
echo "OK"

printf '[12/14] rider validation error returns 400... '
request_json "POST" "http://localhost:3000/riders" \
  '{"name":""}' \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "400" ]]; then
  fail_http_step "12" "400" "$HTTP_STATUS" "$LAST_BODY"
fi
echo "OK"

printf '[13/14] restart persistence (rider balance survives restart)... '
request_json "GET" "http://localhost:3000/riders/${RIDER_ID}" "" \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "13a" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
PRE_RESTART_RIDER_BALANCE="$(jq -r '.balance' <<<"$LAST_BODY")"
if ! docker compose restart rider >/dev/null; then
  echo "FAIL"
  echo "  unable to restart rider service"
  exit 1
fi
if ! wait_for_service_healthy "rider"; then
  echo "FAIL"
  echo "  rider did not become healthy after restart"
  exit 1
fi
request_json "GET" "http://localhost:3000/riders/${RIDER_ID}" "" \
  "Authorization: Bearer ${RIDER_TOKEN}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "13b" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
POST_RESTART_RIDER_BALANCE="$(jq -r '.balance' <<<"$LAST_BODY")"
if [[ "$POST_RESTART_RIDER_BALANCE" != "$PRE_RESTART_RIDER_BALANCE" ]]; then
  echo "FAIL"
  echo "  rider balance changed after restart"
  echo "  before: ${PRE_RESTART_RIDER_BALANCE}"
  echo "  after: ${POST_RESTART_RIDER_BALANCE}"
  exit 1
fi
echo "OK"
