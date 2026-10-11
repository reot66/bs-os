# Database Migration Runbook — Business OS (REBZZ)

## Overview

This runbook describes the **local development** Core migration workflow
introduced by FND-011.

It governs a **development-only** PostgreSQL service on loopback, with a
dedicated migration role. Nothing here is production procedure. Production
migration is not authorized and requires separate approval — see
[Production gates](#production-gates-are-closed) and
`docs/adr/0006-database-migration-governance.md`.

All commands run from the **repository root**.

## Architecture and responsibilities

```text
Business OS
├── application runtime .............. business_os_app   (no DDL, no journal writes)
├── Core migration tooling ........... business_os_migrator (owns core + drizzle schemas)
└── local provisioning ............... business_os_local   (cluster superuser, provisioning only)
```

Three separate responsibilities, three separate credentials:

| Role | Purpose | May it migrate? |
| --- | --- | --- |
| `business_os_local` | Bootstrap administrator | No — provisioning only |
| `business_os_migrator` | Core schema and journal | Yes |
| `business_os_app` | Application runtime | Never |

The application role is denied `CREATE`, `ALTER`, and `DROP` on the Core and
journal schemas, and is never a member of the migrator role. Runtime
credentials therefore cannot apply a migration, and migrator credentials are
never reachable from ordinary application configuration.

## PostgreSQL prerequisites

- Docker Engine with Compose v2 (see `docs/runbooks/local-postgres.md`).
- The local service running and healthy.
- PostgreSQL **18.6**. The tools refuse any other major version.

```bash
docker compose --env-file .env -f deployments/local/compose.postgres.yml ps
```

A healthy service reports `healthy`. Remember that `pg_isready` proves the
server accepts connections, not that your credentials are correct.

## Required migration credentials

Set in `.env` (never committed; `.env.example` contains placeholders only):

```bash
BUSINESS_OS_DB_MIGRATOR_USER=business_os_migrator
BUSINESS_OS_DB_MIGRATOR_PASSWORD=<a strong local-only value>
```

Generate one with:

```bash
openssl rand -base64 48 | tr -d '\n' | tr '/+' '_-' | cut -c1-40
```

Both variables are registered in the central environment registry under the
`local-migration` scope. The password is classified sensitive, so the logger
redacts it automatically and it never appears in a configuration summary.

**Do not reuse the administrator or application password.** Do not commit
`.env`, and do not pass a password on a command line.

## Secret handling

- Secrets live in `.env`, which Git ignores. `chmod 600 .env`.
- The provisioning tool passes the password as a query parameter into a
  transaction-local setting and lets PostgreSQL quote it server-side with
  `format(..., %L)`. It is never interpolated into a SQL string.
- Errors report a SQLSTATE only. Raw driver messages, passwords, and
  connection strings are never printed.
- A rejected password never appears in a validation error; only the variable
  name and a stable error code are reported.

## Privileged local provisioning

Run once before the first migration, and again only if the role is deleted:

```bash
bun run packages/database/tools/migrations/provision-local-role.ts
```

This connects as the bootstrap administrator and:

1. confirms the host, database name, and PostgreSQL 18.6;
2. creates `business_os_migrator` with `LOGIN NOSUPERUSER NOCREATEDB
   NOCREATEROLE NOREPLICATION NOBYPASSRLS` and no memberships;
3. creates the `core` and `drizzle` schemas and assigns them to the migrator;
4. verifies attributes, memberships, schema ownership, and privilege
   boundaries;
5. proves the denial paths by connecting **as the migrator** and confirming it
   cannot write into `public`, create a role, or create a database.

The command is idempotent. If the role already exists it verifies rather than
recreating, and it **never silently resets an existing password**.

### Migration role attributes

```text
LOGIN  NOSUPERUSER  NOCREATEDB  NOCREATEROLE  NOREPLICATION  NOBYPASSRLS
```

No role memberships, no ownership of any database, no membership in any
administrative role.

### Core schema ownership

The migrator owns exactly `core` and `drizzle`. It also holds database-level
`CREATE`, because Drizzle's migrator issues an unconditional
`CREATE SCHEMA IF NOT EXISTS` and PostgreSQL checks that privilege even when
the schema already exists. This is a deliberate trade-off: the migrator can
create additional schemas in this database, but not databases, roles,
replication, or row-level-security bypass. See ADR-0006.

### Journal schema and table

```text
schema: drizzle
table:  __drizzle_migrations_core
```

A dedicated table name keeps the Core history separate from any future domain
journal. The journal stores each applied migration's SHA-256 hash and its
ordering timestamp.

## Generating SQL migrations

Generation is offline and never touches a database.

1. Add or change tables in `packages/database/src/schema/core.ts`.
2. Generate:

```bash
bun run --cwd packages/database db:generate
# or, with an explicit name:
bun run --cwd packages/database drizzle-kit generate --custom --name describe_change
```

3. **Format the generated output.** Drizzle writes its metadata JSON without
   running the repository formatter, and `bun run format:check` is a CI gate:

```bash
bun run format
```

4. **Review the generated SQL before it is ever applied.**

```bash
cat packages/database/migrations/core/0001_describe_change.sql
git diff -- packages/database/migrations/core
```

Rules for generation:

- Never apply SQL to a live database during generation.
- Never delete or edit an existing migration file.
- Never hand-write a `meta/_journal.json` entry.
- Never create dummy business tables to force a migration.
- If generation produces unexpected files, stop and inspect the output.

## Reviewing generated SQL

Every generated file is reviewed as ordinary SQL. Check that it:

- touches only the `core` schema (or the journal, which Drizzle manages);
- creates no tenant, user, role, organization, commerce, clinic, restaurant,
  payment, appointment, or customer table without an approved task;
- seeds no business data;
- interpolates no user input and contains no secret;
- is compatible with the Expand–Migrate–Contract pattern.

## Checking pending migrations

Read-only. It creates nothing, takes no lock, and applies nothing:

```bash
bun run --cwd packages/database db:status
```

Expected output on a provisioned, migrated database:

```text
Target:        business_os_local
Host:          127.0.0.1:55432
Connected role: business_os_migrator
PostgreSQL:    18.6 (Debian 18.6-1.pgdg12+2)
Journal:       drizzle.__drizzle_migrations_core
Version match: yes
Role permitted: yes
Migration files on disk: 1
Journal state: INITIALIZED
Applied migrations: 1
Pending migrations: 0
Latest applied: 1791746656574
Journal consistency: OK
Note: this reports migration-history and migration-file integrity only. It does not compare the live database schema against the migrations.
```

On a database that has not been migrated, it reports
`Journal state: UNINITIALIZED (no journal table)` and **does not create one**.

## Applying a local migration

```bash
bun run --cwd packages/database db:apply -- --apply
```

or directly:

```bash
bun run packages/database/tools/migrations/apply-local.ts --apply
```

The runner:

1. validates the environment is `local`, the host is `127.0.0.1`, and the
   database is `business_os_local`;
2. refuses application-role, administrator, and superuser credentials, and any
   role with inherited memberships;
3. refuses any PostgreSQL major version other than 18.6;
4. acquires a session advisory lock with a bounded 30-attempt wait;
5. re-checks journal consistency and **fails closed** on any inconsistency;
6. applies pending migrations in a single transaction;
7. releases the lock and every connection in `finally`.

Without `--apply` it refuses and changes nothing.

It never runs at application startup, at connection creation, at package
import, or during `bun install`.

## Verifying migration state

```bash
bun run --cwd packages/database db:status
```

Then confirm directly if needed:

```bash
docker exec business-os-local-postgres-1 psql -U business_os_local -d business_os_local \
  -c '\dt drizzle.*'
```

## Running the real integration tests

The integration suite is **opt-in** and creates its own disposable PostgreSQL
18.6 container on a random loopback port.

```bash
FND011_INTEGRATION_TESTS=true bun test packages/database/test/migration-integration.test.mjs
```

Without the flag the suite reports **SKIPPED** and the ordinary `bun run test`
passes with no database. Mock results are never substituted for real
verification.

The suite uses `--tmpfs` for the data directory, so it creates **no Docker
volume**, and removes only the container it started. It never touches the
`business-os-local` Compose project or the `business_os_postgres_data` volume.
Never run `docker compose down -v` against that project.

## Recovering from a failure

Drizzle applies all pending migrations inside **one transaction**. A failure
rolls the whole batch back, including the journal insert, so a failed migration
is never recorded as applied.

1. Read the failure. Only a SQLSTATE and a sanitized message are printed:

```text
Migration failed. The transaction was rolled back, so no migration was recorded as applied. [SQLSTATE 42601]
```

2. Confirm nothing was recorded:

```bash
bun run --cwd packages/database db:status
```

3. Fix the migration **forward**. There are no down migrations, and an
   application rollback does not restore a schema.
4. Re-run with `--apply`.

Do not attempt to reverse a partially applied batch by hand, and do not delete
journal rows.

**DDL is not universally reversible inside a transaction.** Statements such as
`CREATE DATABASE` cannot run inside one at all. Do not assume every migration
is transactionally safe; review the SQL.

## Handling concurrent execution

Two concurrent `db:apply` runs are safe. One acquires the advisory lock; the
other waits with a bounded retry and then finds nothing pending.

```text
Target ... Applying 1 pending migration(s)...     # winner
No pending migrations. Database is up to date.   # loser, after the lock
```

If the lock cannot be taken within 30 attempts the run stops with:

```text
Could not acquire the migration lock within 30 attempts; another migration is in progress.
```

That is a bounded failure, not a hang. No duplicate journal entries and no
duplicate execution are possible. Never "fix" this by removing the lock.

## Detecting history inconsistencies

Both the status command and the runner detect:

| Finding | Meaning | Action |
| --- | --- | --- |
| `MISSING_MIGRATION_FILE` | A recorded migration has no file | Restore the file from Git. Never edit it. |
| `MODIFIED_MIGRATION_FILE` | Content no longer matches the recorded hash | Restore from Git and investigate the modification. |
| `DUPLICATE_JOURNAL_ROW` | The journal records one timestamp twice | Investigate manually; never edit the journal by hand. |

The runner refuses to apply while any finding exists. Inconsistent history is
never repaired automatically.

## Known drift-detection limitations

Be precise about what is and is not verified:

- **Verified:** the journal is internally consistent, and every migration file
  on disk matches its recorded SHA-256 hash.
- **Not verified:** that the live database schema matches what the migrations
  would produce.

A clean status report means the history and files agree. It does **not** prove
the schema is correct. Drift introduced by hand — or by any tool that bypassed
the journal — is not detected by this system.

Also note that Drizzle compares only the newest journal row, so a gap in the
middle of the history is not reported as pending, because the migrator would
not run it either. Such a gap surfaces only if it also appears as a hash
mismatch or a missing file.

## Expand–Migrate–Contract

For any future evolving schema, never change a live column in one step.

1. **Expand** — add the new column or structure alongside the old one. Both are
   valid; nothing breaks.
2. **Migrate** — backfill in bounded batches, outside the schema transaction.
3. **Cut over** — switch reads and writes to the new structure.
4. **Contract** — remove the old structure in a later, separate migration.

Structural migrations carry no business seed data. Backfills are data work and
belong to a separately approved task.

## Versioned migration rules

- No mutation of already-applied migration files.
- No automatic rewrite of migration history.
- No silent journal repair.
- No direct production schema synchronization; no `drizzle-kit push`.
- No destructive change without explicit approval.
- No business data seeding in structural migrations.
- No application startup migration.
- No unreviewed cross-module DDL.
- No automatic production migration.
- No admin or superuser account for normal migration execution.
- No unsafe SQL interpolation.
- No secrets in migration files.

## Future module-specific migration ownership

A future domain module gets its own migration folder, its own Drizzle config,
and its own journal table, under a separately approved task. It must not write
into `migrations/core/` and must not share the Core journal. Rule 12 forbids a
module from mutating another module's schema.

## Why automatic production migration is prohibited

Running migrations at startup turns a routine deploy into an uncontrolled DDL
event:

- Every instance races to migrate; only an advisory lock prevents damage, and
  a crash mid-migration leaves the outcome dependent on timing.
- The application role would need DDL privileges, destroying least privilege.
- A migration failure becomes an availability incident with no reviewed plan.
- The deploying actor is not necessarily the person who reviewed the SQL.

Migration is therefore a separate, explicit, human-authorized operation.

## Why runtime credentials cannot apply migrations

Runtime code handles untrusted input. If the application role could run DDL,
one compromised request path could drop a table, rewrite the journal, or
destroy every tenant's data, and row-level security would be unenforceable.
Separating the roles makes that impossible and makes the boundary testable.

## Production gates are closed

This workflow is local-only and refuses to run anywhere else by design.
Production migration requires separate approval covering:

- managed secret delivery for the migration role;
- mandatory TLS;
- a migration role scoped per environment, without the local database-level
  `CREATE` grant;
- verified backup and PITR before any run;
- a rehearsed rollback or forward-fix plan;
- an audit trail of migrations with actor and timestamp;
- removal of the loopback-only guard rails.

## Troubleshooting

**`Refusing to migrate: environment must be "local"`**
Set `BUSINESS_OS_ENV=local`. This tooling deliberately refuses staging and
production.

**`Refusing to migrate: host must be 127.0.0.1`**
A remote host is never a migration target. This is a safety refusal, not a bug.

**`Refusing to migrate: the connected role is a superuser`**
You pointed the migrator at `business_os_local`. Provision a dedicated
`business_os_migrator` and use those credentials.

**`Could not acquire the migration lock within 30 attempts`**
Another migration is running or a previous one left a session open. Check for
a stuck process; do not remove the lock.

**`Refusing to apply migrations: the migration journal is inconsistent`**
Read the findings from `db:status`, restore the affected file from Git, and
never edit the journal by hand.

**`Environment configuration error: BUSINESS_OS_DB_MIGRATOR_PASSWORD (MISSING_REQUIRED_VALUE)`**
The variable is not set. Add it to `.env`.

**`password authentication failed for user "business_os_migrator"`**
The password in `.env` does not match the role. Provisioning does not reset an
existing password by design.

**Journal is UNINITIALIZED after applying**
Provisioning did not run, or it ran against a different database. Run
`provision-local-role.ts`, then apply again.
