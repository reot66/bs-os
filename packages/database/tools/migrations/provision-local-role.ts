/**
 * Provision the dedicated local Core migration role.
 *
 * This is a local administrative command, invoked explicitly by a
 * developer. It never runs automatically, and it is not part of the
 * migration runner: the bootstrap administrator exists to *create* the
 * migrator role and to own the schemas it works in, not to apply
 * migrations on its behalf.
 *
 * The password is never placed inside a SQL string. It is passed as a
 * query parameter into a transaction-local setting, and PostgreSQL
 * quotes it server-side with `format(..., %L)`, so it cannot be
 * injected and is never echoed back.
 *
 * @see docs/adr/0006-database-migration-governance.md
 * @see docs/runbooks/database-migrations.md
 */

import { parseDatabaseConfig } from "../../src/index.js";
import { parseLocalAdminEnvironment } from "@business-os/configuration";
import pg from "pg";

const { Pool } = pg;

/** Loopback only. */
const EXPECTED_LOCAL_HOST = "127.0.0.1";

/** The single approved local development database. */
const EXPECTED_LOCAL_DATABASE = "business_os_local";

/** Major version this tool was written and reviewed against. */
const EXPECTED_SERVER_VERSION = "18.6";

/** The migrator role this tool provisions. */
const MIGRATOR_ROLE = "business_os_migrator";

/** Schemas the migrator owns: the Core namespace and the migration journal. */
const CORE_SCHEMA = "core";
const JOURNAL_SCHEMA = "drizzle";

const PASSWORD_SETTING = "business_os.migrator_password";
const ROLE_SETTING = "business_os.migrator_role";

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

/** Never surface raw driver messages: they can carry connection details. */
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

type AdminClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  release: () => void;
};

/**
 * Create the migrator role inside one transaction.
 *
 * The attributes deny every administrative capability: no superuser, no
 * database creation, no role creation, no replication, and no
 * row-level-security bypass.
 */
async function createRole(client: AdminClient, migratorPassword: string): Promise<void> {
  await client.query("BEGIN");

  try {
    await client.query("SELECT set_config($1, $2, true)", [PASSWORD_SETTING, migratorPassword]);
    await client.query("SELECT set_config($1, $2, true)", [ROLE_SETTING, MIGRATOR_ROLE]);

    // Constant PL/pgSQL block: no interpolated secret. `format(..., %I)`
    // quotes the role name and `%L` quotes the password server-side.
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

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction is already aborted; nothing further to undo.
    }

    fail("Migrator role provisioning transaction failed and was rolled back.", error);
  }
}

/**
 * Create the Core and journal schemas and give the migrator ownership.
 *
 * The schemas are created by the bootstrap administrator and then owned
 * by the migrator role. This is deliberately narrower than granting
 * `CREATE` on the whole database: the migrator can create and alter
 * objects inside the two schemas it owns, and nothing outside them.
 */
async function provisionSchemas(client: AdminClient): Promise<void> {
  await client.query("BEGIN");

  try {
    // Identifiers are constants from this module, never user input.
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${CORE_SCHEMA}`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${JOURNAL_SCHEMA}`);
    await client.query(`GRANT CONNECT ON DATABASE ${EXPECTED_LOCAL_DATABASE} TO ${MIGRATOR_ROLE}`);
    // Required by Drizzle's migrator, and the reason is verified rather
    // than assumed: `dialect.migrate()` unconditionally issues
    // `CREATE SCHEMA IF NOT EXISTS <journal schema>` before touching the
    // journal. PostgreSQL checks database-level CREATE *before* deciding
    // whether the schema already exists, so without this grant the runner
    // fails with SQLSTATE 42501 on a database whose schema is already
    // present. See docs/adr/0006-database-migration-governance.md.
    await client.query(`GRANT CREATE ON DATABASE ${EXPECTED_LOCAL_DATABASE} TO ${MIGRATOR_ROLE}`);
    await client.query(`GRANT USAGE ON SCHEMA ${CORE_SCHEMA} TO ${MIGRATOR_ROLE}`);
    await client.query(`GRANT USAGE ON SCHEMA ${JOURNAL_SCHEMA} TO ${MIGRATOR_ROLE}`);
    await client.query(`ALTER SCHEMA ${CORE_SCHEMA} OWNER TO ${MIGRATOR_ROLE}`);
    await client.query(`ALTER SCHEMA ${JOURNAL_SCHEMA} OWNER TO ${MIGRATOR_ROLE}`);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction is already aborted; nothing further to undo.
    }

    fail("Core schema provisioning transaction failed and was rolled back.", error);
  }
}

async function roleExists(client: AdminClient): Promise<boolean> {
  const result = await client.query("SELECT 1 AS present FROM pg_roles WHERE rolname = $1", [
    MIGRATOR_ROLE,
  ]);

  return result.rows.length > 0;
}

/** Fail closed if the role carries any administrative capability. */
async function assertAttributes(client: AdminClient): Promise<void> {
  const result = await client.query(
    `SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
       FROM pg_roles WHERE rolname = $1`,
    [MIGRATOR_ROLE],
  );

  const row = result.rows[0];

  if (row === undefined) {
    fail(`Role ${MIGRATOR_ROLE} disappeared during verification.`);
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

/**
 * Reject any role membership.
 *
 * A migrator that inherits an administrative role would silently hold
 * more authority than the privilege model describes, so membership is a
 * provisioning failure rather than a warning.
 */
async function assertNoMemberships(client: AdminClient): Promise<void> {
  const result = await client.query(
    `SELECT r.rolname
       FROM pg_auth_members m
       JOIN pg_roles r ON r.oid = m.roleid
      WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1)`,
    [MIGRATOR_ROLE],
  );

  if (result.rows.length > 0) {
    fail(
      `Role ${MIGRATOR_ROLE} unexpectedly inherits memberships: ${result.rows
        .map((row) => String(row.rolname))
        .join(", ")}`,
    );
  }
}

/** Confirm the migrator owns exactly the two intended schemas. */
async function assertSchemaOwnership(client: AdminClient): Promise<void> {
  const result = await client.query(
    `SELECT nspname, pg_get_userbyid(nspowner) AS owner
       FROM pg_namespace
      WHERE nspname = ANY($1::text[])`,
    [[CORE_SCHEMA, JOURNAL_SCHEMA]],
  );

  for (const schema of [CORE_SCHEMA, JOURNAL_SCHEMA]) {
    const row = result.rows.find((entry) => entry.nspname === schema);

    if (row === undefined) {
      fail(`Schema ${schema} was not created by provisioning.`);
    }

    if (row.owner !== MIGRATOR_ROLE) {
      fail(`Schema ${schema} is owned by "${String(row.owner)}", expected ${MIGRATOR_ROLE}.`);
    }
  }
}

/**
 * Confirm the migrator holds exactly the database privilege the runner
 * requires, and no more.
 *
 * Database-level CREATE is required because Drizzle's migrator issues an
 * unconditional `CREATE SCHEMA IF NOT EXISTS`. It is the widest privilege
 * this role holds, so it is asserted explicitly rather than granted
 * silently, and it is one of the reasons this role is local-only.
 */
async function assertDatabasePrivilege(client: AdminClient): Promise<void> {
  const result = await client.query(
    `SELECT has_database_privilege($1, current_database(), 'CONNECT') AS db_connect,
            has_database_privilege($1, current_database(), 'CREATE')  AS db_create`,
    [MIGRATOR_ROLE],
  );

  const row = result.rows[0];

  if (row?.db_create !== true) {
    fail(
      `Role ${MIGRATOR_ROLE} lacks the database-level CREATE that Drizzle's ` +
        "migrator requires to issue CREATE SCHEMA IF NOT EXISTS.",
    );
  }

  if (row?.db_connect !== true) {
    fail(`Role ${MIGRATOR_ROLE} lacks CONNECT on the database.`);
  }
}

/**
 * Prove the migrator cannot do anything outside the schemas it owns.
 *
 * These denials run as the migrator itself. Running them as the
 * administrator would prove nothing.
 */
async function assertCannotEscapeOwnedSchemas(migratorPassword: string): Promise<void> {
  const pool = new Pool({
    host: EXPECTED_LOCAL_HOST,
    port: Number(requireEnv("BUSINESS_OS_DB_PORT")),
    database: EXPECTED_LOCAL_DATABASE,
    user: MIGRATOR_ROLE,
    password: migratorPassword,
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();

  try {
    // With database-level CREATE the migrator *can* create further
    // schemas; that residual capability is documented in ADR-0006 and is
    // one reason this role is never a production role. What must still
    // hold is that it cannot write into the default `public` schema,
    // which it does not own, and cannot escalate further.
    const attempts: [string, string][] = [
      ["CREATE TABLE in public", "CREATE TABLE public.migrator_escape_probe (id integer);"],
      ["CREATE ROLE", "CREATE ROLE migrator_escalation_probe;"],
      ["CREATE DATABASE", "CREATE DATABASE migrator_escalation_probe;"],
    ];

    for (const [label, statement] of attempts) {
      await client.query("BEGIN");

      try {
        await client.query(statement);
        await client.query("ROLLBACK");
        fail(`Least-privilege violation: the migrator can ${label}.`);
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

/** Prove the migrator can log in and use its own schema. */
async function verifyMigratorLogin(migratorPassword: string): Promise<void> {
  const pool = new Pool({
    host: EXPECTED_LOCAL_HOST,
    port: Number(requireEnv("BUSINESS_OS_DB_PORT")),
    database: EXPECTED_LOCAL_DATABASE,
    user: MIGRATOR_ROLE,
    password: migratorPassword,
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();

  try {
    // CREATE TABLE inside the owned Core schema must succeed. It runs in
    // a transaction that is always rolled back, so nothing persists.
    await client.query("BEGIN");

    try {
      // Qualified so the statement targets the Core schema the migrator
      // owns, not the default `public` schema it deliberately cannot write.
      await client.query(`CREATE TABLE ${CORE_SCHEMA}.migrator_own_schema_probe (id integer)`);
      await client.query(`DROP TABLE ${CORE_SCHEMA}.migrator_own_schema_probe`);
      process.stdout.write("  migrator can create objects inside its own Core schema\n");
    } finally {
      await client.query("ROLLBACK");
    }
  } catch (error) {
    fail("The migrator role could not create objects inside its own Core schema.", error);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const admin = parseLocalAdminEnvironment(process.env);

  if (admin.database.host !== EXPECTED_LOCAL_HOST) {
    fail(`Refusing to run: host must be ${EXPECTED_LOCAL_HOST}.`);
  }

  if (admin.database.database !== EXPECTED_LOCAL_DATABASE) {
    fail(`Refusing to run: database must be ${EXPECTED_LOCAL_DATABASE}.`);
  }

  const adminConfig = parseDatabaseConfig({
    host: admin.database.host,
    port: admin.database.port,
    database: admin.database.database,
    user: admin.database.user,
    password: admin.database.password,
    ssl: admin.database.ssl,
    maxPoolSize: 1,
    connectionTimeoutMs: 10_000,
  });

  const migratorPassword = requireEnv("BUSINESS_OS_DB_MIGRATOR_PASSWORD");

  const adminPool = new Pool({
    host: adminConfig.host,
    port: adminConfig.port,
    database: adminConfig.database,
    user: adminConfig.user,
    password: adminConfig.password,
    ssl: adminConfig.ssl,
    max: 1,
    connectionTimeoutMillis: adminConfig.connectionTimeoutMs,
  });

  let client: AdminClient | undefined;

  try {
    client = await adminPool.connect();
  } catch (error) {
    await adminPool.end();
    fail("Could not connect to the local PostgreSQL bootstrap administrator.", error);
  }

  try {
    const version = await client.query("SELECT current_setting('server_version') AS version");
    const reported = String(version.rows[0]?.version ?? "");

    if (!reported.startsWith(EXPECTED_SERVER_VERSION)) {
      fail(`Refusing to run: expected PostgreSQL ${EXPECTED_SERVER_VERSION}, found ${reported}.`);
    }

    process.stdout.write(`Local PostgreSQL ${reported} on ${EXPECTED_LOCAL_HOST}\n`);

    if (await roleExists(client)) {
      // Idempotent by design. An existing password is never reset
      // silently; re-provisioning is an explicit owner decision.
      process.stdout.write(
        `Role ${MIGRATOR_ROLE} already exists; verifying without resetting its password.\n`,
      );
    } else {
      process.stdout.write(`Creating restricted role ${MIGRATOR_ROLE}...\n`);
      await createRole(client, migratorPassword);
    }

    process.stdout.write("Provisioning Core and journal schemas...\n");
    await provisionSchemas(client);

    process.stdout.write("Verifying role attributes...\n");
    await assertAttributes(client);
    await assertNoMemberships(client);
    process.stdout.write("Verifying schema ownership...\n");
    await assertSchemaOwnership(client);
    process.stdout.write("Verifying privilege boundaries...\n");
    await assertDatabasePrivilege(client);
    process.stdout.write("Verifying least-privilege denials...\n");
    await assertCannotEscapeOwnedSchemas(migratorPassword);
  } finally {
    client.release();
    await adminPool.end();
  }

  await verifyMigratorLogin(migratorPassword);

  process.stdout.write(`Role ${MIGRATOR_ROLE} is provisioned and verified.\n`);
}

await main().catch((error: unknown) => {
  // Last-resort guard: raw driver errors must never reach the console,
  // because they can carry connection details.
  fail("Provisioning failed with an unexpected error.", error);
});
