-- +goose Up
CREATE TABLE admin_settings (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    openai_model text CHECK (length(openai_model) BETWEEN 1 AND 200),
    deleted_image_retention_days integer CHECK (deleted_image_retention_days BETWEEN 1 AND 365),
    incomplete_upload_retention_hours integer CHECK (incomplete_upload_retention_hours BETWEEN 2 AND 168),
    revision bigint NOT NULL DEFAULT 0,
    updated_by uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO admin_settings(singleton) VALUES(true);

-- +goose Down
DROP TABLE admin_settings;
