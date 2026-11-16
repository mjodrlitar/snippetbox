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
