# Local PostgreSQL Runbook — Business OS

## Overview

This is the **local development** PostgreSQL service for Business OS (REBZZ).

It exists so that developers can run a real PostgreSQL instance on their own
machine while building the platform foundation. It is **development-only
infrastructure**. It is not a production database, not a shared environment, and
not a template for production deployment.

This service contains **no application schema**. No tables, migrations, or
business entities exist yet. FND-007 selected Drizzle ORM as the data-access
layer and provisioned a restricted application role, but deliberately created
no schema. Those are decided in later approved tasks.

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
| `BUSINESS_OS_DB_USER` | Bootstrap administrator user | `business_os_local` |
| `BUSINESS_OS_DB_PASSWORD` | Password for that user | *(your own strong value)* |
| `BUSINESS_OS_DB_PORT` | Host port mapped to container port 5432 | `55432` |
| `BUSINESS_OS_DB_APP_USER` | Restricted application role used by code | `business_os_app` |
| `BUSINESS_OS_DB_APP_PASSWORD` | Password for the application role | *(your own strong value)* |

All are **required** except the port, which defaults to `55432`. The port is
deliberately non-standard so it does not collide with a normal local PostgreSQL
installation, which usually uses `5432`.

The first four variables configure the **bootstrap administrator**, which owns
the local cluster. The last two configure the **application role**, which is the
account your code should use. See the Application Role section below.

### `.env.example`

`.env.example` is committed and contains **example values only**. Its password
values are the literal placeholders `REPLACE_WITH_STRONG_LOCAL_PASSWORD` and
`REPLACE_WITH_STRONG_LOCAL_APP_PASSWORD`, which are not usable credentials.

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

## Drizzle Database Foundation

FND-007 selected the database access layer:

- **Drizzle ORM** provides typed, parameterized data access.
- **`pg`** (node-postgres) provides the connection pool.
- **`@business-os/database`** is the shared package at `packages/database`.

Drizzle is used through its supported PostgreSQL integration:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
```

Bun is the current development and production runtime. The shared package is
built as portable Node-compatible ESM, but it uses no Bun-specific APIs and runs
on Bun. The rationale is recorded in `docs/adr/0002-runtime-portability-and-drizzle.md`.

The package exposes two functions:

```ts
import { createDatabase, parseDatabaseConfig } from "@business-os/database";

const config = parseDatabaseConfig({
  host: "127.0.0.1",
  port: 55432,
  database: "business_os_local",
  user: process.env.BUSINESS_OS_DB_APP_USER,
  password: process.env.BUSINESS_OS_DB_APP_PASSWORD,
  ssl: false,
});

const database = createDatabase(config);

await database.ping();
await database.close();
```

`parseDatabaseConfig` validates everything explicitly. It never reads
`process.env`, `Bun.env`, or `.env` itself, so your application decides where
configuration comes from. `createDatabase` does not connect until the first
query, and there is no global singleton: you own the lifecycle and must call
`close()`.

No schema, migration, or `drizzle-kit` setup exists yet.

## Application Role

Local development uses two separate accounts:

| Account | Purpose | Power |
| --- | --- | --- |
| `business_os_local` | Bootstrap administrator | Cluster superuser |
| `business_os_app` | Application runtime | Restricted |

The application role is deliberately **not** a superuser. It has `LOGIN` and is
granted `CONNECT` on the database and `USAGE` on the `public` schema. It is
explicitly denied `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, and
`BYPASSRLS`, it inherits no administrative memberships, it owns nothing, and it
cannot create tables or schemas.

This separation matters because a superuser application account would allow a
single compromised code path to destroy or read everything, and would make
per-tenant access control unenforceable. Least privilege is also required by
rule 06, which states the runtime database user is not a superuser.

## Local Environment

The application account is configured through two variables:

| Variable | Purpose |
| --- | --- |
| `BUSINESS_OS_DB_APP_USER` | Application role name, `business_os_app` |
| `BUSINESS_OS_DB_APP_PASSWORD` | Password for that role |

Configure them securely:

1. Copy `.env.example` to `.env` if you have not already.
2. Replace `REPLACE_WITH_STRONG_LOCAL_APP_PASSWORD` with a strong local-only
   password of at least 40 random characters.
3. Keep the file readable only by you:

```bash
chmod 600 .env
```

Generate a suitable password with:

```bash
openssl rand -base64 48 | tr -d '\n' | tr '/+' '_-' | cut -c1-40
```

Do not reuse the administrator password for the application role. Do not commit
the real `.env`; it is already ignored by Git.

## Provisioning

The application role is created by a developer-only tool. Run it from the
repository root:

```bash
bun run packages/database/tools/local/provision-role.ts
```

The tool connects as the bootstrap administrator, confirms PostgreSQL 18.6 on
`127.0.0.1`, creates the role if it does not exist, applies the restrictive
attributes, grants the minimal permissions, and verifies the result.

The password is never placed in a SQL string. It is sent as a query parameter
into a transaction-local setting, and PostgreSQL quotes it server-side, so it
cannot be injected and is never echoed.

The command is **idempotent**. If the role already exists, the tool verifies
attributes, effective privileges, and authentication, and it does **not** reset
the password.

## Verification

Verify the role and the data-access layer at any time:

```bash
bun run packages/database/tools/local/verify-role.ts
```

This performs real checks: the application account authenticates, an incorrect
password is rejected, `SELECT current_user` and `SELECT current_database` return
the expected values, Drizzle executes `SELECT 1` through the pool, the role has
no administrative attributes, and attempts to create a table or a schema are
denied. It also confirms no test objects remain. Output is sanitized PASS/FAIL
lines with SQLSTATE codes.

## Application Connections

Applications must use `@business-os/database` and pass configuration explicitly.
Read the application account values from your own configuration layer and pass
them to `parseDatabaseConfig`. Do not read `.env` inside the shared package, and
do not connect as the administrator.

Remember to declare the dependency in each consuming package:

```json
"dependencies": {
  "@business-os/database": "workspace:*"
}
```

## Permission Model

Runtime credentials must not be used for schema migrations. Migrations change
structure and therefore need `CREATE` on schemas, which the application role is
denied on purpose. A future, separately approved migration account will own
that responsibility, and migrations will be executed explicitly rather than
automatically at service startup.

Until that exists, there is no supported way to create tables, which is why the
database currently has none. That is intended: schema ownership is designed in a
later task, not improvised locally.

## Troubleshooting (Database Access)

### Application role cannot authenticate

```text
FATAL: password authentication failed for user "business_os_app"
```

The role's password does not match `BUSINESS_OS_DB_APP_PASSWORD`. Confirm the
value in `.env`, then run `provision-role.ts`. If the role already exists, that
tool will **not** reset the password; delete the role manually or ask the owner
to re-provision it after an explicit decision.

### Role already exists

`provision-role.ts` reports that the role exists and verifies it instead of
recreating it. This is expected and safe. If verification fails, the role's
attributes or privileges have drifted and need manual reconciliation.

### Wrong database

```text
Refusing to run: database must be business_os_local
```

Both tools refuse to touch any database other than the approved local one, so
they cannot accidentally modify another project. Fix `BUSINESS_OS_DB_NAME` in
`.env`.

### Missing environment variables

```text
FAIL  Missing required environment variable: BUSINESS_OS_DB_APP_PASSWORD
```

The tools read the `.env` file at the repository root. Run them from the
repository root, and confirm `.env` defines the application account variables.

### PostgreSQL unavailable

Connection errors mean the container is not running. Start it with the command
in the Starting the database section above, then confirm health with `ps`.

### Database permission failures

```text
ERROR: permission denied for database business_os_local
ERROR: permission denied for schema public
ERROR: must be owner of ...
```

This usually means you are connected as the wrong account. Application code must
use `business_os_app`, not the administrator, and must not attempt to create
tables or schemas.

### Connection pool failures

"Too many clients already" means the pool size exceeds what the server allows.
Lower `maxPoolSize` in the configuration you pass to `parseDatabaseConfig`, or
raise PostgreSQL `max_connections` for local development. `ping()` failures are
reported with a SQLSTATE code; raw driver messages are never surfaced.

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
  only for a throwaway local container and only for provisioning. Any runtime
  application must connect with the restricted `business_os_app` role.
- Only a single service is defined here. There is no replication, failover, or
  high availability.

### Database access security

The properties that apply to database access specifically:

- **Local development-only credentials.** Both passwords are developer
  credentials for a local container on one machine.
- **SCRAM-SHA-256 TCP authentication.** The cluster is initialized with
  `--auth-host=scram-sha-256`, and passwords are stored as SCRAM verifiers
  rather than plaintext.
- **Least privilege.** The runtime role `business_os_app` is not a superuser,
  cannot create databases or roles, cannot replicate, cannot bypass row-level
  security, inherits no administrative memberships, owns nothing, and can create
  neither tables nor schemas.
- **No committed secrets.** `.env` is ignored by Git, `.env.example` contains
  only placeholders, and the shared database package never logs passwords or
  connection URLs. Validation errors identify the offending key without
  exposing its value.
- **No privileged runtime connections.** Application code must use
  `business_os_app`. Using the administrator account for runtime work would
  defeat least privilege entirely.
- **Explicit TLS.** `parseDatabaseConfig` requires an explicit `ssl` value and
  never disables certificate validation globally. The local tools pass
  `ssl: false` only because they connect to loopback.

### Production requirements still outstanding

Production is **not** addressed by this runbook and will require separate,
explicitly reviewed decisions covering:

- Credential and secret management, with no credentials in images or
  repositories.
- Mandatory TLS with certificate validation for every connection.
- Automated backup, restore testing, and recovery objectives.
- Network isolation and restricted database ingress.
- Monitoring, alerting, and audit logging.
- Managed upgrade and version policy.
- Separate runtime, migration, and administrative accounts.

Nothing in the local setup should be copied into production unchanged.

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
