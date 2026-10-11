/**
 * Local developer tool: verify the least-privilege application role.
 *
 * Run from the repository root:
 *   bun run packages/database/tools/local/verify-role.ts
 *
 * This tool performs real checks against the local PostgreSQL service.
 * It never prints a password or a full connection string, and it never
 * falls back to the bootstrap administrator for application-level tests.
 *
 * Results are reported as sanitized PASS/FAIL lines with SQLSTATE codes.
 */

import { sql } from "drizzle-orm";
import pg from "pg";

import { createDatabase, parseDatabaseConfig } from "../../src/index.js";

const { Pool } = pg;

const EXPECTED_LOCAL_HOST = "127.0.0.1";
const EXPECTED_LOCAL_DATABASE = "business_os_local";
const EXPECTED_APP_ROLE = "business_os_app";

let failures = 0;

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  release?: () => void;
};

function sqlstateOf(error: unknown): string | undefined {
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

function pass(message: string): void {
  process.stdout.write(`PASS  ${message}\n`);
}

function failCheck(message: string, error?: unknown): void {
  failures += 1;
  const state = error === undefined ? undefined : sqlstateOf(error);
  process.stderr.write(`FAIL  ${message}${state === undefined ? "" : ` [SQLSTATE ${state}]`}\n`);
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    process.stderr.write(`FAIL  Missing required environment variable: ${name}\n`);
    process.exit(1);
  }

  return value;
}

function requirePort(): number {
  const value = Number(requireEnv("BUSINESS_OS_DB_PORT"));

  if (!Number.isInteger(value) || value <= 0) {
    process.stderr.write("FAIL  BUSINESS_OS_DB_PORT is not a valid port\n");
    process.exit(1);
  }

  return value;
}

function appPoolOptions(password: string): Record<string, unknown> {
  return {
    host: EXPECTED_LOCAL_HOST,
    port: requirePort(),
    database: EXPECTED_LOCAL_DATABASE,
    user: requireEnv("BUSINESS_OS_DB_APP_USER"),
    password,
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 10_000,
  };
}

async function countApplicationTables(client: Queryable): Promise<number> {
  const result = await client.query(
    `SELECT count(*)::int AS total
       FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')`,
  );

  return Number(result.rows[0]?.total ?? -1);
}

async function checkPositiveAuthentication(appPassword: string): Promise<void> {
  const pool = new Pool(appPoolOptions(appPassword));

  try {
    const client = await pool.connect();

    try {
      const userResult = await client.query("SELECT current_user AS value");
      const currentUser = String(userResult.rows[0]?.value ?? "");

      if (currentUser === EXPECTED_APP_ROLE) {
        pass(`current_user is ${currentUser}`);
      } else {
        failCheck(`current_user should be ${EXPECTED_APP_ROLE}`);
      }

      const dbResult = await client.query("SELECT current_database() AS value");
      const currentDatabase = String(dbResult.rows[0]?.value ?? "");

      if (currentDatabase === EXPECTED_LOCAL_DATABASE) {
        pass(`current_database is ${currentDatabase}`);
      } else {
        failCheck(`current_database should be ${EXPECTED_LOCAL_DATABASE}`);
      }

      const oneResult = await client.query("SELECT 1 AS value");

      if (String(oneResult.rows[0]?.value ?? "") === "1") {
        pass("SELECT 1 returned 1");
      } else {
        failCheck("SELECT 1 did not return 1");
      }
    } finally {
      client.release();
    }
  } catch (error) {
    failCheck("Application account could not authenticate", error);
  } finally {
    await pool.end();
  }
}

async function checkDrizzleConnectivity(appPassword: string): Promise<void> {
  const config = parseDatabaseConfig({
    host: EXPECTED_LOCAL_HOST,
    port: requirePort(),
    database: EXPECTED_LOCAL_DATABASE,
    user: requireEnv("BUSINESS_OS_DB_APP_USER"),
    password: appPassword,
    ssl: false,
    maxPoolSize: 2,
    connectionTimeoutMs: 10_000,
  });

  const handle = createDatabase(config);

  try {
    await handle.ping();

    const rows = await handle.db.execute<{ value: number }>(sql`SELECT 1 AS value`);

    if (rows.rows[0]?.value === 1) {
      pass("Drizzle factory executed SELECT 1 through the pg pool");
    } else {
      failCheck("Drizzle SELECT 1 returned an unexpected value");
    }
  } catch (error) {
    failCheck("Drizzle-backed database factory could not connect", error);
  } finally {
    await handle.close();
  }
}

async function checkNegativeAuthentication(appUser: string): Promise<void> {
  const pool = new Pool(appPoolOptions("intentionally-wrong-password-verify-role"));

  try {
    const client = await pool.connect();

    try {
      await client.query("SELECT 1");
      failCheck("Application account accepted an incorrect password");
    } catch (error) {
      if (sqlstateOf(error) === "28P01") {
        pass("Incorrect password rejected (SQLSTATE 28P01)");
      } else {
        failCheck("Incorrect password failed with an unexpected SQLSTATE", error);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    if (sqlstateOf(error) === "28P01") {
      pass("Incorrect password rejected at connection time (SQLSTATE 28P01)");
    } else {
      failCheck("Negative authentication check failed unexpectedly", error);
    }
  } finally {
    await pool.end();
  }

  process.stdout.write(`      (tested user: ${appUser}, never the administrator)\n`);
}

async function checkRoleAttributes(adminClient: Queryable): Promise<void> {
  const result = await adminClient.query(
    `SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
       FROM pg_roles WHERE rolname = $1`,
    [EXPECTED_APP_ROLE],
  );

  const row = result.rows[0];

  if (row === undefined) {
    failCheck(`Role ${EXPECTED_APP_ROLE} does not exist`);
    return;
  }

  const checks: [string, boolean][] = [
    ["is not a superuser", row.rolsuper === false],
    ["cannot create databases", row.rolcreatedb === false],
    ["cannot create roles", row.rolcreaterole === false],
    ["is not a replication role", row.rolreplication === false],
    ["cannot bypass row-level security", row.rolbypassrls === false],
    ["can log in", row.rolcanlogin === true],
  ];

  for (const [label, ok] of checks) {
    if (ok) {
      pass(`${EXPECTED_APP_ROLE} ${label}`);
    } else {
      failCheck(`${EXPECTED_APP_ROLE} ${label}`);
    }
  }

  const memberships = await adminClient.query(
    `SELECT count(*)::int AS total
       FROM pg_auth_members m
      WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1)`,
    [EXPECTED_APP_ROLE],
  );

  if (Number(memberships.rows[0]?.total ?? -1) === 0) {
    pass(`${EXPECTED_APP_ROLE} holds no role memberships`);
  } else {
    failCheck(`${EXPECTED_APP_ROLE} unexpectedly inherits role memberships`);
  }

  const ownerCount = await adminClient.query(
    `SELECT count(*)::int AS total
       FROM pg_database d
      WHERE d.datdba = (SELECT oid FROM pg_roles WHERE rolname = $1)`,
    [EXPECTED_APP_ROLE],
  );

  if (Number(ownerCount.rows[0]?.total ?? -1) === 0) {
    pass(`${EXPECTED_APP_ROLE} does not own any database`);
  } else {
    failCheck(`${EXPECTED_APP_ROLE} owns a database`);
  }
}

async function checkNegativeAuthorization(appPassword: string): Promise<void> {
  const pool = new Pool(appPoolOptions(appPassword));

  let client: Queryable | undefined;

  try {
    client = await pool.connect();
  } catch (error) {
    await pool.end();
    failCheck("Could not open an application-role connection for denial tests", error);
    return;
  }

  try {
    const attempts: [string, string][] = [
      ["CREATE TABLE", "CREATE TABLE verify_role_denied_probe (id integer);"],
      ["CREATE SCHEMA", "CREATE SCHEMA verify_role_denied_probe;"],
    ];

    for (const [label, statement] of attempts) {
      await client.query("BEGIN");

      let denied = false;

      try {
        await client.query(statement);
      } catch (error) {
        denied = sqlstateOf(error) === "42501";
      }

      // Always roll back, including when the statement unexpectedly succeeded.
      await client.query("ROLLBACK");

      if (denied) {
        pass(`Application role cannot ${label} (SQLSTATE 42501)`);
      } else {
        failCheck(`Least-privilege violation: application role can ${label}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const appUser = requireEnv("BUSINESS_OS_DB_APP_USER");

  if (appUser !== EXPECTED_APP_ROLE) {
    process.stderr.write(`FAIL  Application role must be ${EXPECTED_APP_ROLE}\n`);
    process.exit(1);
  }

  const appPassword = requireEnv("BUSINESS_OS_DB_APP_PASSWORD");

  const adminPool = new Pool({
    host: EXPECTED_LOCAL_HOST,
    port: requirePort(),
    database: EXPECTED_LOCAL_DATABASE,
    user: requireEnv("BUSINESS_OS_DB_USER"),
    password: requireEnv("BUSINESS_OS_DB_PASSWORD"),
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  let tablesBefore: number | undefined;

  try {
    const adminClient = await adminPool.connect();

    try {
      tablesBefore = await countApplicationTables(adminClient);

      if (tablesBefore === 0) {
        pass("No application or business tables exist before verification");
      } else {
        failCheck(`Expected 0 application tables, found ${tablesBefore}`);
      }

      process.stdout.write("\n-- Role attributes --\n");
      await checkRoleAttributes(adminClient);
    } finally {
      adminClient.release();
    }
  } catch (error) {
    await adminPool.end();
    process.stderr.write("FAIL  Could not inspect the database as administrator");
    const state = sqlstateOf(error);
    process.stderr.write(state === undefined ? "\n" : ` [SQLSTATE ${state}]\n`);
    failures += 1;
    process.exit(1);
  } finally {
    await adminPool.end();
  }

  process.stdout.write("\n-- Positive authentication --\n");
  await checkPositiveAuthentication(appPassword);

  process.stdout.write("\n-- Drizzle connectivity --\n");
  await checkDrizzleConnectivity(appPassword);

  process.stdout.write("\n-- Negative authentication --\n");
  await checkNegativeAuthentication(appUser);

  process.stdout.write("\n-- Negative authorization --\n");
  await checkNegativeAuthorization(appPassword);

  const auditPool = new Pool({
    host: EXPECTED_LOCAL_HOST,
    port: requirePort(),
    database: EXPECTED_LOCAL_DATABASE,
    user: requireEnv("BUSINESS_OS_DB_USER"),
    password: requireEnv("BUSINESS_OS_DB_PASSWORD"),
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const auditClient = await auditPool.connect();

    try {
      const tablesAfter = await countApplicationTables(auditClient);

      if (tablesAfter === 0 && tablesBefore === 0) {
        pass("No application or business tables exist after verification");
      } else {
        failCheck(
          `Verification changed the database table count (${tablesBefore} -> ${tablesAfter})`,
        );
      }

      const leftovers = await auditClient.query(
        `SELECT count(*)::int AS total
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'`,
      );

      if (Number(leftovers.rows[0]?.total ?? -1) === 0) {
        pass("No leftover test objects in the public schema");
      } else {
        failCheck("Verification left test objects behind");
      }
    } finally {
      auditClient.release();
    }
  } finally {
    await auditPool.end();
  }

  process.stdout.write(
    failures === 0
      ? "\nAll verification checks passed.\n"
      : `\n${failures} verification check(s) failed.\n`,
  );

  process.exit(failures === 0 ? 0 : 1);
}

await main().catch((error: unknown) => {
  process.stderr.write(
    `FAIL  Verification aborted with an unexpected error${
      sqlstateOf(error) === undefined ? "" : ` [SQLSTATE ${sqlstateOf(error)}]`
    }\n`,
  );
  process.exit(1);
});
