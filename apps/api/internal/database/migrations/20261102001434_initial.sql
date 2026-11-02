-- +goose Up
CREATE TABLE users (
    id uuid PRIMARY KEY,
    oidc_issuer text NOT NULL CHECK (oidc_issuer <> ''),
    oidc_subject text NOT NULL CHECK (oidc_subject <> ''),
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (oidc_issuer, oidc_subject)
);
CREATE TABLE memes (
    id uuid PRIMARY KEY,
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content_type text NOT NULL CHECK (content_type IN ('image', 'text')),
    title text NOT NULL DEFAULT '',
    body_text text,
    description text NOT NULL DEFAULT '',
    extracted_text text NOT NULL DEFAULT '',
    source_url text,
    source_name text,
    source_author text,
    source_note text,
    original_filename text,
    original_object_key text UNIQUE,
    thumbnail_object_key text,
    mime_type text,
    size_bytes bigint CHECK (size_bytes > 0),
    width integer CHECK (width > 0),
    height integer CHECK (height > 0),
    sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    status text NOT NULL CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
    analysis_status text NOT NULL DEFAULT 'not_requested' CHECK (analysis_status IN ('not_requested', 'queued', 'processing', 'completed', 'failed')),
    content_revision bigint NOT NULL DEFAULT 0 CHECK (content_revision >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (
        (content_type = 'image' AND original_filename IS NOT NULL AND original_object_key IS NOT NULL AND body_text IS NULL)
        OR (content_type = 'text' AND body_text IS NOT NULL AND body_text ~ '[^[:space:]]'
            AND original_filename IS NULL AND original_object_key IS NULL AND thumbnail_object_key IS NULL
            AND mime_type IS NULL AND size_bytes IS NULL AND width IS NULL AND height IS NULL AND sha256 IS NULL
            AND extracted_text = '' AND status = 'ready')
    ),
    CHECK (content_type <> 'image' OR status <> 'ready' OR
        (mime_type IS NOT NULL AND size_bytes IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL AND sha256 IS NOT NULL))
);
CREATE TABLE tags (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (name <> ''),
    normalized_name text NOT NULL UNIQUE CHECK (normalized_name <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE meme_tags (
    meme_id uuid NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    source text NOT NULL CHECK (source IN ('user', 'ai')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (meme_id, tag_id)
);
CREATE TABLE jobs (
    id uuid PRIMARY KEY,
    meme_id uuid NOT NULL REFERENCES memes(id) ON DELETE RESTRICT,
    type text NOT NULL CHECK (type IN ('prepare_image', 'analyze_content', 'delete_objects')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
    run_after timestamptz NOT NULL DEFAULT now(),
    locked_until timestamptz,
    lock_token uuid,
    started_at timestamptz,
    finished_at timestamptz,
    input_revision bigint CHECK (input_revision >= 0),
    provider text,
    requested_model text,
    response_model text,
    prompt_version text,
    provider_request_id text,
    result jsonb,
    input_tokens bigint CHECK (input_tokens >= 0),
    output_tokens bigint CHECK (output_tokens >= 0),
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (status <> 'processing' OR (locked_until IS NOT NULL AND lock_token IS NOT NULL)),
    CHECK (type <> 'analyze_content' OR (provider IS NOT NULL AND provider = 'openai'
        AND requested_model IS NOT NULL AND requested_model <> '' AND prompt_version IS NOT NULL AND input_revision IS NOT NULL))
);
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE TABLE login_flows (
    state_hash text PRIMARY KEY,
    nonce text NOT NULL,
    code_verifier text NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE INDEX login_flows_expiry_idx ON login_flows (expires_at);
CREATE INDEX memes_listing_idx ON memes (created_at DESC, id DESC) WHERE deleted_at IS NULL AND status = 'ready';
CREATE INDEX memes_author_idx ON memes (created_by, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX memes_hash_idx ON memes (sha256) WHERE deleted_at IS NULL AND sha256 IS NOT NULL;
CREATE INDEX meme_tags_tag_idx ON meme_tags (tag_id, meme_id);
CREATE INDEX jobs_queued_idx ON jobs (run_after, id) WHERE status = 'queued';
CREATE INDEX jobs_leased_idx ON jobs (locked_until) WHERE status = 'processing';
CREATE UNIQUE INDEX jobs_active_idx ON jobs (meme_id, type) WHERE status IN ('queued', 'processing');
CREATE INDEX jobs_history_idx ON jobs (meme_id, created_at DESC);

-- +goose Down
DROP TABLE login_flows, sessions, meme_tags, jobs, tags, memes, users;
