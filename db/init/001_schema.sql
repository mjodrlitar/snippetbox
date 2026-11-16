-- snippetbox (agas) database schema.
-- Runs automatically on the first start of the postgres container
-- (files in /docker-entrypoint-initdb.d/ are executed in alphabetical order).

CREATE TYPE snippet_visibility AS ENUM ('public', 'unlisted', 'private');

CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE languages (
    code VARCHAR(16) PRIMARY KEY,         -- 'c', 'go', 'python' ...
    name VARCHAR(50) NOT NULL             -- 'C', 'Go', 'Python' ...
);

CREATE TABLE snippets (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       VARCHAR(100)       NOT NULL DEFAULT 'Untitled',
    content     TEXT               NOT NULL CHECK (length(content) > 0),
    language    VARCHAR(16)        NOT NULL DEFAULT 'text' REFERENCES languages (code),
    visibility  snippet_visibility NOT NULL DEFAULT 'public',
    user_id     BIGINT             REFERENCES users (id) ON DELETE SET NULL, -- NULL = guest
    created_at  TIMESTAMPTZ        NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,                                                 -- NULL = never
    CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- "Latest public sagas" feed: filter by visibility + sort by date.
CREATE INDEX snippets_public_latest_idx
    ON snippets (created_at DESC)
    WHERE visibility = 'public';

-- "My sagas": all of the user's snippets, newest first.
CREATE INDEX snippets_user_id_idx ON snippets (user_id, created_at DESC);
