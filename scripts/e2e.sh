#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

X_USER_ID="${X_USER_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"
SELF_ID="${SELF_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]')}"

HTTP_STATUS=""
HTTP_BODY_FILE=""
LAST_BODY=""

cleanup() {
  local exit_code=$?
  trap - EXIT

  printf '[13/13] docker compose down -v... '
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

wait_for_healthy() {
  local deadline=$((SECONDS + 90))
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

printf '[1/13] docker compose up -d --build... '
if docker compose up -d --build; then
  echo "OK"
else
  echo "FAIL"
  exit 1
fi

printf '[2/13] services become healthy within 90s... '
if wait_for_healthy; then
  echo "OK"
else
  echo "FAIL"
  docker compose ps || true
  exit 1
fi

printf '[3/13] create rider (201, capture riderId)... '
request_json "POST" "http://localhost:3000/riders" \
  '{"name":"Alice","email":"alice@example.com"}' \
  "X-User-Id: ${X_USER_ID}"
if [[ "$HTTP_STATUS" != "201" ]]; then
  fail_http_step "3" "201" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "3" '.id|type=="string"' "$LAST_BODY"
assert_jq "3" '.name=="Alice"' "$LAST_BODY"
assert_jq "3" '.email=="alice@example.com"' "$LAST_BODY"
assert_jq "3" '(.balance|tonumber)==1000' "$LAST_BODY"
RIDER_ID="$(jq -r '.id' <<<"$LAST_BODY")"
echo "OK"

printf '[4/13] create driver (201, capture driverId)... '
request_json "POST" "http://localhost:8080/drivers" \
  '{"name":"Bob","email":"bob@example.com"}'
if [[ "$HTTP_STATUS" != "201" ]]; then
  fail_http_step "4" "201" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "4" '.id|type=="string"' "$LAST_BODY"
assert_jq "4" '.name=="Bob"' "$LAST_BODY"
assert_jq "4" '.email=="bob@example.com"' "$LAST_BODY"
assert_jq "4" '(.balance|tonumber)==100' "$LAST_BODY"
DRIVER_ID="$(jq -r '.id' <<<"$LAST_BODY")"
echo "OK"

printf '[5/13] rider deposit then rider balance=1500... '
request_json "POST" "http://localhost:3000/riders/${RIDER_ID}/deposit" \
  '{"amount":500}' \
  "X-User-Id: ${X_USER_ID}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "5a" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
request_json "GET" "http://localhost:3000/riders/${RIDER_ID}" "" \
  "X-User-Id: ${X_USER_ID}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "5b" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "5" '(.balance|tonumber)==1500' "$LAST_BODY"
echo "OK"

printf '[6/13] rider pay driver, code format, rider balance=1300... '
request_json "POST" "http://localhost:3000/riders/${RIDER_ID}/pay" \
  "{\"driverId\":\"${DRIVER_ID}\",\"amount\":200}" \
  "X-User-Id: ${X_USER_ID}"
if [[ "$HTTP_STATUS" != "201" ]]; then
  fail_http_step "6a" "201" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "6a" '.transactionId|type=="string"' "$LAST_BODY"
assert_jq "6a" '.code|type=="string"' "$LAST_BODY"
assert_jq "6a" '(.amount|tonumber)==200' "$LAST_BODY"
assert_jq "6a" '(.code|test("^[A-Z0-9]{8}$"))' "$LAST_BODY"
CODE="$(jq -r '.code' <<<"$LAST_BODY")"
request_json "GET" "http://localhost:3000/riders/${RIDER_ID}" "" \
  "X-User-Id: ${X_USER_ID}"
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "6b" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "6b" '(.balance|tonumber)==1300' "$LAST_BODY"
echo "OK"

printf '[7/13] driver verifies transaction code and fields... '
request_json "GET" "http://localhost:8080/drivers/${DRIVER_ID}/transactions/${CODE}" ""
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
STEP7_BODY="$(jq -S . <<<"$LAST_BODY")"
echo "OK"

printf '[8/13] driver balance is 300 after verification... '
request_json "GET" "http://localhost:8080/drivers/${DRIVER_ID}" ""
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "8" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "8" '(.balance|tonumber)==300' "$LAST_BODY"
echo "OK"

printf '[9/13] idempotent verify: identical body, balance unchanged... '
request_json "GET" "http://localhost:8080/drivers/${DRIVER_ID}/transactions/${CODE}" ""
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "9a" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
STEP9_BODY="$(jq -S . <<<"$LAST_BODY")"
if [[ "$STEP9_BODY" != "$STEP7_BODY" ]]; then
  echo "FAIL"
  echo "  repeated verification body differs from step 7"
  echo "  step7: ${STEP7_BODY}"
  echo "  step9: ${STEP9_BODY}"
  exit 1
fi
request_json "GET" "http://localhost:8080/drivers/${DRIVER_ID}" ""
if [[ "$HTTP_STATUS" != "200" ]]; then
  fail_http_step "9b" "200" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "9b" '(.balance|tonumber)==300' "$LAST_BODY"
echo "OK"

printf '[10/13] insufficient rider funds returns 400... '
request_json "POST" "http://localhost:3000/riders/${RIDER_ID}/pay" \
  "{\"driverId\":\"${DRIVER_ID}\",\"amount\":99999}" \
  "X-User-Id: ${X_USER_ID}"
if [[ "$HTTP_STATUS" != "400" ]]; then
  fail_http_step "10" "400" "$HTTP_STATUS" "$LAST_BODY"
fi
echo "OK"

printf '[11/13] payments rejects self-transfer with 422... '
request_json "POST" "http://localhost:8081/transactions" \
  "{\"type\":\"TRANSFER\",\"senderId\":\"${SELF_ID}\",\"receiverId\":\"${SELF_ID}\",\"amount\":50}"
if [[ "$HTTP_STATUS" != "422" ]]; then
  fail_http_step "11" "422" "$HTTP_STATUS" "$LAST_BODY"
fi
assert_jq "11" '.error=="Self-transfer not allowed"' "$LAST_BODY"
echo "OK"

printf '[12/13] rider validation error returns 400... '
request_json "POST" "http://localhost:3000/riders" \
  '{"name":""}' \
  "X-User-Id: ${X_USER_ID}"
if [[ "$HTTP_STATUS" != "400" ]]; then
  fail_http_step "12" "400" "$HTTP_STATUS" "$LAST_BODY"
fi
echo "OK"
