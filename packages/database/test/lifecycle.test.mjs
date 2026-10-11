import { describe, expect, test } from "bun:test";

import * as databasePackage from "../dist/index.js";
import { DatabaseConfigError, createDatabase, parseDatabaseConfig } from "../dist/index.js";

// Clearly fake, test-only values. These never reach a real database:
// the pool is lazy, so no connection attempt is made by these tests.
function validConfig(overrides = {}) {
  return parseDatabaseConfig({
    host: "127.0.0.1",
    port: 55432,
    database: "unit_test_db",
    user: "unit_test_user",
    password: "unit-test-password-not-real",
    ssl: false,
    maxPoolSize: 2,
    connectionTimeoutMs: 1000,
    idleTimeoutMs: 1000,
    ...overrides,
  });
}

describe("package surface", () => {
  test("exposes only the intended public API", () => {
    expect(Object.keys(databasePackage).sort()).toEqual(
      [
        "DATABASE_CONFIG_ERROR_CODES",
        "DATABASE_CONFIG_KEYS",
        "DEFAULT_CONNECTION_TIMEOUT_MS",
        "DEFAULT_IDLE_TIMEOUT_MS",
        "DEFAULT_MAX_POOL_SIZE",
        "DatabaseConfigError",
        "DatabaseConnectionError",
        "createDatabase",
        "parseDatabaseConfig",
      ].sort(),
    );
  });

  test("exports no database singleton, pool, or client instance", () => {
    for (const [name, value] of Object.entries(databasePackage)) {
      const looksLikeHandle =
        typeof value === "object" &&
        value !== null &&
        ("db" in value || "pool" in value || "ping" in value || "close" in value);

      expect({ name, looksLikeHandle }).toEqual({ name, looksLikeHandle: false });
    }
  });

  test("exported constants are immutable data, not live handles", () => {
    expect(Object.isFrozen(databasePackage.DATABASE_CONFIG_ERROR_CODES)).toBe(true);
    expect(Object.isFrozen(databasePackage.DATABASE_CONFIG_KEYS)).toBe(true);
  });

  test("does not export administrative provisioning helpers", () => {
    expect(databasePackage.provisionRole).toBeUndefined();
    expect(databasePackage.verifyRole).toBeUndefined();
  });
});

describe("connection lifecycle", () => {
  test("importing the package does not require a database", () => {
    expect(typeof createDatabase).toBe("function");
  });

  test("creates a handle without opening a connection immediately", () => {
    const handle = createDatabase(validConfig());

    try {
      expect(handle.pool.totalCount).toBe(0);
      expect(handle.pool.idleCount).toBe(0);
      expect(handle.pool.waitingCount).toBe(0);
    } finally {
      handle.close();
    }
  });

  test("accepts a validated configuration object", async () => {
    const config = validConfig();
    const handle = createDatabase(config);

    try {
      expect(handle.db).toBeDefined();
      expect(handle.pool).toBeDefined();
      expect(typeof handle.ping).toBe("function");
      expect(typeof handle.close).toBe("function");
    } finally {
      await handle.close();
    }
  });

  test("closes the pool and releases connections", async () => {
    const handle = createDatabase(validConfig());

    await handle.close();

    expect(handle.pool.ended).toBe(true);
  });

  test("repeated shutdown is handled predictably", async () => {
    const handle = createDatabase(validConfig());

    await handle.close();
    await handle.close();
    await handle.close();

    expect(handle.pool.ended).toBe(true);
  });

  test("concurrent shutdown requests resolve without error", async () => {
    const handle = createDatabase(validConfig());

    await Promise.all([handle.close(), handle.close(), handle.close()]);

    expect(handle.pool.ended).toBe(true);
  });

  test("invalid configuration is rejected before any pool is created", () => {
    let created;

    expect(() => {
      const config = parseDatabaseConfig({
        host: "127.0.0.1",
        port: 55432,
        database: "",
        user: "unit_test_user",
        password: "unit-test-password-not-real",
        ssl: false,
      });

      created = createDatabase(config);
    }).toThrow(DatabaseConfigError);

    expect(created).toBeUndefined();
  });

  test("each caller owns an independent handle", async () => {
    const first = createDatabase(validConfig());
    const second = createDatabase(validConfig());

    expect(first).not.toBe(second);
    expect(first.pool).not.toBe(second.pool);

    await first.close();

    expect(second.pool.ended).toBe(false);

    await second.close();
  });
});
