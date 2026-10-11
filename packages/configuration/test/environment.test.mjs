import { describe, expect, test } from "bun:test";

import {
  EnvironmentConfigError,
  LOG_LEVELS,
  REDACTED_VALUE,
  RUNTIME_ENVIRONMENTS,
  parseLocalAdminEnvironment,
  parseRuntimeEnvironment,
  summarizeEnvironmentConfig,
} from "../dist/index.js";

// Clearly fake, test-only values. Never real credentials.
const FAKE_APP_PASSWORD = "fake-app-password-not-real-0123456789";
const FAKE_ADMIN_PASSWORD = "fake-admin-password-not-real-98765";

function runtimeSource(overrides = {}) {
  return {
    BUSINESS_OS_ENV: "local",
    BUSINESS_OS_DB_HOST: "127.0.0.1",
    BUSINESS_OS_DB_PORT: "55432",
    BUSINESS_OS_DB_NAME: "business_os_local",
    BUSINESS_OS_DB_SSL: "false",
    BUSINESS_OS_DB_APP_USER: "business_os_app",
    BUSINESS_OS_DB_APP_PASSWORD: FAKE_APP_PASSWORD,
    ...overrides,
  };
}

function adminSource(overrides = {}) {
  return {
    ...runtimeSource(),
    BUSINESS_OS_DB_USER: "business_os_local",
    BUSINESS_OS_DB_PASSWORD: FAKE_ADMIN_PASSWORD,
    ...overrides,
  };
}

function captureError(fn) {
  try {
    fn();
  } catch (error) {
    if (!(error instanceof EnvironmentConfigError)) {
      throw error;
    }

    return error;
  }

  throw new Error("Expected environment validation to fail");
}

describe("runtime environment validation", () => {
  test("accepts every supported runtime environment", () => {
    for (const environment of RUNTIME_ENVIRONMENTS) {
      // Production additionally requires TLS, which is asserted separately.
      const ssl = environment === "production" ? "true" : "false";
      const config = parseRuntimeEnvironment(
        runtimeSource({ BUSINESS_OS_ENV: environment, BUSINESS_OS_DB_SSL: ssl }),
      );

      expect(config.environment).toBe(environment);
    }
  });

  test("accepts every supported log level", () => {
    for (const logLevel of LOG_LEVELS) {
      const config = parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_LOG_LEVEL: logLevel }));

      expect(config.logLevel).toBe(logLevel);
    }
  });

  test("defaults the log level to info when absent", () => {
    const source = runtimeSource();
    delete source.BUSINESS_OS_LOG_LEVEL;

    expect(parseRuntimeEnvironment(source).logLevel).toBe("info");
  });

  test("rejects an explicitly empty log level", () => {
    const error = captureError(() =>
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_LOG_LEVEL: "" })),
    );

    expect(error.code).toBe("INVALID_VALUE");
    expect(error.variable).toBe("BUSINESS_OS_LOG_LEVEL");
  });

  test("rejects a missing environment", () => {
    const source = runtimeSource();
    delete source.BUSINESS_OS_ENV;

    const error = captureError(() => parseRuntimeEnvironment(source));

    expect(error.code).toBe("MISSING_REQUIRED_VALUE");
    expect(error.variable).toBe("BUSINESS_OS_ENV");
  });

  test("rejects an invalid environment", () => {
    const error = captureError(() =>
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_ENV: "dev" })),
    );

    expect(error.code).toBe("INVALID_VALUE");
  });

  test("validates the environment case-sensitively", () => {
    expect(
      captureError(() => parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_ENV: "Production" })))
        .code,
    ).toBe("INVALID_VALUE");
    expect(
      captureError(() => parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_ENV: "LOCAL" }))).code,
    ).toBe("INVALID_VALUE");
  });

  test("never silently defaults to local or production", () => {
    const source = runtimeSource();
    delete source.BUSINESS_OS_ENV;

    expect(captureError(() => parseRuntimeEnvironment(source)).code).toBe("MISSING_REQUIRED_VALUE");
  });
});

describe("runtime database validation", () => {
  test("accepts a valid database host", () => {
    expect(parseRuntimeEnvironment(runtimeSource()).database.host).toBe("127.0.0.1");
  });

  test("rejects a missing database host", () => {
    const source = runtimeSource();
    delete source.BUSINESS_OS_DB_HOST;

    const error = captureError(() => parseRuntimeEnvironment(source));

    expect(error.variable).toBe("BUSINESS_OS_DB_HOST");
  });

  test("converts a numeric string port to an integer", () => {
    const config = parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_PORT: "5432" }));

    expect(config.database.port).toBe(5432);
    expect(typeof config.database.port).toBe("number");
  });

  test("accepts valid ports", () => {
    for (const port of ["1", "5432", "55432", "65535"]) {
      expect(
        parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_PORT: port })).database.port,
      ).toBe(Number(port));
    }
  });

  test("rejects invalid ports without permissive coercion", () => {
    for (const port of ["0", "-1", "1.5", "abc", "Infinity", "NaN", "", "   ", "70000", "1e3"]) {
      const error = captureError(() =>
        parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_PORT: port })),
      );

      expect({ port, code: error.code }).toEqual({ port, code: "INVALID_VALUE" });
    }
  });

  test("converts exact boolean strings only", () => {
    expect(
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_SSL: "true" })).database.ssl,
    ).toBe(true);
    expect(
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_SSL: "false" })).database.ssl,
    ).toBe(false);
  });

  test("rejects non-exact boolean values", () => {
    for (const value of ["TRUE", "FALSE", "1", "0", "yes", "no", "", "true "]) {
      expect(
        captureError(() => parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_SSL: value })))
          .code,
      ).toBe("INVALID_VALUE");
    }
  });

  test("rejects a missing runtime database user", () => {
    const source = runtimeSource();
    delete source.BUSINESS_OS_DB_APP_USER;

    expect(captureError(() => parseRuntimeEnvironment(source)).variable).toBe(
      "BUSINESS_OS_DB_APP_USER",
    );
  });

  test("rejects a missing runtime database password", () => {
    const source = runtimeSource();
    delete source.BUSINESS_OS_DB_APP_PASSWORD;

    expect(captureError(() => parseRuntimeEnvironment(source)).variable).toBe(
      "BUSINESS_OS_DB_APP_PASSWORD",
    );
  });

  test("rejects an empty password", () => {
    const error = captureError(() =>
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_APP_PASSWORD: "" })),
    );

    expect(error.code).toBe("INVALID_VALUE");
  });

  test("rejects placeholder passwords", () => {
    const error = captureError(() =>
      parseRuntimeEnvironment(
        runtimeSource({ BUSINESS_OS_DB_APP_PASSWORD: "REPLACE_WITH_STRONG_LOCAL_APP_PASSWORD" }),
      ),
    );

    expect(error.code).toBe("INVALID_VALUE");
  });
});

describe("production TLS policy", () => {
  test("rejects production with TLS disabled", () => {
    const error = captureError(() =>
      parseRuntimeEnvironment(
        runtimeSource({ BUSINESS_OS_ENV: "production", BUSINESS_OS_DB_SSL: "false" }),
      ),
    );

    expect(error.code).toBe("FORBIDDEN_IN_PRODUCTION");
    expect(error.variable).toBe("BUSINESS_OS_DB_SSL");
  });

  test("accepts production with TLS enabled", () => {
    const config = parseRuntimeEnvironment(
      runtimeSource({ BUSINESS_OS_ENV: "production", BUSINESS_OS_DB_SSL: "true" }),
    );

    expect(config.environment).toBe("production");
    expect(config.database.ssl).toBe(true);
  });

  test("allows local with TLS explicitly disabled", () => {
    expect(parseRuntimeEnvironment(runtimeSource()).database.ssl).toBe(false);
  });
});

describe("unknown and unrelated keys", () => {
  test("rejects an unknown BUSINESS_OS_ variable", () => {
    const error = captureError(() =>
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_UNKNOWN_SETTING: "x" })),
    );

    expect(error.code).toBe("UNKNOWN_VARIABLE");
    expect(error.variable).toBe("BUSINESS_OS_UNKNOWN_SETTING");
  });

  test("ignores ordinary operating-system variables", () => {
    const config = parseRuntimeEnvironment(
      runtimeSource({ PATH: "/usr/bin", HOME: "/root", LANG: "en_US.UTF-8" }),
    );

    expect(config.environment).toBe("local");
  });

  test("accepts registered variables owned by another subsystem", () => {
    // Administration variables are registered, so they are not "unknown"
    // even though the runtime parser does not consume them.
    const config = parseRuntimeEnvironment(
      runtimeSource({ BUSINESS_OS_DB_USER: "someone", BUSINESS_OS_DB_PASSWORD: "x" }),
    );

    expect(config.database.user).toBe("business_os_app");
  });
});

describe("runtime output isolation", () => {
  test("never includes administrator credentials", () => {
    const config = parseRuntimeEnvironment(
      runtimeSource({
        BUSINESS_OS_DB_USER: "admin-user-name",
        BUSINESS_OS_DB_PASSWORD: "admin-password-name",
      }),
    );

    const serialized = JSON.stringify(config);

    expect(serialized).not.toContain("admin-user-name");
    expect(serialized).not.toContain("admin-password-name");
    expect(Object.keys(config.database).sort()).toEqual([
      "database",
      "host",
      "password",
      "port",
      "ssl",
      "user",
    ]);
  });
});

describe("local administration parser", () => {
  test("returns administration credentials for local development", () => {
    const config = parseLocalAdminEnvironment(adminSource());

    expect(config.environment).toBe("local");
    expect(config.database.user).toBe("business_os_local");
    expect(config.database.password).toBe(FAKE_ADMIN_PASSWORD);
  });

  test("rejects a non-local runtime", () => {
    const error = captureError(() =>
      parseLocalAdminEnvironment(adminSource({ BUSINESS_OS_ENV: "production" })),
    );

    expect(error.code).toBe("FORBIDDEN_IN_PRODUCTION");
    expect(error.variable).toBe("BUSINESS_OS_ENV");
  });

  test("rejects a missing runtime declaration", () => {
    const source = adminSource();
    delete source.BUSINESS_OS_ENV;

    expect(captureError(() => parseLocalAdminEnvironment(source)).code).toBe(
      "MISSING_REQUIRED_VALUE",
    );
  });

  test("never falls back to application credentials", () => {
    const source = adminSource();
    delete source.BUSINESS_OS_DB_USER;
    delete source.BUSINESS_OS_DB_PASSWORD;

    expect(captureError(() => parseLocalAdminEnvironment(source)).code).toBe(
      "MISSING_REQUIRED_VALUE",
    );
  });

  test("does not return application credentials", () => {
    const config = parseLocalAdminEnvironment(adminSource());

    expect(config.database.user).toBe("business_os_local");
    expect(config.database.password).toBe(FAKE_ADMIN_PASSWORD);
  });
});

describe("immutability and isolation", () => {
  test("returns a deeply frozen configuration", () => {
    const config = parseRuntimeEnvironment(runtimeSource());

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.database)).toBe(true);

    expect(() => {
      config.database.port = 1;
    }).toThrow(TypeError);
  });

  test("never modifies the supplied input", () => {
    const source = runtimeSource();
    const snapshot = { ...source };

    parseRuntimeEnvironment(source);

    expect(source).toEqual(snapshot);
  });

  test("does not read or write global environment state", () => {
    const before = Object.keys(process.env).length;

    parseRuntimeEnvironment(runtimeSource());

    expect(Object.keys(process.env).length).toBe(before);
  });
});

describe("error sanitization", () => {
  test("never includes a rejected secret in the message", () => {
    // A placeholder value is rejected by the secret rule, so it exercises
    // the path where a rejected, user-supplied value must not be echoed.
    const sentinel = "REPLACE_WITH_SENTINEL_SECRET_000";

    const error = captureError(() =>
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_APP_PASSWORD: sentinel })),
    );

    expect(error.message).not.toContain(sentinel);
  });

  test("never serializes a rejected secret in public fields", () => {
    const sentinel = "REPLACE_WITH_SENTINEL_SECRET_111";

    const error = captureError(() =>
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_APP_PASSWORD: sentinel })),
    );

    const serialized = JSON.stringify({
      name: error.name,
      message: error.message,
      code: error.code,
      variable: error.variable,
      keys: Object.keys(error),
    });

    expect(serialized).not.toContain(sentinel);
  });

  test("never attaches a raw zod error as a cause", () => {
    const error = captureError(() =>
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_APP_PASSWORD: "REPLACE_WITH_X" })),
    );

    expect(error.cause).toBeUndefined();

    // Every own enumerable field must be a short primitive, never a
    // nested Zod error, issue array, or environment snapshot.
    for (const [key, value] of Object.entries(error)) {
      expect({ key, type: typeof value }).toEqual({
        key,
        type: expect.stringMatching(/^(string|boolean|number)$/),
      });
    }
  });

  test("reports only the variable and a stable code", () => {
    const error = captureError(() =>
      parseRuntimeEnvironment(runtimeSource({ BUSINESS_OS_DB_HOST: "" })),
    );

    expect(error.name).toBe("EnvironmentConfigError");
    expect(error.message).toBe(
      "Environment configuration error: BUSINESS_OS_DB_HOST (INVALID_VALUE)",
    );
  });
});

describe("diagnostic summaries", () => {
  test("redacts sensitive and non-display-safe values", () => {
    const config = parseRuntimeEnvironment(runtimeSource());
    const summary = summarizeEnvironmentConfig(config);

    expect(summary.BUSINESS_OS_ENV).toBe("local");
    expect(summary.BUSINESS_OS_LOG_LEVEL).toBe("info");
    expect(summary.BUSINESS_OS_DB_PORT).toBe(55432);
    expect(summary.BUSINESS_OS_DB_HOST).toBe(REDACTED_VALUE);
    expect(summary.BUSINESS_OS_DB_NAME).toBe(REDACTED_VALUE);
    expect(summary.BUSINESS_OS_DB_APP_USER).toBe(REDACTED_VALUE);
    expect(summary.BUSINESS_OS_DB_APP_PASSWORD).toBe(REDACTED_VALUE);
    expect(summary.BUSINESS_OS_DB_CONFIGURED).toBe(true);
  });

  test("never reveals a secret in the summary", () => {
    const config = parseRuntimeEnvironment(runtimeSource());

    expect(JSON.stringify(summarizeEnvironmentConfig(config))).not.toContain(FAKE_APP_PASSWORD);
  });

  test("never includes administration credentials in the summary", () => {
    const config = parseLocalAdminEnvironment(adminSource());
    const summary = JSON.stringify(summarizeEnvironmentConfig(config));

    expect(summary).not.toContain(FAKE_ADMIN_PASSWORD);
    expect(summary).not.toContain("business_os_local");
  });

  test("returns a frozen summary", () => {
    const summary = summarizeEnvironmentConfig(parseRuntimeEnvironment(runtimeSource()));

    expect(Object.isFrozen(summary)).toBe(true);
  });
});
