import { describe, expect, test } from "bun:test";

import {
  BusinessOsError,
  ERROR_CATALOG,
  isBusinessOsError,
  normalizeUnknownError,
  toPublicError,
} from "../dist/index.js";

// Fake, test-only sentinels. Never real credentials or real SQL.
const SECRET_SENTINEL = "TEST_SECRET_DO_NOT_EXPOSE";
const SQL_SENTINEL = "TEST_SQL_INTERNAL_DETAIL";
const CONTEXT_SENTINEL = "TEST_PRIVATE_CONTEXT";
const SENTINELS = [SECRET_SENTINEL, SQL_SENTINEL, CONTEXT_SENTINEL];

function expectNoSentinel(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);

  for (const sentinel of SENTINELS) {
    expect({ sentinel, present: text.includes(sentinel) }).toEqual({ sentinel, present: false });
  }
}

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

describe("immutable classification (FND-009-FIX1)", () => {
  test("publicMessage cannot be replaced with a sensitive value", () => {
    const error = new BusinessOsError("VALIDATION_ERROR");

    expect(() => {
      error.publicMessage = `leaked ${SECRET_SENTINEL}`;
    }).toThrow(TypeError);

    expect(error.publicMessage).toBe("The request is invalid.");
  });

  test("JSON serialization cannot disclose a tampered public message", () => {
    const error = new BusinessOsError("VALIDATION_ERROR");

    try {
      error.publicMessage = `leaked ${SECRET_SENTINEL}`;
    } catch {
      // Expected: the property is read-only.
    }

    const serialized = JSON.stringify(error);

    expect(serialized).not.toContain(SECRET_SENTINEL);
    expect(JSON.parse(serialized).message).toBe("The request is invalid.");
  });

  test("classification properties cannot be reassigned", () => {
    const error = new BusinessOsError("VALIDATION_ERROR");

    for (const property of ["code", "category", "retryable", "publicMessage"]) {
      expect(() => {
        error[property] = "tampered";
      }).toThrow(TypeError);
    }
  });

  test("tampering cannot change trusted classification", () => {
    const error = new BusinessOsError("VALIDATION_ERROR");

    for (const property of ["code", "category", "retryable", "publicMessage"]) {
      try {
        error[property] = "tampered";
      } catch {
        // Expected: the property is read-only.
      }
    }

    expect({ code: error.code, category: error.category, retryable: error.retryable }).toEqual({
      code: "VALIDATION_ERROR",
      category: "validation",
      retryable: false,
    });
  });

  test("a tampered error still serializes to the catalog shape", () => {
    const error = new BusinessOsError("RATE_LIMITED", {
      internalMessage: SQL_SENTINEL,
      cause: new Error(SECRET_SENTINEL),
      context: { query: CONTEXT_SENTINEL },
    });

    try {
      error.publicMessage = `leaked ${SECRET_SENTINEL}`;
      error.code = "INTERNAL_ERROR";
    } catch {
      // Expected: read-only.
    }

    const parsed = JSON.parse(JSON.stringify(error));

    expect(Object.keys(parsed).sort()).toEqual(["code", "message", "retryable"]);
    expect(parsed.code).toBe("RATE_LIMITED");
    expect(parsed.message).toBe(ERROR_CATALOG.RATE_LIMITED.publicMessage);
    expect(parsed.retryable).toBe(true);
    expectNoSentinel(JSON.stringify(parsed));
  });

  test("instanceof still recognizes genuine instances", () => {
    const error = new BusinessOsError("NOT_FOUND");

    expect(error instanceof BusinessOsError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe("genuine identity is not forgeable (FND-009-FIX1)", () => {
  test("an object with the correct prototype is not a platform error", () => {
    const forged = Object.create(BusinessOsError.prototype);

    expect(forged instanceof BusinessOsError).toBe(true);
    expect(isBusinessOsError(forged)).toBe(false);
  });

  test("a forged object cannot receive a trusted classification", () => {
    const forged = Object.create(BusinessOsError.prototype);

    // Own properties shadow the prototype accessors, so the forged object
    // presents a convincing-looking classification on the surface.
    for (const [property, value] of Object.entries({
      code: "FORBIDDEN",
      category: "authorization",
      retryable: false,
      publicMessage: "Leaked privileged detail.",
    })) {
      Object.defineProperty(forged, property, { value, enumerable: true, configurable: true });
    }

    expect(isBusinessOsError(forged)).toBe(false);
    expect(normalizeUnknownError(forged).code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(toPublicError(forged))).not.toContain("Leaked privileged detail.");
  });

  test("a brand cannot be forged by copying own properties", () => {
    const genuine = new BusinessOsError("FORBIDDEN");
    const clone = Object.create(BusinessOsError.prototype);

    for (const key of Object.keys(genuine)) {
      Object.defineProperty(clone, key, {
        value: genuine[key],
        enumerable: true,
        configurable: true,
      });
    }

    expect(isBusinessOsError(clone)).toBe(false);
  });

  test("the brand check contains hostile proxies without throwing", () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("hostile trap");
        },
      },
    );

    expect(() => {
      isBusinessOsError(hostile);
    }).not.toThrow();

    expect(isBusinessOsError(hostile)).toBe(false);
  });

  test("the brand check contains a revoked proxy", () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() => {
      isBusinessOsError(revocable.proxy);
    }).not.toThrow();

    expect(isBusinessOsError(revocable.proxy)).toBe(false);
  });
});

describe("genuine identity is unforgeable (FND-009-FIX2)", () => {
  /** Every proxy trick that could otherwise satisfy a brand-style check. */
  function forgeryVectors() {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();

    return [
      ["Object.create(prototype)", Object.create(BusinessOsError.prototype)],
      ["proxy lying has trap", new Proxy({}, { has: () => true })],
      [
        "proxy with forged prototype",
        new Proxy({}, { getPrototypeOf: () => BusinessOsError.prototype }),
      ],
      [
        "proxy with lying has and forged prototype",
        new Proxy(
          {},
          {
            has: () => true,
            getPrototypeOf: () => BusinessOsError.prototype,
          },
        ),
      ],
      ["revoked proxy", revoked.proxy],
    ];
  }

  test("a real instance is recognized", () => {
    expect(isBusinessOsError(new BusinessOsError("FORBIDDEN"))).toBe(true);
    expect(isBusinessOsError(new BusinessOsError("INTERNAL_ERROR"))).toBe(true);
  });

  test.each(forgeryVectors())("rejects %s", (_label, value) => {
    expect(isBusinessOsError(value)).toBe(false);
  });

  test("a proxy wrapping a genuine error is not treated as genuine", () => {
    // Fail closed: a proxy can lie, so it is never trusted even when it
    // wraps a real error.
    const wrapped = new Proxy(new BusinessOsError("FORBIDDEN"), {});

    expect(isBusinessOsError(wrapped)).toBe(false);
  });

  test("hostile get, has, and getPrototypeOf traps never execute", () => {
    const fired = [];

    const hostile = new Proxy(
      {},
      {
        has() {
          fired.push("has");
          return true;
        },
        get() {
          fired.push("get");
          return 1;
        },
        getPrototypeOf() {
          fired.push("getPrototypeOf");
          return BusinessOsError.prototype;
        },
      },
    );

    const result = isBusinessOsError(hostile);

    expect({ result, fired }).toEqual({ result: false, fired: [] });
  });

  test("a revoked proxy is rejected without throwing", () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() => {
      isBusinessOsError(revocable.proxy);
    }).not.toThrow();

    expect(isBusinessOsError(revocable.proxy)).toBe(false);
  });

  test("no mechanism is exposed for registering a foreign object", async () => {
    const module = await import("../dist/index.js");

    expect(Object.keys(module).sort()).toEqual([
      "BusinessOsError",
      "ERROR_CATALOG",
      "ERROR_CATEGORIES",
      "ERROR_CODES",
      "getErrorCatalogEntry",
      "isBusinessOsError",
      "isErrorCode",
      "normalizeUnknownError",
      "toPublicError",
    ]);

    for (const key of Object.keys(module)) {
      expect({ key, type: typeof module[key] }).toEqual({
        key,
        type: expect.stringMatching(/^(string|number|boolean|function|object)$/),
      });
    }

    // Nothing on the class can register an arbitrary object either.
    const classKeys = [
      ...Object.getOwnPropertyNames(BusinessOsError),
      ...Object.getOwnPropertyNames(BusinessOsError.prototype),
    ];

    for (const key of classKeys) {
      expect({ key, registers: /^(register|add|set|brand|trust)$/i.test(key) }).toEqual({
        key,
        registers: false,
      });
    }
  });

  test("the registry is not reachable as an exported symbol", () => {
    // The WeakSet is module-private: nothing enumerable exposes it.
    expect(Object.getOwnPropertySymbols(BusinessOsError.prototype)).toEqual([]);
    expect(Object.getOwnPropertyNames(BusinessOsError.prototype).join(",")).not.toContain(
      "WeakSet",
    );
  });

  test("genuine instances retain their original classification", () => {
    for (const code of [
      "VALIDATION_ERROR",
      "RATE_LIMITED",
      "DEPENDENCY_UNAVAILABLE",
      "NOT_FOUND",
    ]) {
      const error = new BusinessOsError(code);

      expect({
        code: error.code,
        category: error.category,
        retryable: error.retryable,
        recognized: isBusinessOsError(error),
      }).toEqual({
        code,
        category: ERROR_CATALOG[code].category,
        retryable: ERROR_CATALOG[code].retryable,
        recognized: true,
      });
    }
  });
});
