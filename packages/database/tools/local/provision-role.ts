/**
 * Local developer tool: provision the least-privilege application role.
 *
 * Run from the repository root:
 *   bun run packages/database/tools/local/provision-role.ts
 *
 * This tool connects as the FND-006 bootstrap administrator because
 * CREATE ROLE requires administrative rights. The runtime application
 * role it creates is deliberately restricted.
 *
 * Safety: the role password never appears in a JavaScript SQL string.
 * It is passed as a query parameter into a transaction-local setting,
 * and PostgreSQL quotes it server-side with `format(..., %L)`.
 *
 * Secrets are never printed. Failures are reported by SQLSTATE only.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { parseDatabaseConfig } from "../../src/index.js";

const { Pool } = pg;

const EXPECTED_LOCAL_HOST = "127.0.0.1";
const EXPECTED_LOCAL_DATABASE = "business_os_local";
const EXPECTED_SERVER_VERSION = "18.6";
const APP_ROLE = "business_os_app";
const PASSWORD_SETTING = "business_os.app_password";
const ROLE_SETTING = "business_os.app_role";

type AdminClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  release: () => void;
};

/** SQLSTATE of a PostgreSQL error, or undefined for non-database errors. */
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

/** Never surface raw driver messages: they can contain connection details. */
function fail(message: string, error?: unknown): never {
  const state = error === undefined ? undefined : sqlstateOf(error);

  process.stderr.write(`${message}${state === undefined ? "" : ` [SQLSTATE ${state}]`}\n`);
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    fail(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readLocalSettings(): {
  admin: ReturnType<typeof parseDatabaseConfig>;
  appUser: string;
  appPassword: string;
} {
  const host = EXPECTED_LOCAL_HOST;
  const port = Number(requireEnv("BUSINESS_OS_DB_PORT"));
  const database = requireEnv("BUSINESS_OS_DB_NAME");

  if (host !== EXPECTED_LOCAL_HOST) {
    fail(`Refusing to run: host must be ${EXPECTED_LOCAL_HOST}.`);
  }

  if (database !== EXPECTED_LOCAL_DATABASE) {
    fail(`Refusing to run: database must be ${EXPECTED_LOCAL_DATABASE}.`);
  }

  const admin = parseDatabaseConfig({
    host,
    port,
    database,
    user: requireEnv("BUSINESS_OS_DB_USER"),
    password: requireEnv("BUSINESS_OS_DB_PASSWORD"),
    // Loopback-only local development service; TLS is not configured there.
    ssl: false,
    maxPoolSize: 2,
    connectionTimeoutMs: 10_000,
  });

  const appUser = requireEnv("BUSINESS_OS_DB_APP_USER");

  if (appUser !== APP_ROLE) {
    fail(`Refusing to run: application role must be ${APP_ROLE}.`);
  }

  return { admin, appUser, appPassword: requireEnv("BUSINESS_OS_DB_APP_PASSWORD") };
}

/**
 * Create the application role inside one transaction.
 *
 * The password is placed in a transaction-local setting through a
 * parameterized call, so it never crosses the wire inside a statement.
 */
async function createRole(client: AdminClient, appPassword: string): Promise<void> {
  await client.query("BEGIN");

  try {
    await client.query("SELECT set_config($1, $2, true)", [PASSWORD_SETTING, appPassword]);
    await client.query("SELECT set_config($1, $2, true)", [ROLE_SETTING, APP_ROLE]);

    // Constant PL/pgSQL block: contains no interpolated secret.
    // `format(..., %I)` quotes the role name and `%L` quotes the password.
    await client.query(`
      DO $provision$
      DECLARE
        v_password text := current_setting('${PASSWORD_SETTING}');
        v_role    text := current_setting('${ROLE_SETTING}');
      BEGIN
        EXECUTE format(
          'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
          v_role,
          v_password
        );
      END
      $provision$;
    `);

    // Idempotent grants. Neither grants CREATE on the schema or database.
    await client.query(`GRANT CONNECT ON DATABASE ${EXPECTED_LOCAL_DATABASE} TO ${APP_ROLE};`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE};`);

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction is already aborted; nothing further to undo.
    }

    fail("Role provisioning transaction failed and was rolled back.", error);
  }
}

async function roleExists(client: AdminClient): Promise<boolean> {
  const result = await client.query("SELECT 1 AS present FROM pg_roles WHERE rolname = $1", [
    APP_ROLE,
  ]);

  return result.rows.length > 0;
}

async function assertAttributes(client: AdminClient): Promise<void> {
  const result = await client.query(
    `SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
       FROM pg_roles WHERE rolname = $1`,
    [APP_ROLE],
  );

  const row = result.rows[0];

  if (row === undefined) {
    fail(`Role ${APP_ROLE} disappeared during verification.`);
  }

  const expectations: [string, unknown, boolean][] = [
    ["rolsuper", row.rolsuper, false],
    ["rolcreatedb", row.rolcreatedb, false],
    ["rolcreaterole", row.rolcreaterole, false],
    ["rolreplication", row.rolreplication, false],
    ["rolbypassrls", row.rolbypassrls, false],
    ["rolcanlogin", row.rolcanlogin, true],
  ];

  for (const [name, actual, expected] of expectations) {
    if (actual !== expected) {
      process.stderr.write(
        `Attribute ${name} is ${String(actual)}, expected ${String(expected)}\n`,
      );
      process.exit(1);
    }
  }
}

async function assertNoMemberships(client: AdminClient): Promise<void> {
  const result = await client.query(
    `SELECT r.rolname
       FROM pg_auth_members m
       JOIN pg_roles r ON r.oid = m.roleid
      WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1)`,
    [APP_ROLE],
  );

  if (result.rows.length > 0) {
    process.stderr.write(
      `Role ${APP_ROLE} unexpectedly inherits memberships: ${result.rows
        .map((row) => String(row.rolname))
        .join(", ")}\n`,
    );
    process.exit(1);
  }
}

async function assertEffectivePrivileges(client: AdminClient): Promise<void> {
  const result = await client.query(
    `SELECT
       has_database_privilege($1, current_database(), 'CONNECT') AS db_connect,
       has_database_privilege($1, current_database(), 'CREATE')  AS db_create,
       has_schema_privilege($1, 'public', 'USAGE')  AS schema_usage,
       has_schema_privilege($1, 'public', 'CREATE') AS schema_create`,
    [APP_ROLE],
  );

  const row = result.rows[0];

  if (row === undefined) {
    fail("Effective privilege verification returned no result.");
  }

  if (row.db_connect !== true) {
    fail(`Role ${APP_ROLE} lacks CONNECT on the database.`);
  }

  if (row.db_create === true) {
    fail(`Role ${APP_ROLE} unexpectedly holds database CREATE.`);
  }

  if (row.schema_usage !== true) {
    fail(`Role ${APP_ROLE} lacks USAGE on schema public.`);
  }

  if (row.schema_create === true) {
    fail(`Role ${APP_ROLE} unexpectedly holds CREATE on schema public.`);
  }
}

/** Prove the application role cannot create schema objects. */
async function assertCannotCreateSchemaObjects(
  appUser: string,
  appPassword: string,
): Promise<void> {
  // The denial tests MUST run as the application role. Running them as
  // the administrator would prove nothing.
  const pool = new Pool({
    host: EXPECTED_LOCAL_HOST,
    port: Number(requireEnv("BUSINESS_OS_DB_PORT")),
    database: EXPECTED_LOCAL_DATABASE,
    user: appUser,
    password: appPassword,
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();

  try {
    const attempts: [string, string][] = [
      ["CREATE TABLE", `CREATE TABLE provision_role_denied_probe (id integer);`],
      ["CREATE SCHEMA", `CREATE SCHEMA provision_role_denied_probe;`],
    ];

    for (const [label, statement] of attempts) {
      await client.query("BEGIN");

      try {
        await client.query(statement);
        await client.query("ROLLBACK");
        fail(`Least-privilege violation: application role can ${label}.`);
      } catch (error) {
        await client.query("ROLLBACK");

        if (sqlstateOf(error) === undefined) {
          fail(`Unexpected failure while testing ${label} denial.`, error);
        }

        process.stdout.write(`  denied ${label} (SQLSTATE ${sqlstateOf(error)})\n`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function verifyApplicationLogin(appUser: string, appPassword: string): Promise<void> {
  const pool = new Pool({
    host: EXPECTED_LOCAL_HOST,
    port: Number(requireEnv("BUSINESS_OS_DB_PORT")),
    database: EXPECTED_LOCAL_DATABASE,
    user: appUser,
    password: appPassword,
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const db = drizzle({ client: pool });

    await db.execute(sql`SELECT 1`);

    process.stdout.write(`  application role authenticated and executed a query\n`);
  } catch (error) {
    fail("Application role could not authenticate with the configured password.", error);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const { admin, appUser, appPassword } = readLocalSettings();

  const adminPool = new Pool({
    host: admin.host,
    port: admin.port,
    database: admin.database,
    user: admin.user,
    password: admin.password,
    ssl: admin.ssl,
    max: 1,
    connectionTimeoutMillis: admin.connectionTimeoutMs,
  });

  let client: AdminClient | undefined;

  try {
    client = await adminPool.connect();
  } catch (error) {
    await adminPool.end();
    fail("Could not connect to the local PostgreSQL bootstrap administrator.", error);
  }

  try {
    const versionResult = await client.query("SELECT current_setting('server_version') AS version");
    const version = String(versionResult.rows[0]?.version ?? "");

    if (!version.startsWith(EXPECTED_SERVER_VERSION)) {
      fail(`Refusing to run: expected PostgreSQL ${EXPECTED_SERVER_VERSION}, found ${version}.`);
    }

    process.stdout.write(`Local PostgreSQL ${version} on ${EXPECTED_LOCAL_HOST}\n`);

    if (await roleExists(client)) {
      process.stdout.write(`Role ${APP_ROLE} already exists; verifying without resetting it.\n`);
    } else {
      process.stdout.write(`Creating restricted role ${APP_ROLE}...\n`);
      await createRole(client, appPassword);

      await client.query(`GRANT CONNECT ON DATABASE ${EXPECTED_LOCAL_DATABASE} TO ${APP_ROLE};`);
      await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE};`);
    }

    process.stdout.write("Verifying role attributes...\n");
    await assertAttributes(client);
    await assertNoMemberships(client);
    process.stdout.write("Verifying effective privileges...\n");
    await assertEffectivePrivileges(client);
    process.stdout.write("Verifying least-privilege denials...\n");
    await assertCannotCreateSchemaObjects(appUser, appPassword);
  } finally {
    client.release();
    await adminPool.end();
  }

  await verifyApplicationLogin(appUser, appPassword);

  process.stdout.write(`Role ${APP_ROLE} is provisioned and verified.\n`);
}

await main().catch((error: unknown) => {
  // Last-resort guard: raw driver errors must never reach the console,
  // because they can carry connection details.
  fail("Provisioning failed with an unexpected error.", error);
});
