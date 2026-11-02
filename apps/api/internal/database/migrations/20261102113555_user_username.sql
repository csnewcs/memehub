-- +goose Up
ALTER TABLE users ADD COLUMN username text;
CREATE INDEX users_issuer_username_idx ON users(oidc_issuer, lower(username));

-- +goose Down
DROP INDEX users_issuer_username_idx;
ALTER TABLE users DROP COLUMN username;
