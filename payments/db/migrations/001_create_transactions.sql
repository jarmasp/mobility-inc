CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    code TEXT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NULL,
    amount DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    idempotency_key TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_code_uq
    ON transactions (code)
    WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_idempotency_key_uq
    ON transactions (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
