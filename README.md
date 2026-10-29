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
