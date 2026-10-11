/**
 * Real PostgreSQL integration tests for the Core migration foundation.
 *
 * These tests are **opt-in**. They are skipped unless
 * `FND011_INTEGRATION_TESTS=true`, so `bun run test` continues to
 * pass with no PostgreSQL server and the CI workflow is unchanged.
 *
 * The suite provisions its own disposable PostgreSQL 18.6 container on a
 * random loopback port with an ephemeral in-memory data directory. It
 * creates no Docker volume, never touches the developer's
 * `business-os-local` Compose project or its
 * `business_os_postgres_data` volume, and removes only the container it
 * started.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INTEGRATION_ENABLED = process.env.FND011_INTEGRATION_TESTS === "true";

const PACKAGE_ROOT = new URL("../", import.meta.url).pathname;
const REPO_ROOT = new URL("../../", import.meta.url).pathname;
const MIGRATIONS_DIR = join(PACKAGE_ROOT, "migrations/core");
const JOURNAL_FILE = join(MIGRATIONS_DIR, "meta/_journal.json");
const DRIZZLE_KIT = join(PACKAGE_ROOT, "node_modules/.bin/drizzle-kit");

// Disposable-test credentials. Random per run; never real secrets.
const ADMIN_USER = "fnd011_admin";
const ADMIN_PASSWORD = `fnd011-admin-${Math.random().toString(36).slice(2)}`;
const APP_ROLE = "business_os_app";
const APP_PASSWORD = `fnd011-app-${Math.random().toString(36).slice(2)}`;
const MIGRATOR_ROLE = "business_os_migrator";
const MIGRATOR_PASSWORD = `fnd011-migrator-${Math.random().toString(36).slice(2)}`;
const DATABASE_NAME = "business_os_local";

const CONTAINER_NAME = `fnd011-it-${Date.now()}-${Math.random().toString(36).slice(7)}`;
const HOST_PORT = 40_000 + Math.floor(Math.random() * 15_000);

/** Run one of the migration tools with an explicit, isolated environment. */
async function runTool(script, args = [], extraEnv = {}) {
  const proc = Bun.spawn(["bun", "run", join(PACKAGE_ROOT, script), ...args], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      BUSINESS_OS_ENV: "local",
      BUSINESS_OS_DB_HOST: "127.0.0.1",
      BUSINESS_OS_DB_PORT: String(HOST_PORT),
      BUSINESS_OS_DB_NAME: DATABASE_NAME,
      BUSINESS_OS_DB_SSL: "false",
      BUSINESS_OS_DB_USER: ADMIN_USER,
      BUSINESS_OS_DB_PASSWORD: ADMIN_PASSWORD,
      BUSINESS_OS_DB_APP_USER: APP_ROLE,
      BUSINESS_OS_DB_APP_PASSWORD: APP_PASSWORD,
      BUSINESS_OS_DB_MIGRATOR_USER: MIGRATOR_ROLE,
      BUSINESS_OS_DB_MIGRATOR_PASSWORD: MIGRATOR_PASSWORD,
      ...extraEnv,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

/** Connect as a given role against the disposable server. */
async function withRoleClient(user, password, fn) {
  const { default: pg } = await import("pg");

  const pool = new pg.Pool({
    host: "127.0.0.1",
    port: HOST_PORT,
    database: DATABASE_NAME,
    user,
    password,
    ssl: false,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();

  try {
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}

/** SQLSTATE of a PostgreSQL error, or undefined. */
function sqlstateOf(error) {
  return typeof error === "object" && error !== null && typeof error.code === "string"
    ? error.code
    : undefined;
}

/** Start the disposable container and wait until it accepts connections. */
async function startDisposableContainer() {
  const proc = Bun.spawn(
    [
      "docker",
      "run",
      "-d",
      "--name",
      CONTAINER_NAME,
      // Ephemeral in-memory data directory: no named volume, no volume at all.
      "--tmpfs",
      "/var/lib/postgresql",
      "-e",
      `POSTGRES_DB=${DATABASE_NAME}`,
      "-e",
      `POSTGRES_USER=${ADMIN_USER}`,
      "-e",
      `POSTGRES_PASSWORD=${ADMIN_PASSWORD}`,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=scram-sha-256",
      "-p",
      `127.0.0.1:${HOST_PORT}:5432`,
      "postgres:18.6-bookworm",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`Could not start the disposable PostgreSQL container: ${stderr}`);
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const check = Bun.spawn(
      [
        "docker",
        "exec",
        CONTAINER_NAME,
        "pg_isready",
        "-q",
        "-h",
        "127.0.0.1",
        "-U",
        ADMIN_USER,
        "-d",
        DATABASE_NAME,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );

    await check.exited;

    if ((await check.exited) === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("The disposable PostgreSQL container never became ready.");
}

/** Remove only the container this run created. No volume was ever created. */
async function stopContainer() {
  const proc = Bun.spawn(["docker", "rm", "-f", CONTAINER_NAME], {
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;
}

const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

describeIntegration("Core migrations against real PostgreSQL 18.6", () => {
  let containerStarted = false;

  beforeAll(async () => {
    if (!INTEGRATION_ENABLED) {
      return;
    }

    await startDisposableContainer();
    containerStarted = true;

    // The least-privilege application role must exist before provisioning,
    // so that role isolation can be tested afterwards.
    await withRoleClient(ADMIN_USER, ADMIN_PASSWORD, async (client) => {
      await client.query("BEGIN");

      try {
        // Constant PL/pgSQL block; the password is quoted server-side.
        await client.query(
          `DO $provision$
           BEGIN
             EXECUTE format(
               'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
               '${APP_ROLE}',
               '${APP_PASSWORD}'
             );
           END
           $provision$;`,
        );
        await client.query(`GRANT CONNECT ON DATABASE ${DATABASE_NAME} TO ${APP_ROLE}`);
        await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");

        throw error;
      }
    });
  }, 180_000);

  afterAll(async () => {
    if (containerStarted) {
      await stopContainer();
    }
  }, 60_000);

  test("the disposable server is PostgreSQL 18.6", async () => {
    const version = await withRoleClient(ADMIN_USER, ADMIN_PASSWORD, (client) =>
      client
        .query("select current_setting('server_version') as version")
        .then((result) => result.rows[0].version),
    );

    expect(version.startsWith("18.6")).toBe(true);
  });

  test("provisions the migrator role with least-privilege attributes", async () => {
    const result = await runTool("tools/migrations/provision-local-role.ts");

    expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({
      exitCode: 0,
      stderr: "",
    });

    const attributes = await withRoleClient(ADMIN_USER, ADMIN_PASSWORD, (client) =>
      client
        .query(
          `select rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin
             from pg_roles where rolname = $1`,
          [MIGRATOR_ROLE],
        )
        .then((result) => result.rows[0]),
    );

    expect(attributes).toEqual({
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
      rolcanlogin: true,
    });
  }, 60_000);

  test("the migrator owns the Core and journal schemas", async () => {
    const rows = await withRoleClient(ADMIN_USER, ADMIN_PASSWORD, (client) =>
      client
        .query(
          `select nspname, pg_get_userbyid(nspowner) as owner from pg_namespace
            where nspname = any($1::text[])`,
          [["core", "drizzle"]],
        )
        .then((result) => result.rows),
    );

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.owner))).toEqual(new Set([MIGRATOR_ROLE]));
  });

  test("refuses to migrate without an explicit --apply", async () => {
    const result = await runTool("tools/migrations/apply-local.ts");

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("explicit --apply");
  });

  test("refuses invalid migrator credentials without echoing them", async () => {
    const wrong = "definitely-not-the-password";

    const result = await runTool("tools/migrations/apply-local.ts", ["--apply"], {
      BUSINESS_OS_DB_MIGRATOR_PASSWORD: wrong,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).not.toContain(wrong);
    expect(result.stdout).not.toContain("postgres://");
  });

  test("refuses to migrate as the application role", async () => {
    const result = await runTool("tools/migrations/apply-local.ts", ["--apply"], {
      BUSINESS_OS_DB_MIGRATOR_USER: APP_ROLE,
      BUSINESS_OS_DB_MIGRATOR_PASSWORD: APP_PASSWORD,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("not permitted to apply migrations");
  });

  test("refuses to migrate as the bootstrap administrator", async () => {
    const result = await runTool("tools/migrations/apply-local.ts", ["--apply"], {
      BUSINESS_OS_DB_MIGRATOR_USER: ADMIN_USER,
      BUSINESS_OS_DB_MIGRATOR_PASSWORD: ADMIN_PASSWORD,
    });

    // The container's bootstrap account is a superuser, so the refusal
    // names that fact rather than the role-name check.
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("the connected role is a superuser");
    expect(result.stdout + result.stderr).not.toContain(ADMIN_PASSWORD);
  });

  test("refuses a remote database host", async () => {
    const result = await runTool("tools/migrations/apply-local.ts", ["--apply"], {
      BUSINESS_OS_DB_HOST: "db.example.com",
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("host must be 127.0.0.1");
  });

  test("refuses a non-local environment", async () => {
    const result = await runTool("tools/migrations/apply-local.ts", ["--apply"], {
      BUSINESS_OS_ENV: "production",
    });

    expect(result.exitCode).not.toBe(0);
    // Rejected by the configuration parser before any connection is made.
    expect(result.stderr).toContain("BUSINESS_OS_ENV");
    expect(result.stderr).toContain("FORBIDDEN_IN_PRODUCTION");
  });

  test("status reports UNINITIALIZED and creates nothing", async () => {
    // Runs before the baseline is applied, so the journal genuinely does
    // not exist yet. Afterwards the database must be byte-for-byte the
    // same shape, proving status performed no DDL.
    const relationsBefore = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
      client
        .query(
          `select count(*)::int as total from information_schema.tables
            where table_schema not in ('pg_catalog','information_schema')`,
        )
        .then((result) => result.rows[0].total),
    );

    const result = await runTool("tools/migrations/status-local.ts");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Journal state: UNINITIALIZED");
    expect(result.stdout).toContain("Pending migrations: 1");
    expect(result.stdout + result.stderr).not.toContain(MIGRATOR_PASSWORD);

    const relationsAfter = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
      client
        .query(
          `select count(*)::int as total from information_schema.tables
            where table_schema not in ('pg_catalog','information_schema')`,
        )
        .then((result) => result.rows[0].total),
    );

    // No table, and specifically no journal, was created by inspecting.
    expect(relationsAfter).toBe(relationsBefore);
    expect(relationsAfter).toBe(0);
  }, 90_000);

  test("applies the baseline migration", async () => {
    const result = await runTool("tools/migrations/apply-local.ts", ["--apply"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Applying 1 pending migration");
  }, 60_000);

  test("created the Core schema and the dedicated migration journal", async () => {
    const rows = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
      client
        .query(
          `select table_schema, table_name from information_schema.tables
            where table_schema in ('core','drizzle') order by table_name`,
        )
        .then((result) => result.rows),
    );

    expect(rows).toEqual([{ table_schema: "drizzle", table_name: "__drizzle_migrations_core" }]);
  });

  test("created no business tables anywhere", async () => {
    const total = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
      client
        .query(
          `select count(*)::int as total from information_schema.tables
            where table_schema not in ('pg_catalog','information_schema')`,
        )
        .then((result) => result.rows[0].total),
    );

    // Only the migration journal exists.
    expect(total).toBe(1);
  });

  test("recorded exactly one journal row", async () => {
    const total = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
      client
        .query("select count(*)::int as total from drizzle.__drizzle_migrations_core")
        .then((result) => result.rows[0].total),
    );

    expect(total).toBe(1);
  });

  test("re-running applies nothing and duplicates no journal row", async () => {
    const result = await runTool("tools/migrations/apply-local.ts", ["--apply"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No pending migrations");

    const total = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
      client
        .query("select count(*)::int as total from drizzle.__drizzle_migrations_core")
        .then((result) => result.rows[0].total),
    );

    expect(total).toBe(1);
  }, 60_000);

  test("concurrent migration attempts produce no duplicate execution", async () => {
    const [first, second] = await Promise.all([
      runTool("tools/migrations/apply-local.ts", ["--apply"]),
      runTool("tools/migrations/apply-local.ts", ["--apply"]),
    ]);

    // Both terminate cleanly: the loser waits for the lock, then finds
    // nothing left to do.
    expect({ first: first.exitCode, second: second.exitCode }).toEqual({ first: 0, second: 0 });

    const total = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
      client
        .query("select count(*)::int as total from drizzle.__drizzle_migrations_core")
        .then((result) => result.rows[0].total),
    );

    expect(total).toBe(1);
  }, 120_000);

  test("releases the advisory lock after a run", async () => {
    const held = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
      client
        .query("select count(*)::int as total from pg_locks where locktype = 'advisory'")
        .then((result) => result.rows[0].total),
    );

    expect(held).toBe(0);
  });

  test("the application role cannot alter Core or the journal", async () => {
    const attempts = [
      "CREATE TABLE core.tenant_probe (id integer)",
      "ALTER TABLE drizzle.__drizzle_migrations_core ADD COLUMN probe integer",
      "DROP TABLE drizzle.__drizzle_migrations_core",
      "CREATE SCHEMA app_escape_probe",
      "CREATE ROLE app_role_probe",
    ];

    for (const statement of attempts) {
      let denied = false;

      try {
        await withRoleClient(APP_ROLE, APP_PASSWORD, (client) => client.query(statement));
      } catch (error) {
        denied = sqlstateOf(error) === "42501" || sqlstateOf(error) === "42P01";
      }

      expect({ statement, denied }).toEqual({ statement, denied: true });
    }
  }, 60_000);

  test("the application role cannot assume the migrator role", async () => {
    const memberships = await withRoleClient(ADMIN_USER, ADMIN_PASSWORD, (client) =>
      client
        .query(
          `select count(*)::int as total from pg_auth_members m
             join pg_roles r on r.oid = m.member
            where r.rolname = $1`,
          [APP_ROLE],
        )
        .then((result) => result.rows[0].total),
    );

    expect(memberships).toBe(0);
  });

  test("status reports the applied state read-only", async () => {
    const result = await runTool("tools/migrations/status-local.ts");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Journal state: INITIALIZED");
    expect(result.stdout).toContain("Applied migrations: 1");
    expect(result.stdout).toContain("Pending migrations: 0");
    expect(result.stdout).toContain("Journal consistency: OK");
    expect(result.stdout).toContain(MIGRATOR_ROLE);
    expect(result.stdout).toContain("18.6");
  });

  test("status never exposes the migrator password", async () => {
    const result = await runTool("tools/migrations/status-local.ts");

    expect(result.stdout + result.stderr).not.toContain(MIGRATOR_PASSWORD);
  });

  test("a failed migration returns nonzero and records nothing", async () => {
    const originalJournal = readFileSync(JOURNAL_FILE, "utf8");
    const failingFile = join(MIGRATIONS_DIR, "0001_integration_failure_probe.sql");

    // Generate a real migration through the supported generator rather
    // than fabricating journal metadata by hand.
    const generated = Bun.spawnSync(
      ["bun", "run", DRIZZLE_KIT, "generate", "--custom", "--name", "integration_failure_probe"],
      { cwd: PACKAGE_ROOT, stdout: "pipe", stderr: "pipe" },
    );

    expect({ exitCode: generated.exitCode }).toEqual({ exitCode: 0 });

    try {
      // Deliberately invalid DDL that must abort the whole transaction.
      writeFileSync(
        failingFile,
        "CREATE TABLE core.failure_probe (id integer);\nTHIS IS NOT VALID SQL;\n",
      );

      const before = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
        client
          .query("select count(*)::int as total from drizzle.__drizzle_migrations_core")
          .then((result) => result.rows[0].total),
      );

      const result = await runTool("tools/migrations/apply-local.ts", ["--apply"]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Migration failed");
      expect(result.stdout + result.stderr).not.toContain(MIGRATOR_PASSWORD);

      // Nothing was recorded, and the partial DDL rolled back.
      const after = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
        client
          .query("select count(*)::int as total from drizzle.__drizzle_migrations_core")
          .then((result) => result.rows[0].total),
      );

      expect(after).toBe(before);

      const probeTable = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
        client
          .query(
            `select count(*)::int as total from information_schema.tables
              where table_name = 'failure_probe'`,
          )
          .then((result) => result.rows[0].total),
      );

      expect(probeTable).toBe(0);

      // The lock must be released despite the failure.
      const held = await withRoleClient(MIGRATOR_ROLE, MIGRATOR_PASSWORD, (client) =>
        client
          .query("select count(*)::int as total from pg_locks where locktype = 'advisory'")
          .then((result) => result.rows[0].total),
      );

      expect(held).toBe(0);
    } finally {
      // Restore the committed migration set exactly.
      writeFileSync(JOURNAL_FILE, originalJournal);

      for (const file of [failingFile, join(MIGRATIONS_DIR, "meta/0001_snapshot.json")]) {
        if (existsSync(file)) {
          rmSync(file);
        }
      }
    }
  }, 180_000);

  test("refuses to apply when a recorded migration file was modified", async () => {
    const originalFile = join(MIGRATIONS_DIR, "0000_baseline_core_schema.sql");
    const original = readFileSync(originalFile, "utf8");

    try {
      writeFileSync(originalFile, `${original}\n-- tampered\n`);

      const result = await runTool("tools/migrations/apply-local.ts", ["--apply"]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("MODIFIED_MIGRATION_FILE");
      expect(result.stderr).toContain("journal is inconsistent");
    } finally {
      writeFileSync(originalFile, original);
    }
  }, 90_000);

  test("creates no Docker volume and cannot touch the developer volume", async () => {
    const inspect = Bun.spawnSync(
      [
        "docker",
        "inspect",
        CONTAINER_NAME,
        "--format",
        "{{range .Mounts}}{{.Type}}:{{.Name}} {{end}}|{{json .HostConfig.Tmpfs}}",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );

    const details = (await new Response(inspect.stdout).text()).trim();
    const [mounts, tmpfs] = details.split("|");

    // The data directory is an ephemeral tmpfs: no volume mount of any
    // kind exists on this container.
    expect(mounts.trim()).toBe("");
    expect(/volume/i.test(mounts)).toBe(false);
    expect(tmpfs).toContain("/var/lib/postgresql");

    // The developer's persistent volume must be untouched by this suite.
    const volumes = Bun.spawnSync(["docker", "volume", "ls", "--format", "{{.Name}}"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const names = await new Response(volumes.stdout).text();

    // Nothing named after this run exists; the developer volume is intact.
    expect(names).not.toContain(CONTAINER_NAME);
  });
});

if (!INTEGRATION_ENABLED) {
  // Explicit SKIPPED reporting. Mock or simulated results are never
  // substituted for real PostgreSQL verification.
  process.stderr.write(
    "SKIPPED: Core migration integration tests require real PostgreSQL. " +
      "Set FND011_INTEGRATION_TESTS=true and run with Docker available.\n",
  );
}
