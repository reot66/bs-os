# ADR-0006 — Database Migration Governance

Status: Accepted for FND-011

## Context

FND-007 established `@business-os/database` with an explicit, caller-owned
connection factory and deliberately created no tables. Its own source comment
recorded that "a later schema task will supply the schema type parameter".
ADR-0002 confirmed Drizzle ORM with `pg`, and stated that FND-007 installs no
`drizzle-kit`, describing Drizzle Kit with versioned SQL files and a separate
migration role as an *intention* for a later approved task.

Rule 12 requires versioned migrations, Expand–Migrate–Contract for large
changes, and forbids one module from mutating another module's schema. D-044
separates Core schema ownership from Module schema ownership. Rule 06 requires
the runtime database user not to be a superuser. Rule 17 requires lockfile
pinned, reviewed dependencies. ADR-0001 and ADR-0002 fix Bun as the only
runtime.

D-063 additionally requires **real PostgreSQL integration tests**, which the CI
workflow does not and must not yet provide.

The owner approved the **Advanced** capability level for FND-011.

### What the installed framework actually does

The behaviour of `drizzle-orm@0.45.4`'s PostgreSQL migrator was read from the
installed package rather than assumed, and it constrains several decisions:

- `dialect.migrate()` unconditionally issues `CREATE SCHEMA IF NOT EXISTS`
  before touching the journal.
- It reads only the **newest** journal row (`order by created_at desc limit 1`)
  and applies every local migration whose timestamp is greater than that one.
  It performs no checksum comparison of its own.
- It runs all pending migrations inside a **single transaction**. A failure
  rolls the whole batch back, including the journal insert.
- `CREATE SCHEMA` and `CREATE TABLE` for the journal run **outside** that
  transaction.

## Decision

### Migration engine

Use **Drizzle Kit `0.31.11`** with Drizzle ORM `0.45.4`.

`0.31.11` is the current stable `latest` tag. Every `1.0.0-*` published version
is a prerelease and is excluded. `0.31.11` was published alongside
`drizzle-orm@0.45.3`; `0.45.4` is a later patch of the same minor line.
`drizzle-kit@0.31.11` declares **no `peerDependencies`**, so it cannot conflict
with the pinned ORM version. The dependency is pinned exactly, with no range,
consistent with every other dependency in this repository.

No second ORM or migration framework is introduced. Prisma, Knex, Sequelize,
and TypeORM remain rejected, and `drizzle-orm` is not upgraded by this task.

### Migration file format

Version-controlled SQL plus Drizzle's own metadata, under
`packages/database/migrations/core/`:

```text
migrations/core/
├── 0000_baseline_core_schema.sql
└── meta/
    ├── _journal.json
    └── 0000_snapshot.json
```

`drizzle-kit generate` is the only supported way to create these files.
Journal entries are never hand-written. Generation is a purely offline
operation: `drizzle.config.ts` deliberately declares **no `dbCredentials`**, so
generation can never connect to or modify a database.

`drizzle-kit push` is prohibited because it diffs and mutates a live schema
without a reviewed SQL file. `drizzle-kit migrate` is not used because it takes
its connection from the config file, which would place credentials in a
committed source file and would bypass the advisory lock.

### Core migration ownership

The Core migration set is the only one that exists. Future domain migration
sets require separately approved ownership and their own config and journal;
nothing is pre-created for them, and `migrations/core/` must not become a mixed
directory.

### Journal

- Schema: `drizzle`
- Table: `__drizzle_migrations_core`

A dedicated table name keeps the Core history unambiguous and prevents it from
being confused with a future domain journal. The runner and the status
inspector read it through one shared implementation, so they can never disagree
about what is pending.

### Migrator role

`business_os_migrator`, created by the local bootstrap administrator and
separate from both the runtime application role and the administrator account.

Attributes: `LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION
NOBYPASSRLS`, with **no role memberships**.

It owns exactly two schemas, `core` and `drizzle`.

**Database-level CREATE is granted, and this is a deliberate, verified
trade-off.** Drizzle's migrator issues `CREATE SCHEMA IF NOT EXISTS`
unconditionally, and PostgreSQL checks database-level `CREATE` *before* it
decides whether the schema already exists. This was confirmed empirically: with
the schema present and owned by the migrator, `CREATE SCHEMA IF NOT EXISTS
drizzle` still fails with SQLSTATE 42501 without that grant. The alternatives
were evaluated:

| Alternative | Outcome |
| --- | --- |
| Grant/revoke database CREATE around each run | Racy and fragile; leaves a window of excess privilege |
| Replace `dialect.migrate()` with hand-written SQL | Rejected: a competing homegrown migration engine |
| Grant database CREATE permanently | **Chosen**, asserted explicitly and documented here |

The residual capability is that the migrator can create additional schemas in
this database. It still cannot create databases, create roles, replicate,
bypass row-level security, or write into `public`. This role is local-only and
is not acceptable as a production role.

### Application role isolation

`business_os_app` is unchanged and receives no new privilege. It has no `CREATE`
on `core` or `drizzle`, no membership in the migrator role, and no ability to
alter or drop the journal. This is verified with negative tests that connect as
the application role itself.

The bootstrap administrator provisions roles and owns the cluster. It is never
used to apply migrations.

### Concurrency

A PostgreSQL **session-level** advisory lock, taken as
`pg_try_advisory_lock(classid, objid)` with the class id `16979` (`'BS'`) and
object id `1` (the Core migration set).

Two 32-bit integers are used deliberately: a 64-bit key would exceed the exact
integer range of a JavaScript number.

The lock is acquired on a **single pinned `pg.PoolClient`**, and the Drizzle
migrator is constructed over that same client. Taking the lock on one pooled
connection while migrating through other pool sessions would provide no
protection at all, because a session-level advisory lock is only visible to its
own session.

The wait is bounded at 30 attempts of one second, so a stuck peer produces a
clear failure instead of an unbounded hang. A process-local JavaScript mutex is
not sufficient and is not used. The lock is released in `finally`, and
releasing the connection ends the session, which releases the lock even if the
explicit unlock fails.

### Idempotency and history validation

Drizzle's migrator applies a migration only when its timestamp exceeds the
newest applied one. The inspector uses **the identical rule**, so the two can
never disagree about what is outstanding.

On top of that, FND-011 adds three checks the framework does not perform,
because the journal stores a SHA-256 hash of each migration file:

- `MISSING_MIGRATION_FILE` — a recorded migration has no file on disk.
- `MODIFIED_MIGRATION_FILE` — a file's content no longer matches its recorded
  hash.
- `DUPLICATE_JOURNAL_ROW` — the journal records one timestamp twice.

The runner **fails closed** on any of these. An inconsistent history is never
repaired silently, because "repairing" it would decide that recorded history is
wrong without anyone reviewing that decision.

### Drift-detection boundaries

Three things are deliberately kept distinct and must not be conflated:

1. **Migration-history consistency** — the journal agrees with itself.
2. **Migration-file integrity** — files on disk match their recorded hashes.
3. **Actual database-schema drift** — the live schema matches the migrations.

FND-011 verifies (1) and (2). It does **not** verify (3). A successful status
report means the history and the files agree; it does **not** mean the database
schema is correct. Detecting (3) would require an independent schema
introspection and comparison mechanism, which is not implemented here. The
status command prints this limitation explicitly every time it runs.

### Local execution restrictions

Migration execution is a separate administrative operation. It never runs at
application startup, at connection creation, at package import, or during
`bun install`. The runner refuses any environment other than `local`, any host
other than `127.0.0.1`, and any database other than `business_os_local`, and it
requires an explicit `--apply`. Failures are reported by SQLSTATE only; raw
driver messages, passwords, and connection strings are never printed.

### Recovery strategy

There are no down migrations. A failed batch rolls back entirely and records
nothing, because Drizzle runs pending migrations in one transaction. Recovery
is a forward correction: review, fix, and re-run. An application rollback does
**not** restore a database schema, and this record does not promise that every
migration is transactionally reversible — PostgreSQL DDL inside a transaction
is not universally reversible, and `CREATE DATABASE`, for example, cannot run
inside one at all.

### Configuration

`BUSINESS_OS_DB_MIGRATOR_USER` and `BUSINESS_OS_DB_MIGRATOR_PASSWORD` are
registered in the central environment registry under a new `local-migration`
scope and a new `migration-credentials` group. The password is classified
sensitive there, so redaction derives from that single declaration and the
logger's registry-derived redaction keeps working automatically.

They are deliberately unreachable from both other boundaries: the runtime
parser ignores them, and the administration parser ignores them. Migration
credentials can therefore never satisfy ordinary application configuration,
and runtime or administrator credentials can never satisfy the migration
parser.

### Typechecking the tooling

Migration tooling and `drizzle.config.ts` are typechecked by
`packages/database/tsconfig.tools.json`, which the package `typecheck` script
runs in addition to the runtime config. Strictness is unchanged; the root
`typecheck` script and the FND-010-CI-FIX1 build-before-typecheck ordering are
untouched.

### Future domain migration extension

A future domain module adds its own migration folder, its own Drizzle config,
and its own journal table, under a separately approved task. It does not write
into `migrations/core/` and does not reuse the Core journal.

## Alternatives considered

### `drizzle-kit push`

Rejected. It synchronizes a live schema by diffing, with no reviewed SQL file
and no version-controlled artifact, which conflicts with rules 12 and 14 and
removes the ability to review what will run.

### `drizzle-kit migrate` for applying migrations

Rejected. It reads its connection from `drizzle.config.ts`, which would put
credentials in a committed file, and it offers no hook for the advisory lock
that serializes concurrent runs.

### Hand-written advisory locking without Drizzle

Rejected as a competing engine. The journal format and ordering semantics are
Drizzle's; reimplementing them would create two sources of truth for migration
history.

### Temporary privilege escalation

Rejected. Granting and revoking database CREATE around each run leaves a window
in which the migrator holds excess privilege and fails open if the process dies.

### Granting the migrator superuser

Rejected outright. It would collapse every privilege boundary the platform
relies on.

## Consequences

### Benefits

- Schema changes become reviewable SQL in Git with a deterministic order.
- Migration authority is unreachable from ordinary application requests.
- Concurrent runs are serialized across processes, not just within one.
- A modified or deleted migration file is detected and refused.
- Failures are atomic and leave no partial state.

### Costs and limitations

- The migrator holds database-level `CREATE` and can create extra schemas.
- Drift detection covers history and file integrity, not live schema state.
- Drizzle compares only the newest journal row, so a gap in the middle of the
  history is not reported as pending, because the migrator would not run it
  either. Such a gap is therefore only detected if it also shows up as a hash
  mismatch or a missing file.
- `drizzle-kit generate` writes a wall-clock `when` value into the journal, so
  regeneration is not byte-identical across runs. This is the framework's
  normal metadata convention.
- Generation is deterministic in file naming (`index` prefix) but not in
  timestamps.

### Future production migration gates

Production migration is **not** authorized by this record and requires separate
approval covering: managed secret delivery for the migration role, mandatory
TLS, a migration role scoped per environment, backup and PITR verification
before any run, a rehearsed rollback or forward-fix plan, an audit trail of
migrations with actor and timestamp, and removal of the local-only guard rails
that intentionally refuse anything that is not loopback `local`.

### Security trade-offs

- Least privilege is weakened in exactly one documented way (database CREATE).
- The local guard rails refuse remote targets, so this tooling cannot be pointed
  at production as written. That refusal is a safety feature, not a limitation
  to work around.
- The migration password is handled exactly like the existing application-role
  password: passed as a query parameter into a transaction-local setting and
  quoted server-side by PostgreSQL, never interpolated into a SQL string.
