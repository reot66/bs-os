import { describe, expect, test } from "bun:test";

import { BusinessOsError, ERROR_CATALOG, isBusinessOsError } from "../dist/index.js";

// Fake, test-only sentinels. Never real credentials or real SQL.
const SECRET_SENTINEL = "TEST_SECRET_DO_NOT_EXPOSE";
const SQL_SENTINEL = "TEST_SQL_INTERNAL_DETAIL";
const CONTEXT_SENTINEL = "TEST_PRIVATE_CONTEXT";

describe("native Error behaviour", () => {
  test("extends the native Error", () => {
    const error = new BusinessOsError("INTERNAL_ERROR");

    expect(error instanceof Error).toBe(true);
    expect(error instanceof BusinessOsError).toBe(true);
  });

  test("has a meaningful name", () => {
    expect(new BusinessOsError("INTERNAL_ERROR").name).toBe("BusinessOsError");
  });

  test("preserves a useful stack trace", () => {
    const error = new BusinessOsError("INTERNAL_ERROR");

    expect(typeof error.stack).toBe("string");
    expect(error.stack.length).toBeGreaterThan(0);
  });

  test("the native message is the safe public message", () => {
    const error = new BusinessOsError("NOT_FOUND");

    expect(error.message).toBe(ERROR_CATALOG.NOT_FOUND.publicMessage);
  });
});

describe("catalog-backed classification", () => {
  test("preserves the supplied code", () => {
    for (const code of ["VALIDATION_ERROR", "RATE_LIMITED", "DEPENDENCY_UNAVAILABLE"]) {
      expect(new BusinessOsError(code).code).toBe(code);
    }
  });

  test("derives the category from the catalog", () => {
    expect(new BusinessOsError("UNAUTHENTICATED").category).toBe("authentication");
    expect(new BusinessOsError("FORBIDDEN").category).toBe("authorization");
    expect(new BusinessOsError("CONFLICT").category).toBe("domain");
    expect(new BusinessOsError("OPERATION_TIMEOUT").category).toBe("infrastructure");
  });

  test("derives retryability from the catalog", () => {
    expect(new BusinessOsError("RATE_LIMITED").retryable).toBe(true);
    expect(new BusinessOsError("VALIDATION_ERROR").retryable).toBe(false);
  });

  test("uses the default public message from the catalog", () => {
    expect(new BusinessOsError("FORBIDDEN").publicMessage).toBe(
      "You do not have permission to perform this action.",
    );
  });

  test("rejects an unknown code instead of guessing a classification", () => {
    expect(() => new BusinessOsError("NOT_A_REAL_CODE")).toThrow(TypeError);
  });
});

describe("internal diagnostics", () => {
  test("an internal message may differ from the public message", () => {
    const error = new BusinessOsError("DEPENDENCY_UNAVAILABLE", {
      internalMessage: SQL_SENTINEL,
    });

    expect(error.internalMessage).toBe(SQL_SENTINEL);
    expect(error.publicMessage).toBe("The service is temporarily unavailable.");
    expect(error.message).toBe("The service is temporarily unavailable.");
    expect(error.message).not.toBe(SQL_SENTINEL);
  });

  test("the internal message is not enumerable", () => {
    const error = new BusinessOsError("INTERNAL_ERROR", { internalMessage: SQL_SENTINEL });

    expect(Object.keys(error)).not.toContain("internalMessage");
  });

  test("private context is readable by trusted code but not enumerable", () => {
    const error = new BusinessOsError("INTERNAL_ERROR", { context: { query: CONTEXT_SENTINEL } });

    expect(error.context).toEqual({ query: CONTEXT_SENTINEL });
    expect(Object.keys(error)).not.toContain("context");
  });

  test("hidden diagnostic properties cannot be reassigned", () => {
    const error = new BusinessOsError("INTERNAL_ERROR", {
      internalMessage: SQL_SENTINEL,
      context: { query: CONTEXT_SENTINEL },
    });

    try {
      error.internalMessage = "overwritten";
    } catch {
      // Non-writable, as intended.
    }

    try {
      error.context = {};
    } catch {
      // Non-writable, as intended.
    }

    expect(error.internalMessage).toBe(SQL_SENTINEL);
    expect(error.context).toEqual({ query: CONTEXT_SENTINEL });
  });
});

describe("cause handling", () => {
  test("preserves an Error cause", () => {
    const cause = new Error("original failure");
    const error = new BusinessOsError("DEPENDENCY_UNAVAILABLE", { cause });

    expect(error.cause).toBe(cause);
  });

  test("supports non-Error causes without stringifying them", () => {
    const cause = { detail: CONTEXT_SENTINEL };
    const error = new BusinessOsError("INTERNAL_ERROR", { cause });

    expect(error.cause).toBe(cause);
    expect(typeof error.cause).toBe("object");
  });

  test("supports primitive causes", () => {
    for (const cause of ["a string", 42, true, null]) {
      const error = new BusinessOsError("INTERNAL_ERROR", { cause });

      expect(error.cause).toBe(cause);
    }
  });

  test("the cause is not enumerable", () => {
    const error = new BusinessOsError("INTERNAL_ERROR", { cause: new Error(SECRET_SENTINEL) });

    expect(Object.keys(error)).not.toContain("cause");
  });

  test("does not mutate the original cause", () => {
    const cause = new Error("original");
    const before = cause.message;

    const error = new BusinessOsError("INTERNAL_ERROR", { cause });
    error.cause = undefined;

    expect(cause.message).toBe(before);
  });

  test("omits cause entirely when not supplied", () => {
    const error = new BusinessOsError("INTERNAL_ERROR");

    expect(error.cause).toBeUndefined();
    expect(Object.keys(error)).not.toContain("cause");
  });
});

describe("privacy boundary", () => {
  test("ordinary JSON serialization exposes only safe fields", () => {
    const error = new BusinessOsError("DEPENDENCY_UNAVAILABLE", {
      internalMessage: SQL_SENTINEL,
      cause: new Error(SECRET_SENTINEL),
      context: { query: CONTEXT_SENTINEL },
    });

    const serialized = JSON.stringify(error);

    expect(serialized).not.toContain(SECRET_SENTINEL);
    expect(serialized).not.toContain(SQL_SENTINEL);
    expect(serialized).not.toContain(CONTEXT_SENTINEL);
    expect(Object.keys(JSON.parse(serialized)).sort()).toEqual(["code", "message", "retryable"]);
  });

  test("the stack trace is not enumerable", () => {
    const error = new BusinessOsError("INTERNAL_ERROR");

    expect(Object.keys(error)).not.toContain("stack");
  });

  test("spreading an error does not expose diagnostics", () => {
    const error = new BusinessOsError("INTERNAL_ERROR", {
      internalMessage: SQL_SENTINEL,
      cause: new Error(SECRET_SENTINEL),
      context: { query: CONTEXT_SENTINEL },
    });

    const spread = { ...error };
    const serialized = JSON.stringify(spread);

    expect(serialized).not.toContain(SECRET_SENTINEL);
    expect(serialized).not.toContain(SQL_SENTINEL);
    expect(serialized).not.toContain(CONTEXT_SENTINEL);
  });
});

describe("construction is inert", () => {
  test("construction requires no environment variables", () => {
    const before = { ...process.env };

    const error = new BusinessOsError("VALIDATION_ERROR");

    expect(error.code).toBe("VALIDATION_ERROR");
    expect({ ...process.env }).toEqual(before);
  });

  test("construction requires no database connection", () => {
    expect(() => {
      new BusinessOsError("DEPENDENCY_UNAVAILABLE");
    }).not.toThrow();
  });

  test("construction performs no logging", () => {
    const originalWrite = process.stdout.write.bind(process.stdout);
    let writes = 0;

    process.stdout.write = (...args) => {
      writes += 1;
      return originalWrite(...args);
    };

    try {
      const error = new BusinessOsError("INTERNAL_ERROR", {
        internalMessage: SQL_SENTINEL,
        cause: new Error(SECRET_SENTINEL),
      });

      expect(error).toBeInstanceOf(Error);
    } finally {
      process.stdout.write = originalWrite;
    }

    expect(writes).toBe(0);
  });

  test("creating an error creates no global error state", () => {
    new BusinessOsError("INTERNAL_ERROR");

    expect(globalThis.BusinessOsError).toBeUndefined();
  });
});

describe("type guard", () => {
  test("recognizes genuine platform errors", () => {
    expect(isBusinessOsError(new BusinessOsError("NOT_FOUND"))).toBe(true);
  });

  test("rejects unrelated native errors", () => {
    expect(isBusinessOsError(new Error("plain"))).toBe(false);
    expect(isBusinessOsError(new TypeError("plain"))).toBe(false);
  });

  test("rejects plain objects pretending to be platform errors", () => {
    expect(isBusinessOsError({ code: "FORBIDDEN", message: "Fake privileged error" })).toBe(false);
    expect(
      isBusinessOsError({ code: "FORBIDDEN", category: "authorization", retryable: false }),
    ).toBe(false);
  });

  test("rejects null, undefined, and primitives", () => {
    for (const value of [null, undefined, 0, "", false, Symbol("x")]) {
      expect(isBusinessOsError(value)).toBe(false);
    }
  });
});
