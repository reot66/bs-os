import { describe, expect, test } from "bun:test";

import {
  BootstrapConfigError,
  LOG_LEVELS,
  RUNTIME_ENVIRONMENTS,
  parseBootstrapConfig,
} from "../dist/index.js";

function captureConfigError(values) {
  try {
    parseBootstrapConfig(values);
  } catch (error) {
    if (!(error instanceof BootstrapConfigError)) {
      throw error;
    }

    return error;
  }

  throw new Error("Expected configuration validation to fail");
}

describe("Business OS bootstrap configuration", () => {
  test("accepts local with the default log level", () => {
    const config = parseBootstrapConfig({
      BUSINESS_OS_ENV: "local",
    });

    expect(config).toEqual({
      environment: "local",
      logLevel: "info",
    });
  });

  test("accepts an explicit log level", () => {
    const config = parseBootstrapConfig({
      BUSINESS_OS_ENV: "production",
      BUSINESS_OS_LOG_LEVEL: "warn",
    });

    expect(config.environment).toBe("production");
    expect(config.logLevel).toBe("warn");
  });

  for (const environment of RUNTIME_ENVIRONMENTS) {
    test(`accepts environment: ${environment}`, () => {
      const config = parseBootstrapConfig({
        BUSINESS_OS_ENV: environment,
      });

      expect(config.environment).toBe(environment);
    });
  }

  for (const level of LOG_LEVELS) {
    test(`accepts log level: ${level}`, () => {
      const config = parseBootstrapConfig({
        BUSINESS_OS_ENV: "test",
        BUSINESS_OS_LOG_LEVEL: level,
      });

      expect(config.logLevel).toBe(level);
    });
  }

  test("rejects a missing environment", () => {
    const error = captureConfigError({});

    expect(error.code).toBe("MISSING_REQUIRED_VALUE");
    expect(error.key).toBe("BUSINESS_OS_ENV");
  });

  test("rejects an empty environment", () => {
    const error = captureConfigError({
      BUSINESS_OS_ENV: "",
    });

    expect(error.code).toBe("MISSING_REQUIRED_VALUE");
  });

  test("rejects an unknown environment", () => {
    const error = captureConfigError({
      BUSINESS_OS_ENV: "unknown",
    });

    expect(error.code).toBe("INVALID_VALUE");
    expect(error.key).toBe("BUSINESS_OS_ENV");
  });

  test("rejects incorrectly cased environments", () => {
    const error = captureConfigError({
      BUSINESS_OS_ENV: "PRODUCTION",
    });

    expect(error.code).toBe("INVALID_VALUE");
  });

  test("rejects an empty log level", () => {
    const error = captureConfigError({
      BUSINESS_OS_ENV: "local",
      BUSINESS_OS_LOG_LEVEL: "",
    });

    expect(error.code).toBe("INVALID_VALUE");
    expect(error.key).toBe("BUSINESS_OS_LOG_LEVEL");
  });

  test("rejects an unknown log level", () => {
    const error = captureConfigError({
      BUSINESS_OS_ENV: "test",
      BUSINESS_OS_LOG_LEVEL: "verbose",
    });

    expect(error.code).toBe("INVALID_VALUE");
  });

  test("does not expose rejected values in errors", () => {
    const rejectedValue = "private-value-example";

    const error = captureConfigError({
      BUSINESS_OS_ENV: rejectedValue,
    });

    expect(error.message).not.toContain(rejectedValue);
    expect(error.message).toContain("BUSINESS_OS_ENV");
  });

  test("returns an immutable configuration", () => {
    const config = parseBootstrapConfig({
      BUSINESS_OS_ENV: "production",
    });

    expect(Object.isFrozen(config)).toBe(true);
  });

  test("does not modify the input object", () => {
    const input = {
      BUSINESS_OS_ENV: "local",
    };

    parseBootstrapConfig(input);

    expect(input).toEqual({
      BUSINESS_OS_ENV: "local",
    });
  });

  test("ignores unrelated environment variables", () => {
    const config = parseBootstrapConfig({
      BUSINESS_OS_ENV: "local",
      UNRELATED_SYSTEM_VARIABLE: "example",
    });

    expect(config).toEqual({
      environment: "local",
      logLevel: "info",
    });
  });

  test("does not use an implicit runtime environment", () => {
    const error = captureConfigError({});

    expect(error.code).toBe("MISSING_REQUIRED_VALUE");
  });
});
