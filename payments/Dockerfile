FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/payments .

FROM alpine:3.20

RUN apk add --no-cache curl

WORKDIR /app
COPY --from=builder /bin/payments /usr/local/bin/payments

EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost:8081/health || exit 1

CMD ["payments"]
