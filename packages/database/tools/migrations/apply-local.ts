/**
 * Safe local Core migration runner.
 *
 * This is an explicit, local-only administrative command. It is never
 * invoked by application startup, by connection creation, by package
 * import, or by `bun install`, and it refuses every runtime other than
 * `local`.
 *
 * Concurrency is protected by a PostgreSQL *session-level* advisory lock
 * acquired on the same pinned connection that then runs the migrations.
 * Acquiring the lock on one pooled connection while running Drizzle on
 * unrelated pool sessions would provide no protection at all, so the
 * migrator is given a single `PoolClient` rather than a pool.
 *
 * This module also owns the migration support functions that
 * `status-local.ts` reuses, which keeps the runner and the read-only
 * inspector reading the same journal through one implementation.
 *
 * @see docs/adr/0006-database-migration-governance.md
 * @see docs/runbooks/database-migrations.md
 */

import { parseDatabaseConfig } from "../../src/index.js";
import type { ValidatedDatabaseConfig } from "../../src/index.js";
import { EnvironmentConfigError, parseLocalMigrationEnvironment } from "@business-os/configuration";
import type { LocalMigrationEnvironmentConfig } from "@business-os/configuration";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

/** Loopback only. A migration target is never a remote host. */
export const EXPECTED_LOCAL_HOST = "127.0.0.1";

/** The single approved local development database. */
export const EXPECTED_LOCAL_DATABASE = "business_os_local";

/** Major version the migration tooling is written and reviewed against. */
export const EXPECTED_SERVER_VERSION = "18.6";

/** Migration journal location. Shared with drizzle.config.ts. */
export const JOURNAL_SCHEMA = "drizzle";
export const JOURNAL_TABLE = "__drizzle_migrations_core";

/** Repository-relative Core migration folder. */
export const MIGRATIONS_FOLDER = new URL("../../migrations/core/", import.meta.url).pathname;

/**
 * Advisory lock identity.
 *
 * Two 32-bit integers avoid the JavaScript precision limit that a 64-bit
 * lock key would hit. The class id is `'BS'` in ASCII (0x4253); the
 * object id reserves one lock per migration set, so Core (1) and any
 * future domain set can be locked independently or together later.
 */
export const ADVISORY_LOCK_CLASS_ID = 16_979;
export const ADVISORY_LOCK_OBJECT_ID = 1;

/** Bounded wait for the advisory lock: 30 attempts, 1s apart, ~30s total. */
export const LOCK_MAX_ATTEMPTS = 30;
export const LOCK_RETRY_DELAY_MS = 1_000;

/** Roles that may never be used to apply a migration. */
export const FORBIDDEN_MIGRATION_ROLES = Object.freeze([
  "business_os_app",
  "business_os_local",
  "postgres",
]);

// ---------------------------------------------------------------------------
// Pure, testable support functions
// ---------------------------------------------------------------------------

/**
 * Reject any target that is not the approved loopback development
 * database.
 *
 * A migration command pointed at a remote host, or at a database other
 * than the local development one, could mutate an environment that was
 * never authorized for migration. The check is structural rather than a
 * warning, because the cost of being wrong is a mutated database.
 */
export function assertLocalMigrationTarget(settings: {
  readonly host: string;
  readonly database: string;
  readonly environment: string;
  readonly ssl: boolean;
}): void {
  if (settings.environment !== "local") {
    throw new MigrationGuardError(
      `Refusing to migrate: environment must be "local", found "${settings.environment}".`,
    );
  }

  if (settings.host !== EXPECTED_LOCAL_HOST) {
    throw new MigrationGuardError(
      `Refusing to migrate: host must be ${EXPECTED_LOCAL_HOST}; a remote database is never a migration target.`,
    );
  }

  if (settings.database !== EXPECTED_LOCAL_DATABASE) {
    throw new MigrationGuardError(
      `Refusing to migrate: database must be ${EXPECTED_LOCAL_DATABASE}.`,
    );
  }

  if (settings.ssl) {
    // Loopback plaintext is the deliberate local exception. TLS being
    // enabled here would mean the target is not the expected local one.
    throw new MigrationGuardError(
      "Refusing to migrate: the local loopback target is expected to run without TLS.",
    );
  }
}

/** Structural guard failure. Carries no credential or connection detail. */
export class MigrationGuardError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "MigrationGuardError";
  }
}

/** Role attributes read from `pg_roles` for the connected principal. */
export interface ConnectedRoleAttributes {
  readonly roleName: string;
  readonly canLogin: boolean;
  readonly superuser: boolean;
  readonly createDb: boolean;
  readonly createRole: boolean;
  readonly replication: boolean;
  readonly bypassRls: boolean;
  readonly memberOf: readonly string[];
}

/**
 * Reject a connection that must not be used to apply migrations.
 *
 * A superuser would bypass every privilege boundary the platform
 * depends on; the application role is explicitly denied DDL; and the
 * bootstrap administrator exists to provision roles, not to run every
 * migration. A migrator that is a member of any other role could
 * inherit exactly the authority this check exists to remove.
 */
export function assertMigrationRolePermitted(
  attributes: ConnectedRoleAttributes,
  expectedRole: string,
): void {
  if (attributes.roleName !== expectedRole) {
    throw new MigrationGuardError(
      `Refusing to migrate: connected as "${attributes.roleName}" but the migration role must be "${expectedRole}".`,
    );
  }

  if (FORBIDDEN_MIGRATION_ROLES.includes(attributes.roleName)) {
    throw new MigrationGuardError(
      `Refusing to migrate: "${attributes.roleName}" is not permitted to apply migrations.`,
    );
  }

  if (attributes.superuser) {
    throw new MigrationGuardError("Refusing to migrate: the connected role is a superuser.");
  }

  if (attributes.createDb) {
    throw new MigrationGuardError("Refusing to migrate: the connected role may create databases.");
  }

  if (attributes.createRole) {
    throw new MigrationGuardError("Refusing to migrate: the connected role may create roles.");
  }

  if (attributes.replication) {
    throw new MigrationGuardError("Refusing to migrate: the connected role may replicate.");
  }

  if (attributes.bypassRls) {
    throw new MigrationGuardError(
      "Refusing to migrate: the connected role may bypass row-level security.",
    );
  }

  if (!attributes.canLogin) {
    throw new MigrationGuardError("Refusing to migrate: the connected role cannot log in.");
  }

  if (attributes.memberOf.length > 0) {
    throw new MigrationGuardError(
      `Refusing to migrate: the migration role inherits membership of ${attributes.memberOf.length} other role(s).`,
    );
  }
}

/** Fail unless the server reports the reviewed major version. */
export function assertExpectedServerVersion(reported: string): void {
  if (!reported.startsWith(EXPECTED_SERVER_VERSION)) {
    throw new MigrationGuardError(
      `Refusing to migrate: expected PostgreSQL ${EXPECTED_SERVER_VERSION}, found "${reported}".`,
    );
  }
}

/** A version-controlled migration file as read from disk. */
export interface LocalMigration {
  readonly folderMillis: number;
  readonly hash: string;
}

/** A row of the migration journal as read from PostgreSQL. */
export interface JournalRow {
  readonly createdAt: string | number;
  readonly hash: string;
}

export type MigrationIntegrityProblemKind =
  | "MISSING_MIGRATION_FILE"
  | "MODIFIED_MIGRATION_FILE"
  | "DUPLICATE_JOURNAL_ROW";

export interface MigrationIntegrityProblem {
  readonly kind: MigrationIntegrityProblemKind;
  readonly folderMillis: number | null;
  readonly detail: string;
}

/**
 * A comparison of the local migration files against the journal.
 *
 * These are three genuinely different questions and are reported
 * separately: whether a migration was recorded as applied, whether the
 * recorded file still matches the file on disk, and whether the actual
 * database schema matches what the migrations would produce. This
 * function answers the first two only. It does **not** inspect the live
 * schema, so a successful result must never be reported as proof that
 * no schema drift exists.
 */
export interface MigrationIntegrityReport {
  readonly appliedCount: number;
  readonly pendingCount: number;
  readonly latestAppliedMillis: number | null;
  readonly latestPendingMillis: number | null;
  readonly problems: readonly MigrationIntegrityProblem[];
}

/**
 * Compare local migration files against the recorded journal.
 *
 * "Pending" deliberately mirrors the migrator's own rule exactly: it
 * applies every local migration whose timestamp is greater than the
 * newest applied one. Using a different definition here would let the
 * inspector and the runner disagree about what is outstanding.
 */
export function classifyJournalIntegrity(
  localMigrations: readonly LocalMigration[],
  appliedRows: readonly JournalRow[],
): MigrationIntegrityReport {
  const problems: MigrationIntegrityProblem[] = [];

  const applied = [...appliedRows]
    .map((row) => ({ millis: Number(row.createdAt), hash: row.hash }))
    .sort((a, b) => a.millis - b.millis);

  const seenMillis = new Set<number>();

  for (const row of applied) {
    if (seenMillis.has(row.millis)) {
      problems.push({
        kind: "DUPLICATE_JOURNAL_ROW",
        folderMillis: row.millis,
        detail: `The journal records ${row.millis} more than once.`,
      });
      continue;
    }

    seenMillis.add(row.millis);

    const local = localMigrations.find((migration) => migration.folderMillis === row.millis);

    if (local === undefined) {
      problems.push({
        kind: "MISSING_MIGRATION_FILE",
        folderMillis: row.millis,
        detail:
          "A migration recorded as applied has no matching file on disk. " +
          "An applied migration file must never be deleted.",
      });
      continue;
    }

    if (local.hash !== row.hash) {
      problems.push({
        kind: "MODIFIED_MIGRATION_FILE",
        folderMillis: row.millis,
        detail:
          "A migration file on disk no longer matches its recorded hash. " +
          "An applied migration file must never be modified.",
      });
    }
  }

  const latestAppliedMillis =
    applied.length === 0 ? null : (applied[applied.length - 1]?.millis ?? null);

  // Identical selection rule to drizzle's migrator.
  const pending =
    latestAppliedMillis === null
      ? [...localMigrations]
      : localMigrations.filter((migration) => migration.folderMillis > latestAppliedMillis);

  return Object.freeze({
    appliedCount: applied.length,
    pendingCount: pending.length,
    latestAppliedMillis,
    latestPendingMillis:
      pending.length === 0 ? null : (pending[pending.length - 1]?.folderMillis ?? null),
    problems: Object.freeze(problems),
  });
}

/**
 * Require an explicit opt-in before any DDL is attempted.
 *
 * An absent or unrecognized flag is a refusal rather than a default, so
 * running the command without reading it can never migrate anything.
 */
export function assertApplyConfirmed(argv: readonly string[]): void {
  const known = new Set(["--apply", "--help", "-h"]);

  for (const argument of argv) {
    if (!known.has(argument)) {
      throw new MigrationGuardError(
        `Unrecognized argument "${argument}". Use --apply to confirm, or --help.`,
      );
    }
  }

  if (!argv.includes("--apply")) {
    throw new MigrationGuardError(
      "Refusing to apply migrations without an explicit --apply confirmation.",
    );
  }
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

/** SQLSTATE of a PostgreSQL error, or undefined for non-database errors. */
export function sqlstateOf(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

/** Report a failure without ever echoing a credential or a raw message. */
function fail(message: string, error?: unknown): never {
  const state = error === undefined ? undefined : sqlstateOf(error);

  process.stderr.write(`${message}${state === undefined ? "" : ` [SQLSTATE ${state}]`}\n`);
  process.exit(1);
}

/**
 * Read the ambient environment and validate it.
 *
 * This is the only place in the migration tooling that touches the
 * process environment. The parser itself stays pure, so a secret is
 * never captured at import time.
 */
export function readMigrationEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): LocalMigrationEnvironmentConfig {
  return parseLocalMigrationEnvironment(source);
}

/** Validate migrator settings and produce a database pool configuration. */
export function toPoolConfig(config: LocalMigrationEnvironmentConfig): ValidatedDatabaseConfig {
  assertLocalMigrationTarget({
    host: config.database.host,
    database: config.database.database,
    environment: config.environment,
    ssl: config.database.ssl,
  });

  return parseDatabaseConfig({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl,
    maxPoolSize: 1,
    connectionTimeoutMs: 10_000,
    idleTimeoutMs: 10_000,
  });
}

/** Read the connected identity and the connected role's attributes. */
export async function readConnectedIdentity(client: pg.PoolClient): Promise<{
  roleName: string;
  database: string;
  serverVersion: string;
  attributes: ConnectedRoleAttributes;
}> {
  const identity = await client.query<{
    role_name: string;
    database: string;
    server_version: string;
  }>(
    "select current_user as role_name, current_database() as database, current_setting('server_version') as server_version",
  );

  const row = identity.rows[0];

  if (row === undefined) {
    throw new MigrationGuardError("Could not read the connected database identity.");
  }

  const attributes = await client.query<{
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
    rolcanlogin: boolean;
  }>(
    `select rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
       from pg_roles where rolname = current_user`,
  );

  const roleRow = attributes.rows[0];

  if (roleRow === undefined) {
    throw new MigrationGuardError("Could not read the connected role attributes.");
  }

  const memberships = await client.query<{ member_of: string }>(
    `select pg_get_userbyid(m.roleid) as member_of
       from pg_auth_members m
      where m.member = (select oid from pg_roles where rolname = current_user)`,
  );

  return {
    roleName: row.role_name,
    database: row.database,
    serverVersion: row.server_version,
    attributes: {
      roleName: row.role_name,
      canLogin: roleRow.rolcanlogin,
      superuser: roleRow.rolsuper,
      createDb: roleRow.rolcreatedb,
      createRole: roleRow.rolcreaterole,
      replication: roleRow.rolreplication,
      bypassRls: roleRow.rolbypassrls,
      memberOf: memberships.rows.map((entry) => entry.member_of),
    },
  };
}

/**
 * True when the journal table exists.
 *
 * `to_regclass` returns NULL instead of raising, so an absent journal can
 * be detected without creating anything.
 */
export async function journalExists(client: pg.PoolClient): Promise<boolean> {
  const result = await client.query<{ present: string | null }>(
    "select to_regclass($1)::text as present",
    [`${JOURNAL_SCHEMA}.${JOURNAL_TABLE}`],
  );

  return result.rows[0]?.present != null;
}

/** Read the journal without creating it. Never repairs or mutates it. */
export async function readJournalRows(client: pg.PoolClient): Promise<JournalRow[]> {
  const result = await client.query<{ created_at: string; hash: string }>(
    `select created_at, hash from ${JOURNAL_SCHEMA}.${JOURNAL_TABLE} order by created_at desc`,
  );

  return result.rows.map((row) => ({ createdAt: row.created_at, hash: row.hash }));
}

/**
 * Read the journal, treating "not created yet" as an empty history.
 *
 * On a freshly provisioned database the journal does not exist until the
 * migrator creates it, so reading it unconditionally would fail before
 * any migration could run. Nothing is created here.
 */
export async function readJournalIfPresent(client: pg.PoolClient): Promise<JournalRow[]> {
  if (!(await journalExists(client))) {
    return [];
  }

  return readJournalRows(client);
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Acquire the session advisory lock with a bounded wait.
 *
 * A bounded `try` loop is used instead of a blocking lock so a stuck
 * peer produces a clear failure instead of an unbounded hang. The lock
 * is taken on `client`, so it is bound to the session that will run the
 * migrations.
 */
export async function acquireAdvisoryLock(client: pg.PoolClient): Promise<void> {
  for (let attempt = 1; attempt <= LOCK_MAX_ATTEMPTS; attempt += 1) {
    const result = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock($1::int, $2::int) as acquired",
      [ADVISORY_LOCK_CLASS_ID, ADVISORY_LOCK_OBJECT_ID],
    );

    if (result.rows[0]?.acquired === true) {
      return;
    }

    if (attempt < LOCK_MAX_ATTEMPTS) {
      await sleep(LOCK_RETRY_DELAY_MS);
    }
  }

  throw new MigrationGuardError(
    `Could not acquire the migration lock within ${LOCK_MAX_ATTEMPTS} attempts; another migration is in progress.`,
  );
}

/** Release the advisory lock, tolerating an already-released session. */
export async function releaseAdvisoryLock(client: pg.PoolClient): Promise<void> {
  await client.query("select pg_advisory_unlock($1::int, $2::int)", [
    ADVISORY_LOCK_CLASS_ID,
    ADVISORY_LOCK_OBJECT_ID,
  ]);
}

/** Read the version-controlled migration files from disk. */
export function readLocalMigrations(): LocalMigration[] {
  return readMigrationFiles({
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsTable: JOURNAL_TABLE,
    migrationsSchema: JOURNAL_SCHEMA,
  }).map((migration) => ({ folderMillis: migration.folderMillis, hash: migration.hash }));
}

async function main(): Promise<void> {
  const config = readMigrationEnvironment(process.env);
  const poolConfig = toPoolConfig(config);
  const pool = new Pool({
    host: poolConfig.host,
    port: poolConfig.port,
    database: poolConfig.database,
    user: poolConfig.user,
    password: poolConfig.password,
    ssl: poolConfig.ssl,
    max: 1,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMs,
  });

  let client: pg.PoolClient | undefined;

  try {
    client = await pool.connect();
  } catch (error) {
    await pool.end();
    fail("Could not connect to the local database with the migrator role.", error);
  }

  let locked = false;

  try {
    const identity = await readConnectedIdentity(client);

    process.stdout.write(
      `Target ${identity.database} on ${poolConfig.host}:${poolConfig.port} as ${identity.roleName}\n`,
    );
    process.stdout.write(`PostgreSQL ${identity.serverVersion}\n`);

    assertExpectedServerVersion(identity.serverVersion);
    assertMigrationRolePermitted(identity.attributes, config.database.user);

    await acquireAdvisoryLock(client);
    locked = true;

    const report = classifyJournalIntegrity(
      readLocalMigrations(),
      await readJournalIfPresent(client),
    );

    for (const problem of report.problems) {
      process.stderr.write(`Journal integrity problem [${problem.kind}]: ${problem.detail}\n`);
    }

    // Fail closed. An inconsistent history is never repaired silently,
    // because "repairing" it would decide that recorded history is
    // wrong without anyone reviewing that decision.
    if (report.problems.length > 0) {
      throw new MigrationGuardError(
        "Refusing to apply migrations: the migration journal is inconsistent with the migration files.",
      );
    }

    if (report.pendingCount === 0) {
      process.stdout.write("No pending migrations. Database is up to date.\n");
      return;
    }

    process.stdout.write(`Applying ${report.pendingCount} pending migration(s)...\n`);

    // The migrator runs on the same pinned session that holds the lock.
    const db = drizzle({ client });

    await migrate(db, {
      migrationsFolder: MIGRATIONS_FOLDER,
      migrationsTable: JOURNAL_TABLE,
      migrationsSchema: JOURNAL_SCHEMA,
    });

    process.stdout.write(`Applied ${report.pendingCount} migration(s).\n`);
  } catch (error) {
    if (error instanceof MigrationGuardError) {
      fail(error.message);
    }

    fail(
      "Migration failed. The transaction was rolled back, so no migration was recorded as applied.",
      error,
    );
  } finally {
    if (client !== undefined && locked) {
      try {
        await releaseAdvisoryLock(client);
      } catch {
        // Releasing the pool connection ends the session, which releases
        // any session-level lock the server still holds.
      }

      client.release();
    }

    await pool.end();
  }
}

if (import.meta.main) {
  try {
    assertApplyConfirmed(process.argv.slice(2));
    await main();
  } catch (error) {
    if (error instanceof MigrationGuardError) {
      fail(error.message);
    }

    // A rejected environment is a configuration failure, not a database
    // failure. Its message is already sanitized to a variable name and a
    // stable code, so it is safe and clearer to surface verbatim. The
    // generic branch below would misreport it as a SQLSTATE.
    if (error instanceof EnvironmentConfigError) {
      fail(error.message);
    }

    fail("Migration aborted.", error);
  }
}
