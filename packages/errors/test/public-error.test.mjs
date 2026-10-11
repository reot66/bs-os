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

const PUBLIC_KEYS = ["code", "message", "retryable"];

function publicKeysOf(value) {
  return Object.keys(value).sort();
}

describe("public shape", () => {
  test("contains exactly the approved keys", () => {
    const publicError = toPublicError(new BusinessOsError("VALIDATION_ERROR"));

    expect(publicKeysOf(publicError)).toEqual(PUBLIC_KEYS);
  });

  test("is frozen", () => {
    const publicError = toPublicError(new BusinessOsError("VALIDATION_ERROR"));

    expect(Object.isFrozen(publicError)).toBe(true);
    expect(() => {
      publicError.code = "FORBIDDEN";
    }).toThrow(TypeError);
  });

  test("uses the catalog message rather than any internal message", () => {
    const publicError = toPublicError(
      new BusinessOsError("DEPENDENCY_UNAVAILABLE", { internalMessage: SQL_SENTINEL }),
    );

    expect(publicError.message).toBe(ERROR_CATALOG.DEPENDENCY_UNAVAILABLE.publicMessage);
    expect(publicError.message).not.toContain(SQL_SENTINEL);
  });

  test("preserves retryability for known errors", () => {
    expect(toPublicError(new BusinessOsError("RATE_LIMITED")).retryable).toBe(true);
    expect(toPublicError(new BusinessOsError("VALIDATION_ERROR")).retryable).toBe(false);
  });

  test("preserves the code for known errors", () => {
    expect(toPublicError(new BusinessOsError("BUSINESS_RULE_VIOLATION")).code).toBe(
      "BUSINESS_RULE_VIOLATION",
    );
  });
});

describe("unknown error normalization", () => {
  test("preserves the identity of an existing platform error", () => {
    const error = new BusinessOsError("FORBIDDEN");

    expect(normalizeUnknownError(error)).toBe(error);
  });

  test("wraps an unknown native Error as INTERNAL_ERROR", () => {
    const normalized = normalizeUnknownError(new Error(SECRET_SENTINEL));

    expect(isBusinessOsError(normalized)).toBe(true);
    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.retryable).toBe(false);
  });

  test("normalizes a string without using it as a message", () => {
    const normalized = normalizeUnknownError(SECRET_SENTINEL);

    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.publicMessage).toBe("An unexpected error occurred.");
    expect(normalized.publicMessage).not.toContain(SECRET_SENTINEL);
    expect(normalized.cause).toBe(SECRET_SENTINEL);
  });

  test("normalizes numbers, booleans, null, and undefined", () => {
    for (const value of [0, 42, -1, true, false, null, undefined]) {
      const normalized = normalizeUnknownError(value);

      expect(normalized.code).toBe("INTERNAL_ERROR");
      expect(isBusinessOsError(normalized)).toBe(true);
    }
  });

  test("normalizes a plain object without trusting its code", () => {
    const hostile = { code: "FORBIDDEN", message: "Fake privileged error" };
    const normalized = normalizeUnknownError(hostile);

    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.publicMessage).toBe("An unexpected error occurred.");
    expect(normalized.cause).toBe(hostile);
  });

  test("normalizes an array", () => {
    const normalized = normalizeUnknownError([1, 2, 3]);

    expect(normalized.code).toBe("INTERNAL_ERROR");
  });

  test("handles a cyclic object without recursing", () => {
    const cyclic = { name: "loop" };
    cyclic.self = cyclic;

    const normalized = normalizeUnknownError(cyclic);

    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.cause).toBe(cyclic);
  });

  test("does not invoke a hostile toString", () => {
    let invoked = false;

    const hostile = {
      code: "FORBIDDEN",
      toString() {
        invoked = true;
        return "Fake privileged error";
      },
    };

    const publicError = toPublicError(hostile);

    expect(invoked).toBe(false);
    expect(publicError.message).toBe("An unexpected error occurred.");
    expect(JSON.stringify(publicError)).not.toContain("Fake privileged error");
  });

  test("does not invoke a hostile getter", () => {
    let accessed = false;

    const hostile = {};
    Object.defineProperty(hostile, "code", {
      get() {
        accessed = true;
        return "FORBIDDEN";
      },
      enumerable: true,
    });

    const normalized = normalizeUnknownError(hostile);

    expect(accessed).toBe(false);
    expect(normalized.code).toBe("INTERNAL_ERROR");
  });

  test("never throws while normalizing ordinary values", () => {
    const values = [null, undefined, 0, "", NaN, Symbol("s"), () => {}, new Date(0)];

    for (const value of values) {
      expect(() => {
        normalizeUnknownError(value);
      }).not.toThrow();
    }
  });

  test("every unexpected value becomes INTERNAL_ERROR", () => {
    const values = [undefined, null, "text", 5, true, {}, []];

    for (const value of values) {
      expect(toPublicError(value).code).toBe("INTERNAL_ERROR");
    }
  });
});

describe("public conversion of unexpected values", () => {
  test("an unknown native Error yields the internal error shape", () => {
    const publicError = toPublicError(new Error(SECRET_SENTINEL));

    expect(publicKeysOf(publicError)).toEqual(PUBLIC_KEYS);
    expect(publicError.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(publicError)).not.toContain(SECRET_SENTINEL);
  });

  test("a string yields the internal error shape", () => {
    const publicError = toPublicError(SECRET_SENTINEL);

    expect(publicError.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(publicError)).not.toContain(SECRET_SENTINEL);
  });

  test("a number, null, and undefined all yield the internal error shape", () => {
    for (const value of [42, null, undefined]) {
      const publicError = toPublicError(value);

      expect(publicError.code).toBe("INTERNAL_ERROR");
      expect(publicKeysOf(publicError)).toEqual(PUBLIC_KEYS);
    }
  });

  test("a fake object with a trusted-looking code is downgraded", () => {
    const publicError = toPublicError({ code: "FORBIDDEN", message: "Fake privileged error" });

    expect(publicError.code).toBe("INTERNAL_ERROR");
    expect(publicError.message).toBe("An unexpected error occurred.");
    expect(JSON.stringify(publicError)).not.toContain("Fake privileged error");
  });
});

describe("serialization safety", () => {
  test("JSON serialization matches the public conversion", () => {
    const error = new BusinessOsError("CONFLICT", {
      internalMessage: SQL_SENTINEL,
      cause: new Error(SECRET_SENTINEL),
      context: { query: CONTEXT_SENTINEL },
    });

    expect(JSON.parse(JSON.stringify(error))).toEqual({ ...toPublicError(error) });
  });

  test("serialization never exposes an internal message", () => {
    const error = new BusinessOsError("INTERNAL_ERROR", { internalMessage: SQL_SENTINEL });

    expect(JSON.stringify(error)).not.toContain(SQL_SENTINEL);
  });

  test("serialization never exposes the original cause", () => {
    const error = new BusinessOsError("INTERNAL_ERROR", { cause: new Error(SECRET_SENTINEL) });

    expect(JSON.stringify(error)).not.toContain(SECRET_SENTINEL);
  });

  test("serialization never exposes private diagnostic context", () => {
    const error = new BusinessOsError("INTERNAL_ERROR", { context: { query: CONTEXT_SENTINEL } });

    expect(JSON.stringify(error)).not.toContain(CONTEXT_SENTINEL);
  });

  test("serialization never exposes a stack trace", () => {
    const error = new BusinessOsError("INTERNAL_ERROR");

    expect(JSON.stringify(error)).not.toContain("at ");
    expect(JSON.parse(JSON.stringify(error))).not.toHaveProperty("stack");
  });

  test("serialization exposes exactly the approved keys for every code", () => {
    for (const code of Object.keys(ERROR_CATALOG)) {
      const serialized = JSON.parse(JSON.stringify(new BusinessOsError(code)));

      expect(Object.keys(serialized).sort()).toEqual(PUBLIC_KEYS);
      expect(serialized.code).toBe(code);
      expect(serialized.message).toBe(ERROR_CATALOG[code].publicMessage);
      expect(serialized.retryable).toBe(ERROR_CATALOG[code].retryable);
    }
  });

  test("an unexpected value also produces an approved public shape", () => {
    const serialized = JSON.parse(JSON.stringify(toPublicError({ code: "FORBIDDEN" })));

    expect(Object.keys(serialized).sort()).toEqual(PUBLIC_KEYS);
    expect(serialized.code).toBe("INTERNAL_ERROR");
  });
});

describe("no implicit side effects", () => {
  test("public conversion performs no retry", () => {
    let calls = 0;

    const error = new BusinessOsError("DEPENDENCY_UNAVAILABLE");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      toPublicError(error);
      calls += 1;
    }

    expect(calls).toBe(3);
  });

  test("public conversion does not mutate its input", () => {
    const error = new BusinessOsError("VALIDATION_ERROR");
    const before = { code: error.code, message: error.message };

    toPublicError(error);

    expect({ code: error.code, message: error.message }).toEqual(before);
  });

  test("normalization returns a stable result for repeated calls", () => {
    const first = toPublicError(new Error(SECRET_SENTINEL));
    const second = toPublicError(new Error(SECRET_SENTINEL));

    expect(first).toEqual(second);
  });

  test("no environment state is required", () => {
    const before = Object.keys(process.env).length;

    toPublicError(new BusinessOsError("INTERNAL_ERROR"));

    expect(Object.keys(process.env).length).toBe(before);
  });
});

describe("forged identities are downgraded (FND-009-FIX1)", () => {
  test("an object with the correct prototype normalizes to INTERNAL_ERROR", () => {
    const forged = Object.create(BusinessOsError.prototype);

    expect(normalizeUnknownError(forged).code).toBe("INTERNAL_ERROR");
  });

  test("a forged object never reaches trusted public classification", () => {
    const forged = Object.create(BusinessOsError.prototype);

    for (const [property, value] of Object.entries({
      code: "FORBIDDEN",
      category: "authorization",
      retryable: false,
      publicMessage: "Leaked privileged detail.",
    })) {
      Object.defineProperty(forged, property, { value, enumerable: true, configurable: true });
    }

    const publicError = toPublicError(forged);

    expect(publicError.code).toBe("INTERNAL_ERROR");
    expect(publicError.message).toBe("An unexpected error occurred.");
    expect(JSON.stringify(publicError)).not.toContain("Leaked privileged detail.");
  });

  test("toPublicError does not throw for a forged object", () => {
    const forged = Object.create(BusinessOsError.prototype);

    expect(() => {
      toPublicError(forged);
    }).not.toThrow();
  });

  test("an ordinary object with a trusted-looking code is still downgraded", () => {
    expect(toPublicError({ code: "FORBIDDEN", message: "Fake privileged error" }).code).toBe(
      "INTERNAL_ERROR",
    );
  });

  test("a genuine instance still preserves its identity", () => {
    const error = new BusinessOsError("CONFLICT");

    expect(normalizeUnknownError(error)).toBe(error);
    expect(toPublicError(error).code).toBe("CONFLICT");
  });
});

describe("hostile objects are contained (FND-009-FIX1)", () => {
  test("a proxy with a throwing prototype trap normalizes safely", () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("hostile trap");
        },
      },
    );

    let publicError;

    expect(() => {
      publicError = toPublicError(hostile);
    }).not.toThrow();

    expect(publicError.code).toBe("INTERNAL_ERROR");
    expect(publicError.message).toBe("An unexpected error occurred.");
  });

  test("a revoked proxy is handled safely", () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    let publicError;

    expect(() => {
      publicError = toPublicError(revocable.proxy);
    }).not.toThrow();

    expect(publicError.code).toBe("INTERNAL_ERROR");
  });

  test("a proxy with a lying has trap and throwing getter is contained", () => {
    const hostile = new Proxy(
      {},
      {
        has() {
          return true;
        },
        get() {
          throw new Error("no access");
        },
      },
    );

    let publicError;

    expect(() => {
      publicError = toPublicError(hostile);
    }).not.toThrow();

    expect(publicError.code).toBe("INTERNAL_ERROR");
  });

  test("a hostile proxy cause is preserved internally but never disclosed", () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("hostile trap");
        },
      },
    );

    const normalized = normalizeUnknownError(hostile);

    expect(normalized.cause).toBe(hostile);
    expect(JSON.stringify(normalized)).not.toContain("hostile trap");
    expect(JSON.stringify(toPublicError(normalized))).not.toContain("hostile trap");
  });

  test("unknown objects still normalize to INTERNAL_ERROR", () => {
    for (const value of [{}, [], "text", 7, true, null, undefined]) {
      expect(toPublicError(value).code).toBe("INTERNAL_ERROR");
    }
  });
});

describe("public shape is unchanged by the hardening (FND-009-FIX1)", () => {
  test("public serialization still returns exactly code, message, and retryable", () => {
    for (const code of Object.keys(ERROR_CATALOG)) {
      expect(Object.keys(toPublicError(new BusinessOsError(code))).sort()).toEqual(PUBLIC_KEYS);
      const serialized = JSON.parse(JSON.stringify(new BusinessOsError(code)));

      expect(Object.keys(toPublicError(new BusinessOsError(code))).sort()).toEqual(PUBLIC_KEYS);
      expect(Object.keys(serialized).sort()).toEqual(PUBLIC_KEYS);
    }
  });

  test("native Error cause behaviour remains intact", () => {
    const cause = new Error("original failure");
    const error = new BusinessOsError("DEPENDENCY_UNAVAILABLE", { cause });

    expect(error.cause).toBe(cause);
    expect(cause.message).toBe("original failure");
    expect(Object.keys(error)).not.toContain("cause");
  });

  test("internal diagnostics remain absent from public output", () => {
    const error = new BusinessOsError("DEPENDENCY_UNAVAILABLE", {
      internalMessage: SQL_SENTINEL,
      cause: new Error(SECRET_SENTINEL),
      context: { query: CONTEXT_SENTINEL },
    });

    const serialized = JSON.stringify(error);

    for (const sentinel of [SECRET_SENTINEL, SQL_SENTINEL, CONTEXT_SENTINEL]) {
      expect(serialized).not.toContain(sentinel);
    }

    expect(Object.keys(JSON.parse(serialized)).sort()).toEqual(PUBLIC_KEYS);
  });

  test("no global exception handler is installed by normalization", () => {
    const before = process.listenerCount ? process.listenerCount("uncaughtException") : 0;

    toPublicError(new Error(SECRET_SENTINEL));

    expect(process.listenerCount ? process.listenerCount("uncaughtException") : 0).toBe(before);
  });
});
