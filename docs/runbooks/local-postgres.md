# Local PostgreSQL Runbook — Business OS

## Overview

This is the **local development** PostgreSQL service for Business OS (REBZZ).

It exists so that developers can run a real PostgreSQL instance on their own
machine while building the platform foundation. It is **development-only
infrastructure**. It is not a production database, not a shared environment, and
not a template for production deployment.

This service contains **no application schema**. No tables, migrations, ORM, or
business entities exist yet. Those are decided in later approved tasks.

All commands in this runbook are run from the **repository root**.

## Requirements

- Docker Engine running locally.
- Docker Compose v2 (`docker compose`, not the legacy `docker-compose`).
- Network access the first time, so Docker can download the PostgreSQL image.
- `psql` only if you want to run the optional host-side connectivity check.

Verify your setup:

```bash
docker --version
docker compose version
docker info
```

## Configuration

Configuration comes from a `.env` file in the repository root, passed explicitly
with `--env-file`. The Compose file reads these variables:

| Variable | Meaning | Example value |
| --- | --- | --- |
| `BUSINESS_OS_DB_NAME` | Database name created on first start | `business_os_local` |
| `BUSINESS_OS_DB_USER` | Database user created on first start | `business_os_local` |
| `BUSINESS_OS_DB_PASSWORD` | Password for that user | *(your own strong value)* |
| `BUSINESS_OS_DB_PORT` | Host port mapped to container port 5432 | `55432` |

All four are **required** except the port, which defaults to `55432`. The port
is deliberately non-standard so it does not collide with a normal local
PostgreSQL installation, which usually uses `5432`.

### `.env.example`

`.env.example` is committed and contains **example values only**. Its password
value is the literal placeholder `REPLACE_WITH_STRONG_LOCAL_PASSWORD`, which is
not a usable credential.

### `.env`

`.env` holds your real local credentials. It is ignored by Git and must never be
committed.

Create it once:

```bash
cp .env.example .env
```

Then edit `.env` and replace the placeholder with a strong local-only password.

Recommended: restrict the file to your own user.

```bash
chmod 600 .env
```

**Why credentials must not be committed.** A committed password is a leaked
credential: it survives in Git history permanently, is copied into every clone
and every CI checkout, and cannot be revoked by deleting the file. Anyone with
repository access could read it, and automated secret scanners may publish it.
The database name, user, and port are not sensitive; the password is the only
secret, which is why only the example file is tracked.

## Starting the database

```bash
docker compose \
  --env-file .env \
  -f deployments/local/compose.postgres.yml \
  up -d --wait
```

`-d` runs it in the background. `--wait` makes Compose block until the container
health check reports `healthy`, so the command returning successfully means the
server is actually ready. On first run the image is downloaded and the database
cluster is initialized, which takes a little longer.

## Checking service health

```bash
docker compose \
  --env-file .env \
  -f deployments/local/compose.postgres.yml \
  ps
```

A healthy service looks like this:

```text
NAME                           IMAGE                    STATUS                   PORTS
business-os-local-postgres-1   postgres:18.6-bookworm   Up 6 seconds (healthy)   127.0.0.1:55432->5432/tcp
```

**Important:** the container health check runs `pg_isready`. `pg_isready` only
confirms the server process is accepting connections. It does **not** prove that
your credentials are correct. A container can be `healthy` while every login
fails because the password is wrong. Always run the authenticated check below
before trusting the service.

## Testing connectivity

Run an authenticated query **inside** the container. This reuses the container's
own `POSTGRES_*` variables, so no password is typed or displayed:

```bash
docker compose \
  --env-file .env \
  -f deployments/local/compose.postgres.yml \
  exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT 1;"'
```

Expected output:

```text
1
```

Confirm the server version:

```bash
docker compose \
  --env-file .env \
  -f deployments/local/compose.postgres.yml \
  exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT current_setting('"'"'server_version'"'"');"'
```

This connects over **TCP to `127.0.0.1`**, not over the local Unix socket, so it
genuinely exercises password authentication.

If you have `psql` installed locally, connect from the host:

```bash
PGPASSWORD='<your password>' psql -X -h 127.0.0.1 -p 55432 -U business_os_local -d business_os_local
```

Prefer `PGPASSWORD` over putting the password in a connection URI, because URIs
end up in shell history and process listings.

## Stopping the database

```bash
docker compose \
  --env-file .env \
  -f deployments/local/compose.postgres.yml \
  down
```

This stops and removes the container **but preserves the named volume**, so your
data survives. Never add `-v` unless you intend to destroy the data.

## Restarting the database

```bash
docker compose \
  --env-file .env \
  -f deployments/local/compose.postgres.yml \
  up -d --wait
```

Use this after `down`, after a reboot, or whenever you want the service back.
The same `up` command is both the first start and every later restart.

## Persistent data

Database files live in the Docker named volume
`business-os-local_business_os_postgres_data`.

The Compose file mounts that volume at `/var/lib/postgresql`, which is the
correct mount point for PostgreSQL 18 images. PostgreSQL 18 uses
`/var/lib/postgresql/18/docker` as its `PGDATA`, nested inside that mount. This
matters: PostgreSQL 18 changed the data-directory layout, and mounting only
`/var/lib/postgresql/data` would not persist the data at all.

Consequently, ordinary container recreation preserves your data:

```bash
docker compose --env-file .env -f deployments/local/compose.postgres.yml down
docker compose --env-file .env -f deployments/local/compose.postgres.yml up -d --wait
```

Your tables and rows are still there afterwards. This behavior is covered by the
persistence test recorded in `docs/tasks/FND-006.md`.

## Resetting local data

**Deleting the volume is destructive and cannot be undone.** All local data in
this service is lost permanently.

This runbook intentionally does **not** provide a reset script. Automated
destructive helpers are too easy to trigger by accident.

If local data genuinely needs to be reset, ask the project owner for explicit
authorization first. They will confirm that nothing valuable is in the volume
and that a reset is intended.

Also note that `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are only
applied when the data directory is **empty**. Changing them in `.env` after the
volume already has data has no effect on the existing cluster.

## Troubleshooting

### Docker daemon unavailable

```text
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

Docker Engine is not running. Start Docker Desktop (or `systemctl start docker`),
wait for it to be ready, and re-run `docker info`. Ask the owner before changing
Docker daemon configuration or adding your user to the `docker` group.

### Compose command not found

```text
docker: 'compose' is not a docker command
```

You have Docker but not Compose v2, or you are typing `docker-compose` instead
of `docker compose`. The legacy Python Compose v1 tool is not supported here.

### Port already in use

```text
bind: address already in use
```

Another process holds the host port. Check what is using it:

```bash
ss -ltnp | grep 55432
```

Either stop that process, or set a different `BUSINESS_OS_DB_PORT` in `.env`. If
you change the port, use it consistently wherever you connect.

### Invalid or missing environment variables

```text
error while interpolating services.postgres.environment.POSTGRES_DB:
required variable BUSINESS_OS_DB_NAME is missing a value
```

`--env-file .env` is missing, points at the wrong file, or a required variable
is blank. Confirm `.env` exists in the repository root and defines all four
variables. A blank value counts as missing.

### Database authentication fails

```text
FATAL: password authentication failed for user "business_os_local"
```

The server is up, but your credentials are wrong. Check `BUSINESS_OS_DB_USER` and
`BUSINESS_OS_DB_NAME` in `.env` against the ones the cluster was initialized
with.

Remember that `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are only
used when the data directory is first created. If you changed the password in
`.env` after the first start, the cluster still holds the original password.
Update it inside the database or reset the volume with owner authorization —
see the section above.

Also confirm you are not using `trust` assumptions: connections over TCP require
a password here.

### Container is unhealthy

```bash
docker compose --env-file .env -f deployments/local/compose.postgres.yml logs postgres
```

Read the logs first. Common causes: a volume left over from an older,
differently-initialized cluster; insufficient disk space; or a host port
conflict. If the service is reported healthy but logins fail, remember
`pg_isready` does not validate credentials — use the authenticated check.

### Image download fails

```text
failed to resolve source metadata / dial tcp / context deadline exceeded
```

The image cannot be fetched. Check network access and proxy settings, then retry.
The image is `postgres:18.6-bookworm` from the official Docker Hub library. If a
proxy blocks Docker Hub, that is a machine configuration issue for the owner to
resolve.

### Existing volume was initialized with different credentials

```text
database files are incompatible with server
```

The named volume was created earlier by a different configuration. Do not delete
it casually. Inspect it first with `docker volume inspect`, and reset it only
with explicit owner authorization.

## Security boundaries

**This is not production-ready database infrastructure.** Do not copy this
configuration into a deployed environment.

Specifically, this setup is development-only because:

- The password is a local developer credential held in a file on one machine.
- The port is published to `127.0.0.1` only, which is a developer convenience,
  not network isolation.
- TLS is off. Connections are local plaintext.
- There are no backups, no monitoring, no alerting, and no audit logging.
- The `business_os_local` user is a PostgreSQL **superuser**. That is acceptable
  only for a throwaway local container. Any runtime application must connect with
  a **non-superuser** role with narrowly granted privileges.
- Only a single service is defined here. There is no replication, failover, or
  high availability.

Production will require separate, explicitly reviewed decisions covering
credential and secret management, backup and restore, network isolation, TLS,
monitoring and alerting, upgrade policy, and deployment. None of those decisions
are made by this runbook.

### Tenant isolation is not provided here

PostgreSQL is the storage engine; it is not what makes this platform
multi-tenant. Tenant isolation, scoped authorization, domain ownership, and
data-access boundaries are implemented in later approved tasks, including
row-level security. Nothing in this task provides isolation.

## Future development

A later task will select and implement the database access layer and the
migration system. Until that task is approved and implemented:

- Do not add migrations, models, entities, or tables to this service.
- Do not assume any ORM or query builder has been chosen.
- Do not create application tables by hand.

The local service created here is the substrate those later decisions will build
on, so keep it healthy and keep credentials out of Git.
