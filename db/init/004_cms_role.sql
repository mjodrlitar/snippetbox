-- Separate DB role for the CMS (Directus).
-- The app connects as the table owner and is not affected by anything below.

CREATE ROLE directus LOGIN PASSWORD 'directus';

GRANT CONNECT ON DATABASE snippetbox TO directus;
-- Directus keeps its own directus_* tables in the same schema.
GRANT USAGE, CREATE ON SCHEMA public TO directus;

-- Snippets: full CRUD, but private rows are hidden by row-level security below.
GRANT SELECT, INSERT, UPDATE, DELETE ON snippets TO directus;

-- App users: no password hashes and no creating users (only the app's sign-up
-- form can produce a valid bcrypt hash).
GRANT SELECT (id, username, email, created_at) ON users TO directus;
GRANT UPDATE (username, email) ON users TO directus;
GRANT DELETE ON users TO directus;

GRANT SELECT, INSERT, UPDATE, DELETE ON languages TO directus;

-- No grants on sessions: the CMS does not see them at all.

-- Private snippets are visible to their author only, so the CMS can neither
-- read, change nor delete them, and cannot make a snippet private either.
-- The table owner (the app) bypasses RLS.
ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY cms_no_private ON snippets
    FOR ALL
    TO directus
    USING (visibility <> 'private')
    WITH CHECK (visibility <> 'private');
