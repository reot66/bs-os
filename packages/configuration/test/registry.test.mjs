import { describe, expect, test } from "bun:test";

import {
  DATABASE_CONNECTION_VARIABLES,
  DEFAULT_LOG_LEVEL,
  ENVIRONMENT_VARIABLE_CATEGORIES,
  ENVIRONMENT_VARIABLE_GROUPS,
  ENVIRONMENT_VARIABLE_OWNERS,
  ENVIRONMENT_VARIABLE_REGISTRY,
  ENVIRONMENT_VARIABLE_SCOPES,
  LOCAL_ADMIN_ENVIRONMENT_VARIABLES,
  LOG_LEVELS,
  REDACTED_VALUE,
  REGISTERED_ENVIRONMENT_VARIABLES,
  RUNTIME_ENVIRONMENTS,
  RUNTIME_ENVIRONMENT_VARIABLES,
  SENSITIVE_ENVIRONMENT_VARIABLES,
  findEnvironmentVariable,
  findUnregisteredPlatformVariables,
  isRegisteredEnvironmentVariable,
  isUnregisteredPlatformVariable,
  parseRuntimeEnvironment,
  summarizeEnvironmentConfig,
} from "../dist/index.js";

const EXPECTED_VARIABLES = [
  "BUSINESS_OS_ENV",
  "BUSINESS_OS_LOG_LEVEL",
  "BUSINESS_OS_DB_HOST",
  "BUSINESS_OS_DB_PORT",
  "BUSINESS_OS_DB_NAME",
  "BUSINESS_OS_DB_SSL",
  "BUSINESS_OS_DB_APP_USER",
  "BUSINESS_OS_DB_APP_PASSWORD",
  "BUSINESS_OS_DB_USER",
  "BUSINESS_OS_DB_PASSWORD",
];

describe("registry inventory", () => {
  test("contains exactly the approved variable set", () => {
    expect([...REGISTERED_ENVIRONMENT_VARIABLES].sort()).toEqual([...EXPECTED_VARIABLES].sort());
  });

  test("registers every variable exactly once", () => {
    const names = ENVIRONMENT_VARIABLE_REGISTRY.map((entry) => entry.variable);

    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(EXPECTED_VARIABLES.length);
  });

  test("exposes the canonical value lists without duplication", () => {
    expect([...RUNTIME_ENVIRONMENTS]).toEqual(["local", "test", "staging", "production"]);
    expect([...LOG_LEVELS]).toEqual(["debug", "info", "warn", "error"]);
    expect(DEFAULT_LOG_LEVEL).toBe("info");
  });
});

describe("registry metadata completeness", () => {
  test("every entry has a validation schema", () => {
    for (const entry of ENVIRONMENT_VARIABLE_REGISTRY) {
      expect({ variable: entry.variable, hasSchema: typeof entry.schema?.safeParse }).toEqual({
        variable: entry.variable,
        hasSchema: "function",
      });
    }
  });

  test("every entry has complete descriptive metadata", () => {
    for (const entry of ENVIRONMENT_VARIABLE_REGISTRY) {
      expect({
        variable: entry.variable,
        category: ENVIRONMENT_VARIABLE_CATEGORIES.includes(entry.category),
        owner: ENVIRONMENT_VARIABLE_OWNERS.includes(entry.owner),
        scope: ENVIRONMENT_VARIABLE_SCOPES.includes(entry.scope),
        group: ENVIRONMENT_VARIABLE_GROUPS.includes(entry.group),
        restartRequired: typeof entry.restartRequired,
        description: typeof entry.description === "string" && entry.description.length > 0,
      }).toEqual({
        variable: entry.variable,
        category: true,
        owner: true,
        scope: true,
        group: true,
        restartRequired: "boolean",
        description: true,
      });
    }
  });

  test("every variable name uses the platform prefix", () => {
    for (const name of REGISTERED_ENVIRONMENT_VARIABLES) {
      expect(name.startsWith("BUSINESS_OS_")).toBe(true);
    }
  });
});

describe("secret classification", () => {
  test("classifies both database passwords as secrets", () => {
    expect([...SENSITIVE_ENVIRONMENT_VARIABLES].sort()).toEqual([
      "BUSINESS_OS_DB_APP_PASSWORD",
      "BUSINESS_OS_DB_PASSWORD",
    ]);
  });

  test("does not misclassify non-secret entries as credentials", () => {
    for (const entry of ENVIRONMENT_VARIABLE_REGISTRY) {
      if (entry.variable.endsWith("PASSWORD")) {
        expect({ variable: entry.variable, sensitive: entry.sensitive }).toEqual({
          variable: entry.variable,
          sensitive: true,
        });
      } else {
        expect({ variable: entry.variable, sensitive: entry.sensitive }).toEqual({
          variable: entry.variable,
          sensitive: false,
        });
      }
    }
  });

  test("never marks a secret as safe to display", () => {
    for (const entry of ENVIRONMENT_VARIABLE_REGISTRY) {
      if (entry.sensitive === true) {
        expect({ variable: entry.variable, displaySafe: entry.displaySafe }).toEqual({
          variable: entry.variable,
          displaySafe: false,
        });
      }
    }
  });

  test("the registry stores no credential values", () => {
    const serialized = JSON.stringify(
      ENVIRONMENT_VARIABLE_REGISTRY.map((entry) => ({
        variable: entry.variable,
        category: entry.category,
        owner: entry.owner,
        scope: entry.scope,
        group: entry.group,
        required: entry.required,
        defaultValue: entry.defaultValue ?? null,
        sensitive: entry.sensitive,
        displaySafe: entry.displaySafe,
        restartRequired: entry.restartRequired,
        description: entry.description,
      })),
    );

    expect(serialized).not.toMatch(/password["'\\s:=]+["']?[a-z0-9]/i);
    expect(serialized).not.toContain("REPLACE_WITH_STRONG_LOCAL_PASSWORD");
  });
});

describe("registry immutability", () => {
  test("freezes the registry array", () => {
    expect(Object.isFrozen(ENVIRONMENT_VARIABLE_REGISTRY)).toBe(true);
  });

  test("freezes every definition", () => {
    for (const entry of ENVIRONMENT_VARIABLE_REGISTRY) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  test("freezes the derived name lists", () => {
    for (const list of [
      REGISTERED_ENVIRONMENT_VARIABLES,
      RUNTIME_ENVIRONMENT_VARIABLES,
      LOCAL_ADMIN_ENVIRONMENT_VARIABLES,
      DATABASE_CONNECTION_VARIABLES,
      SENSITIVE_ENVIRONMENT_VARIABLES,
      RUNTIME_ENVIRONMENTS,
      LOG_LEVELS,
    ]) {
      expect(Object.isFrozen(list)).toBe(true);
    }
  });

  test("a mutation attempt does not change the registry", () => {
    const before = [...REGISTERED_ENVIRONMENT_VARIABLES];

    try {
      ENVIRONMENT_VARIABLE_REGISTRY.push({});
    } catch {
      // Frozen arrays throw in strict mode, which is the expected outcome.
    }

    expect([...REGISTERED_ENVIRONMENT_VARIABLES]).toEqual(before);
  });
});

describe("registry lookup", () => {
  test("finds registered variables", () => {
    for (const name of EXPECTED_VARIABLES) {
      expect(isRegisteredEnvironmentVariable(name)).toBe(true);
      expect(findEnvironmentVariable(name)?.variable).toBe(name);
    }
  });

  test("rejects unregistered platform variables", () => {
    expect(isRegisteredEnvironmentVariable("BUSINESS_OS_NOT_REAL")).toBe(false);
    expect(isUnregisteredPlatformVariable("BUSINESS_OS_NOT_REAL")).toBe(true);
    expect(isUnregisteredPlatformVariable("PATH")).toBe(false);
    expect(findEnvironmentVariable("BUSINESS_OS_NOT_REAL")).toBeUndefined();
  });

  test("separates runtime variables from local administration variables", () => {
    const runtimeNames = RUNTIME_ENVIRONMENT_VARIABLES.map((entry) => entry.variable);
    const adminNames = LOCAL_ADMIN_ENVIRONMENT_VARIABLES.map((entry) => entry.variable);

    expect(runtimeNames).not.toContain("BUSINESS_OS_DB_USER");
    expect(runtimeNames).not.toContain("BUSINESS_OS_DB_PASSWORD");
    expect(adminNames).toEqual(["BUSINESS_OS_DB_USER", "BUSINESS_OS_DB_PASSWORD"]);
  });
});

describe("drift detection", () => {
  test("detects a newly registered variable as template drift", () => {
    // Simulates a future variable that has been added to the registry but
    // is not yet documented in .env.example.
    const hypotheticalRegistry = [...REGISTERED_ENVIRONMENT_VARIABLES, "BUSINESS_OS_FUTURE_FLAG"];
    const documentedExample = [...EXPECTED_VARIABLES];

    const missing = hypotheticalRegistry.filter((name) => !documentedExample.includes(name));

    expect(missing).toEqual(["BUSINESS_OS_FUTURE_FLAG"]);
  });

  test("detects undocumented example variables", () => {
    const documentedExample = [...EXPECTED_VARIABLES, "BUSINESS_OS_UNDOCUMENTED"];
    const registry = [...REGISTERED_ENVIRONMENT_VARIABLES];

    expect(documentedExample.filter((name) => !registry.includes(name))).toEqual([
      "BUSINESS_OS_UNDOCUMENTED",
    ]);
  });

  test("reports no drift for the current inventory", () => {
    expect(
      findUnregisteredPlatformVariables([...REGISTERED_ENVIRONMENT_VARIABLES, "PATH", "HOME"]),
    ).toEqual([]);
  });
});

describe("redaction derives from registry metadata", () => {
  test("redaction follows each entry's displaySafe flag", () => {
    const config = parseRuntimeEnvironment({
      BUSINESS_OS_ENV: "local",
      BUSINESS_OS_DB_HOST: "127.0.0.1",
      BUSINESS_OS_DB_PORT: "55432",
      BUSINESS_OS_DB_NAME: "business_os_local",
      BUSINESS_OS_DB_SSL: "false",
      BUSINESS_OS_DB_APP_USER: "business_os_app",
      BUSINESS_OS_DB_APP_PASSWORD: "fake-registry-password-not-real",
    });

    const summary = summarizeEnvironmentConfig(config);

    for (const entry of ENVIRONMENT_VARIABLE_REGISTRY) {
      if (!(entry.variable in summary)) {
        continue;
      }

      const expected = entry.displaySafe === true && entry.sensitive !== true;

      if (expected) {
        expect(summary[entry.variable]).not.toBe(REDACTED_VALUE);
      } else {
        expect(summary[entry.variable]).toBe(REDACTED_VALUE);
      }
    }
  });

  test("every registered variable carries explicit redaction metadata", () => {
    for (const entry of ENVIRONMENT_VARIABLE_REGISTRY) {
      expect({
        variable: entry.variable,
        hasSensitive: typeof entry.sensitive === "boolean",
        hasDisplaySafe: typeof entry.displaySafe === "boolean",
      }).toEqual({
        variable: entry.variable,
        hasSensitive: true,
        hasDisplaySafe: true,
      });
    }
  });
});

describe("public output types match validation behavior", () => {
  test("runtime-visible variables are exactly those the runtime parser accepts", () => {
    const runtimeNames = RUNTIME_ENVIRONMENT_VARIABLES.map((entry) => entry.variable);

    expect(runtimeNames).toEqual([
      "BUSINESS_OS_ENV",
      "BUSINESS_OS_LOG_LEVEL",
      "BUSINESS_OS_DB_HOST",
      "BUSINESS_OS_DB_PORT",
      "BUSINESS_OS_DB_NAME",
      "BUSINESS_OS_DB_SSL",
      "BUSINESS_OS_DB_APP_USER",
      "BUSINESS_OS_DB_APP_PASSWORD",
    ]);
  });

  test("an omitted optional variable is accepted and defaulted", () => {
    const optionalEntries = ENVIRONMENT_VARIABLE_REGISTRY.filter(
      (entry) => entry.required === false,
    );

    expect(optionalEntries.map((entry) => entry.variable)).toEqual(["BUSINESS_OS_LOG_LEVEL"]);
    expect(optionalEntries[0]?.defaultValue).toBe(DEFAULT_LOG_LEVEL);
  });

  test("a missing required variable is always rejected", () => {
    for (const entry of ENVIRONMENT_VARIABLE_REGISTRY.filter(
      (item) => item.required === true && item.scope === "runtime",
    )) {
      const source = {
        BUSINESS_OS_ENV: "local",
        BUSINESS_OS_DB_HOST: "127.0.0.1",
        BUSINESS_OS_DB_PORT: "55432",
        BUSINESS_OS_DB_NAME: "business_os_local",
        BUSINESS_OS_DB_SSL: "false",
        BUSINESS_OS_DB_APP_USER: "business_os_app",
        BUSINESS_OS_DB_APP_PASSWORD: "fake-registry-password-not-real",
      };

      delete source[entry.variable];

      expect({
        variable: entry.variable,
        throws: willThrow(() => parseRuntimeEnvironment(source)),
      }).toEqual({ variable: entry.variable, throws: true });
    }
  });
});

function willThrow(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}
