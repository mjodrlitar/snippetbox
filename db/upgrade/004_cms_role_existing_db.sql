-- One-off upgrade for a DB volume created before db/init/004_cms_role.sql existed
-- (fresh installs do not need it). Run with the CMS stopped:
--   docker compose stop cms
--   docker compose exec -T db psql -U snippetbox -v ON_ERROR_STOP=1 < db/init/004_cms_role.sql
--   docker compose exec -T db psql -U snippetbox -v ON_ERROR_STOP=1 < db/upgrade/004_cms_role_existing_db.sql
--   docker compose up -d cms cms-setup

-- Directus must own its own tables (it runs migrations on them).
DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables
             WHERE schemaname = 'public' AND tablename LIKE 'directus\_%'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO directus', t.tablename);
    END LOOP;
END $$;
