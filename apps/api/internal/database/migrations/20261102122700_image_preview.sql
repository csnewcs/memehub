-- +goose Up
ALTER TABLE memes ADD COLUMN preview_object_key text;

-- +goose Down
ALTER TABLE memes DROP COLUMN preview_object_key;
