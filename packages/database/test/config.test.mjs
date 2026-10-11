import { describe, expect, test } from "bun:test";

import {
  DATABASE_CONFIG_ERROR_CODES,
  DATABASE_CONFIG_KEYS,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_MAX_POOL_SIZE,
  DatabaseConfigError,
  parseDatabaseConfig,
} from "../dist/index.js";

function captureConfigError(input) {
  try {
    parseDatabaseConfig(input);
  } catch (error) {
    if (!(error instanceof DatabaseConfigError)) {
      throw error;
    }

    return error;
  }

  throw new Error("Expected database configuration validation to fail");
}

// Clearly fake, test-only values. Never real credentials.
function validInput(overrides = {}) {
  return {
    host: "db.example.invalid",
    port: 5432,
    database: "unit_test_db",
    user: "unit_test_user",
    password: "unit-test-password-not-real",
    ssl: true,
    ...overrides,
  };
}

describe("database configuration error contract", () => {
  test("exposes only approved error codes", () => {
    expect([...DATABASE_CONFIG_ERROR_CODES]).toEqual(["MISSING_REQUIRED_VALUE", "INVALID_VALUE"]);
  });

  test("exposes only approved configuration keys", () => {
    expect([...DATABASE_CONFIG_KEYS]).toEqual([
      "host",
      "port",
      "database",
      "user",
      "password",
      "ssl",
      "maxPoolSize",
      "connectionTimeoutMs",
      "idleTimeoutMs",
    ]);
  });
});

describe("valid database configuration", () => {
  test("accepts a complete explicit configuration", () => {
    const config = parseDatabaseConfig(validInput());

    expect(config.host).toBe("db.example.invalid");
    expect(config.port).toBe(5432);
    expect(config.database).toBe("unit_test_db");
    expect(config.user).toBe("unit_test_user");
    expect(config.password).toBe("unit-test-password-not-real");
    expect(config.ssl).toBe(true);
  });

  test("applies bounded defaults for optional pool settings", () => {
    const config = parseDatabaseConfig(validInput());

    expect(config.maxPoolSize).toBe(DEFAULT_MAX_POOL_SIZE);
    expect(config.connectionTimeoutMs).toBe(DEFAULT_CONNECTION_TIMEOUT_MS);
    expect(config.idleTimeoutMs).toBe(DEFAULT_IDLE_TIMEOUT_MS);
  });

  test("keeps caller supplied pool settings", () => {
    const config = parseDatabaseConfig(
      validInput({ maxPoolSize: 3, connectionTimeoutMs: 1234, idleTimeoutMs: 5678 }),
    );

    expect(config.maxPoolSize).toBe(3);
    expect(config.connectionTimeoutMs).toBe(1234);
    expect(config.idleTimeoutMs).toBe(5678);
  });
});

describe("explicit TLS configuration", () => {
  test("accepts ssl explicitly disabled", () => {
    const config = parseDatabaseConfig(validInput({ ssl: false }));

    expect(config.ssl).toBe(false);
  });

  test("rejects a missing ssl setting instead of defaulting silently", () => {
    const input = validInput();
    delete input.ssl;

    const error = captureConfigError(input);

    expect(error.code).toBe("MISSING_REQUIRED_VALUE");
    expect(error.key).toBe("ssl");
  });
});

describe("missing mandatory fields", () => {
  test("rejects a missing hostname", () => {
    const input = validInput();
    delete input.host;

    const error = captureConfigError(input);

    expect(error.code).toBe("MISSING_REQUIRED_VALUE");
    expect(error.key).toBe("host");
  });

  test("rejects a missing database name", () => {
    const input = validInput();
    delete input.database;

    const error = captureConfigError(input);

    expect(error.key).toBe("database");
  });

  test("rejects a missing username", () => {
    const input = validInput();
    delete input.user;

    const error = captureConfigError(input);

    expect(error.key).toBe("user");
  });

  test("rejects a missing password", () => {
    const input = validInput();
    delete input.password;

    const error = captureConfigError(input);

    expect(error.key).toBe("password");
  });
});

describe("empty mandatory fields", () => {
  test("rejects an empty hostname", () => {
    expect(captureConfigError(validInput({ host: "" })).key).toBe("host");
  });

  test("rejects an empty database name", () => {
    expect(captureConfigError(validInput({ database: "" })).key).toBe("database");
  });

  test("rejects an empty username", () => {
    expect(captureConfigError(validInput({ user: "" })).key).toBe("user");
  });

  test("rejects an empty password", () => {
    expect(captureConfigError(validInput({ password: "" })).key).toBe("password");
  });

  test("rejects a whitespace-only password", () => {
    expect(captureConfigError(validInput({ password: "   " })).key).toBe("password");
  });
});

describe("invalid numeric configuration", () => {
  test("rejects a port of zero", () => {
    expect(captureConfigError(validInput({ port: 0 })).code).toBe("INVALID_VALUE");
  });

  test("rejects a port above the valid range", () => {
    expect(captureConfigError(validInput({ port: 70000 })).key).toBe("port");
  });

  test("rejects a fractional port", () => {
    expect(captureConfigError(validInput({ port: 5432.5 })).key).toBe("port");
  });

  test("rejects a non-numeric port", () => {
    expect(captureConfigError(validInput({ port: "5432" })).key).toBe("port");
  });

  test("rejects a missing port", () => {
    const input = validInput();
    delete input.port;

    expect(captureConfigError(input).code).toBe("MISSING_REQUIRED_VALUE");
  });

  test("rejects a zero pool size", () => {
    expect(captureConfigError(validInput({ maxPoolSize: 0 })).key).toBe("maxPoolSize");
  });

  test("rejects a negative pool size", () => {
    expect(captureConfigError(validInput({ maxPoolSize: -2 })).key).toBe("maxPoolSize");
  });

  test("rejects a fractional pool size", () => {
    expect(captureConfigError(validInput({ maxPoolSize: 2.5 })).key).toBe("maxPoolSize");
  });

  test("rejects a zero connection timeout", () => {
    expect(captureConfigError(validInput({ connectionTimeoutMs: 0 })).key).toBe(
      "connectionTimeoutMs",
    );
  });

  test("rejects a negative idle timeout", () => {
    expect(captureConfigError(validInput({ idleTimeoutMs: -1 })).key).toBe("idleTimeoutMs");
  });
});

describe("configuration safety properties", () => {
  test("returns a frozen configuration", () => {
    const config = parseDatabaseConfig(validInput());

    expect(Object.isFrozen(config)).toBe(true);
  });

  test("does not modify the input object", () => {
    const input = validInput({ maxPoolSize: 4 });
    const snapshot = { ...input };

    parseDatabaseConfig(input);

    expect(input).toEqual(snapshot);
  });

  test("never exposes a rejected value in the error message", () => {
    const rejectedPassword = "super-secret-rejected-value";

    const error = captureConfigError(validInput({ password: rejectedPassword, port: -1 }));

    expect(error.message).not.toContain(rejectedPassword);
    expect(error.message).toContain("port");
    expect(error.code).toBe("INVALID_VALUE");
  });

  test("never exposes a rejected host in the error message", () => {
    const rejectedHost = "rejected-host.example.invalid";

    const error = captureConfigError(validInput({ host: " ", database: rejectedHost }));

    expect(error.message).not.toContain(rejectedHost);
  });
});

describe("no implicit environment coupling", () => {
  test("does not fall back to environment variables when host is missing", () => {
    const previousHost = process.env.BUSINESS_OS_DB_HOST;
    process.env.BUSINESS_OS_DB_HOST = "env-host-should-be-ignored";

    try {
      const input = validInput();
      delete input.host;

      const error = captureConfigError(input);

      expect(error.code).toBe("MISSING_REQUIRED_VALUE");
      expect(error.key).toBe("host");
      expect(error.message).not.toContain("env-host-should-be-ignored");
    } finally {
      if (previousHost === undefined) {
        delete process.env.BUSINESS_OS_DB_HOST;
      } else {
        process.env.BUSINESS_OS_DB_HOST = previousHost;
      }
    }
  });

  test("does not read a password from the environment", () => {
    const previousPassword = process.env.BUSINESS_OS_DB_PASSWORD;
    process.env.BUSINESS_OS_DB_PASSWORD = "env-password-should-be-ignored";

    try {
      const input = validInput();
      delete input.password;

      const error = captureConfigError(input);

      expect(error.key).toBe("password");
      expect(error.message).not.toContain("env-password-should-be-ignored");
    } finally {
      if (previousPassword === undefined) {
        delete process.env.BUSINESS_OS_DB_PASSWORD;
      } else {
        process.env.BUSINESS_OS_DB_PASSWORD = previousPassword;
      }
    }
  });

  test("does not mutate the global environment during validation", () => {
    const before = Object.keys(process.env).length;

    parseDatabaseConfig(validInput());

    expect(Object.keys(process.env).length).toBe(before);
  });
});
