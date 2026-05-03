CREATE TABLE user_identities (
    app_user_id VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_user_identities_provider_subject UNIQUE (provider, provider_subject)
);

INSERT INTO user_identities (app_user_id, provider, provider_subject, email, role, created_at)
SELECT id, 'legacy', id, email, 'driver', created_at
FROM drivers
ON CONFLICT DO NOTHING;

ALTER TABLE drivers ADD COLUMN app_user_id VARCHAR(64);
UPDATE drivers SET app_user_id = id WHERE app_user_id IS NULL;
ALTER TABLE drivers ALTER COLUMN app_user_id SET NOT NULL;
ALTER TABLE drivers ADD CONSTRAINT uq_drivers_app_user_id UNIQUE (app_user_id);
