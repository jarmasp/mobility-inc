CREATE TABLE claimed_codes (
    code VARCHAR(128) PRIMARY KEY,
    driver_id VARCHAR(64) NOT NULL,
    transaction_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    sender_id VARCHAR(64),
    receiver_id VARCHAR(64),
    amount NUMERIC(19, 2) NOT NULL,
    transaction_created_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_claimed_codes_driver FOREIGN KEY (driver_id) REFERENCES drivers(id)
);
