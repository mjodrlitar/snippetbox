# Snippetbox

## Run with Docker

Install Docker Desktop and enable WSL integration for this distribution. From the repository root, run:

```sh
docker compose up --build
```

The frontend is served by Nginx in its own container. The Go backend runs in a separate container and is available to the frontend on the Compose network.
Open [http://localhost:1223](http://localhost:1223). Stop the app with `Ctrl+C`.

To run it in the background, use `docker compose up --build -d`; view logs with
`docker compose logs -f`, then stop and remove the container with `docker compose down`.

## Database (PostgreSQL)

Compose starts a `postgres:17-alpine` container. On the **first** start it runs
`db/init/001_schema.sql` (tables) and `db/init/002_seed.sql` (sample data).
Data lives in the `db-data` volume; to recreate the DB from scratch run
`docker compose down -v && docker compose up --build`.

Connect from the host: `psql postgres://snippetbox:snippetbox@localhost:5433/snippetbox`.

Seed users: `n3cr0l0rd`, `alice`, `bob` (password `password`).

### API

Interactive docs (Swagger UI): [http://localhost:1223/api/docs](http://localhost:1223/api/docs).
The OpenAPI 3 spec lives in `internal/docs/openapi.yaml` (served at `/api/openapi.yaml`); update it together with the handlers.

| Method | Path                 | Description                            |
|--------|----------------------|----------------------------------------|
| GET    | `/api/snippets`      | 10 latest public, non-expired snippets |
| GET    | `/api/snippets/{id}` | One snippet (public/unlisted)          |
| POST   | `/api/snippets`      | Create: `{title, content, language, visibility, expires}` |
| POST   | `/api/auth/signup`   | Register: `{username, email, password}`, starts a session |
| POST   | `/api/auth/login`    | Log in: `{email, password}`, sets `session` cookie |
| POST   | `/api/auth/logout`   | Log out, deletes the session           |
| GET    | `/api/auth/me`       | Current user or 401                    |
| GET    | `/api/me/snippets`   | All own non-expired snippets (incl. private), 401 for guests |

All non-GET API requests must use `Content-Type: application/json` (CSRF protection).
Private snippets require login and are visible only to their author.

If your DB volume was created before `003_sessions.sql` existed, apply it once:
`docker compose exec -T db psql -U snippetbox < db/init/003_sessions.sql`

## CMS (Directus)

Compose also starts [Directus](https://directus.io) on top of the same PostgreSQL
database: [http://localhost:8055](http://localhost:8055).

| Account                 | Password         | Can do                                                    |
|-------------------------|------------------|-----------------------------------------------------------|
| `admin@example.com`     | `admin12345`     | Everything, including the data model and roles            |
| `moderator@example.com` | `moderator12345` | Read/edit/delete public and unlisted snippets, read/delete app users, add and rename languages |

Directus works directly with the app tables (`snippets`, `users`, `languages`);
its own data lives in `directus_*` tables in the same DB. The one-shot
`cms-setup` container runs `cms/setup.mjs` on every `docker compose up`
(idempotent): it configures collections and fields (code editor, dropdowns,
user → snippets relation), creates the Moderator role and adds content
(TypeScript/SQL/Java/YAML languages and sample snippets) through the CMS API.

Languages added in the CMS show up in the app's editor immediately
(`GET /api/languages`).

### Privacy: what the CMS cannot touch

Directus connects as a restricted PostgreSQL role `directus`
(`db/init/004_cms_role.sql`), so these rules hold for **every** CMS account,
admin included, and cannot be bypassed from the CMS UI or API:

- **Private snippets do not exist for the CMS.** Row-level security on
  `snippets` hides them: they cannot be listed, read, edited or deleted, and no
  snippet can be made private from the CMS. Only the author sees them in the app.
- **No password hashes, no sessions:** column-level grants hide
  `users.password_hash`; the `sessions` table is not granted at all.
- **App users cannot be created** in the CMS (no `INSERT` on `users`).

The app connects as the table owner and is not affected by RLS.

Upgrading a DB volume created before this role existed: see
`db/upgrade/004_cms_role_existing_db.sql`.

### Theme, plugins and our own extension

The `cms` image (`cms/Dockerfile`) bundles:

- **Theme:** `@directus-labs/dark-terminal-theme` (set as default by `setup.mjs`), Sagas logo and colors.
- **Plugins:** `@directus-labs/card-select-interfaces` (visibility picker),
  `@directus-labs/spreadsheet-layout` (languages table), `@directus-labs/command-palette-module` (`Ctrl+K`).
- **Our extension** `cms/extensions/sagas` (built with `@directus/extensions-sdk`):
  - hook `sagas-guard` — the app's snippet rules (title length, non-empty content,
    known language) and clear `403 PRIVATE_SNIPPET` errors for private snippets;
  - display `code-preview` — first line of code with line number in the snippets list.
- **Insights dashboard** "Sagas overview" (built-in panels).

After changing the extension: `docker compose up -d --build cms`.
Comparison with the hand-written app (lab 10): `docs/lab10-cms-vs-custom.md`.
