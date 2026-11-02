-- +goose Up
ALTER TABLE memes ADD COLUMN allow_duplicate boolean NOT NULL DEFAULT false;
ALTER TABLE memes ADD COLUMN objects_deleted_at timestamptz;
ALTER TABLE memes ADD COLUMN cleanup_after timestamptz;
CREATE INDEX memes_cleanup_idx ON memes (updated_at) WHERE content_type='image' AND objects_deleted_at IS NULL;

-- +goose Down
DROP INDEX memes_cleanup_idx;
ALTER TABLE memes DROP COLUMN objects_deleted_at, DROP COLUMN allow_duplicate, DROP COLUMN cleanup_after;
