/**
 * Read-only local migration status inspector.
 *
 * This command answers "what does the migration journal say?" and never
 * changes anything. It creates no schema, no table, and no journal; it
 * takes no advisory lock that would require schema mutation; and it
 * applies no migration. When the journal is missing it reports a clear
 * uninitialized state instead of creating the table to look at it.
 *
 * The support functions it shares with the runner are imported from
 * `apply-local.ts`, so the inspector and the runner are guaranteed to
 * read the journal through one implementation and can never disagree
 * about what counts as pending.
 *
 * @see docs/runbooks/database-migrations.md
 */

import { parseDatabaseConfig } from "../../src/index.js";
import { EnvironmentConfigError, parseLocalMigrationEnvironment } from "@business-os/configuration";
import { readMigrationFiles } from "drizzle-orm/migrator";
import pg from "pg";

import {
  EXPECTED_SERVER_VERSION,
  JOURNAL_SCHEMA,
  JOURNAL_TABLE,
  MIGRATIONS_FOLDER,
  assertLocalMigrationTarget,
  assertMigrationRolePermitted,
  classifyJournalIntegrity,
  MigrationGuardError,
  journalExists,
  readConnectedIdentity,
} from "./apply-local.js";

const { Pool } = pg;

/** Read the journal. Assumes the caller already confirmed it exists. */
async function readJournal(client: pg.PoolClient): Promise<{ createdAt: string; hash: string }[]> {
  const result = await client.query<{ created_at: string; hash: string }>(
    `select created_at, hash from ${JOURNAL_SCHEMA}.${JOURNAL_TABLE} order by created_at desc`,
  );

  return result.rows.map((row) => ({ createdAt: row.created_at, hash: row.hash }));
}

/** Read the version-controlled migration files without touching the database. */
function readLocalMigrationFiles(): { folderMillis: number; hash: string }[] {
  return readMigrationFiles({
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsTable: JOURNAL_TABLE,
    migrationsSchema: JOURNAL_SCHEMA,
  }).map((migration) => ({ folderMillis: migration.folderMillis, hash: migration.hash }));
}

async function main(): Promise<void> {
  const config = parseLocalMigrationEnvironment(process.env);

  assertLocalMigrationTarget({
    host: config.database.host,
    database: config.database.database,
    environment: config.environment,
    ssl: config.database.ssl,
  });

  const poolConfig = parseDatabaseConfig({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl,
    maxPoolSize: 1,
    connectionTimeoutMs: 10_000,
  });

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

    const state =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;

    process.stderr.write(
      `Could not connect to the local database with the migrator role.${
        state === undefined ? "" : ` [SQLSTATE ${state}]`
      }\n`,
    );
    process.exit(1);
  }

  try {
    const identity = await readConnectedIdentity(client);

    process.stdout.write(`Target:        ${identity.database}\n`);
    process.stdout.write(`Host:          ${poolConfig.host}:${poolConfig.port}\n`);
    process.stdout.write(`Connected role: ${identity.roleName}\n`);
    process.stdout.write(`PostgreSQL:    ${identity.serverVersion}\n`);
    process.stdout.write(`Journal:       ${JOURNAL_SCHEMA}.${JOURNAL_TABLE}\n`);
    process.stdout.write(
      `Version match: ${
        identity.serverVersion.startsWith(EXPECTED_SERVER_VERSION)
          ? "yes"
          : `NO (expected ${EXPECTED_SERVER_VERSION})`
      }\n`,
    );

    // The inspector reports; it does not refuse. A role problem is a
    // finding to display, not a reason to hide the rest of the state.
    try {
      assertMigrationRolePermitted(identity.attributes, config.database.user);
      process.stdout.write("Role permitted: yes\n");
    } catch (error) {
      process.stdout.write(
        `Role permitted: NO (${error instanceof Error ? error.message : "unknown"})\n`,
      );
    }

    const local = readLocalMigrationFiles();
    process.stdout.write(`Migration files on disk: ${local.length}\n`);

    if (!(await journalExists(client))) {
      process.stdout.write("Journal state: UNINITIALIZED (no journal table)\n");
      process.stdout.write(`Pending migrations: ${local.length}\n`);
      process.stdout.write(
        "Run the privileged provisioning, then apply with --apply, to initialize the journal.\n",
      );
      return;
    }

    const rows = await readJournal(client);
    const report = classifyJournalIntegrity(local, rows);

    process.stdout.write("Journal state: INITIALIZED\n");
    process.stdout.write(`Applied migrations: ${report.appliedCount}\n`);
    process.stdout.write(`Pending migrations: ${report.pendingCount}\n`);
    process.stdout.write(
      `Latest applied: ${
        report.latestAppliedMillis === null ? "none" : String(report.latestAppliedMillis)
      }\n`,
    );

    if (report.problems.length === 0) {
      process.stdout.write("Journal consistency: OK\n");
    } else {
      process.stdout.write(`Journal consistency: ${report.problems.length} problem(s)\n`);

      for (const problem of report.problems) {
        process.stdout.write(`  [${problem.kind}] ${problem.detail}\n`);
      }
    }

    process.stdout.write(
      "Note: this reports migration-history and migration-file integrity only. " +
        "It does not compare the live database schema against the migrations.\n",
    );
  } finally {
    client.release();
    await pool.end();
  }
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    const message =
      error instanceof MigrationGuardError || error instanceof EnvironmentConfigError
        ? error.message
        : "unexpected error";

    process.stderr.write(`Status inspection failed: ${message}\n`);
    process.exit(1);
  });
}
