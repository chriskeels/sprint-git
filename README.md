# BrightPath Tutoring

[![Basic CI Checks](https://github.com/chriskeels/sprint-git/actions/workflows/basic-ci.yml/badge.svg)](https://github.com/chriskeels/sprint-git/actions/workflows/basic-ci.yml)

## Project Overview
BrightPath Tutoring helps middle- and high-school Associates with math and science through an online app where Associates log in, watch videos, take quizzes, and track progress. This repository contains the app plus Docker orchestration for local and CI-based deployments.

## Architecture
- **Services:** Two-container setup: an `app` service (Next.js + Node) and a `db` service (PostgreSQL).
- **Communication:** The `app` connects to the `db` over an internal Docker network provided by Docker Compose. The app reads its connection string from environment configuration and connects to the database at the host name `db` (the Compose service name) on port `5432`.
- **Build strategy:** Multi-stage Dockerfile produces a small production image (builder -> production). The runtime image contains the standalone Next.js output and static assets.

This setup ensures predictable, repeatable builds and a clear separation between compute (app) and data (database). See `docker-compose.yml` for service definitions and `Dockerfile` for the multi-stage build.

## Quick Start
Single-command startup (recommended):

```bash
# Start both services in the foreground (use -d to detach)
docker compose up
```

Run detached:

```bash
docker compose up -d
```

Stop and remove containers:

```bash
docker compose down
```

Notes:
- The Compose file uses `env_file` to load environment variables from `.env.production` for the `app` service. Ensure `.env.production` contains `DATABASE_URL` and any other secrets you need.
- To view service status:

```bash
docker compose ps
```

## Stability Features
- **Healthchecks:** The `db` service includes a `pg_isready` healthcheck to ensure the database is ready before the `app` depends on it.
- **Restart policies:** Services include `restart: always` so Docker attempts to restart failed containers automatically.
- **Why this helps:** Healthchecks prevent the app from attempting to connect to a database that isn't ready; restart policies provide resilience against transient crashes. Together they reduce downtime and improve reliability during updates and network blips.

## Environment Management
- **.env files:** Secrets and environment-specific values are stored in `.env.production` (not committed to remote). The `app` service reads this file via the `env_file` setting in `docker-compose.yml`.
- **Local development:** Use a separate `.env` (or local overrides) for development credentials.
- **Production:** For real production deployments, use a secrets manager (e.g., AWS Secrets Manager) or CI/CD environment variables rather than committing secrets to files.

## Business Value
- **Reliability:** Orchestrated services, healthchecks, and restart policies ensure students and teachers experience fewer outages.
- **Predictability:** Image-based deployments make rollbacks and reproductions straightforward, protecting revenue and reputation.
- **Operational efficiency:** With `docker compose up` a developer or operator can start the full environment with one command. This reduces setup time and support overhead.

## Screenshot
Both services running healthy after starting the stack:

![Services healthy](.github/screenshots/services-healthy.png)

**How to verify:** Run the following commands to see healthy status:

```bash
docker compose up -d
docker compose ps
```

Expected output:
- ✓ Network sprint2-lab-default Created
- ✓ Volume sprint2-lab-brightpath-data Created
- ✓ Container brightpath-db Healthy
- ✓ Container brightpath-app Created

## Why orchestration matters for educational apps
- Educational apps must be highly reliable: downtime directly affects student learning and teacher workflows.
- Orchestration (Docker Compose, Kubernetes) ensures consistent environments across developer machines, CI, and production, enabling fast recovery, straightforward scaling, and safer deployments.
- Healthchecks and restart policies reduce the window of failure and improve the user experience for time-sensitive classroom usage.

## Tech Stack
- Next.js (frontend + server)
- Node.js (runtime)
- Docker / Docker Compose (orchestration)
- Prisma (DB layer)
- PostgreSQL (persistent data store)

## Contributing
- Open issues or PRs for bugs and features.
- Keep changes small and add tests where applicable.

---

Single-command startup: `docker compose up` — start both services and verify with `docker compose ps`.

File references:
- See [docker-compose.yml](docker-compose.yml) for service orchestration.
- See [Dockerfile](Dockerfile) for the multi-stage build.

