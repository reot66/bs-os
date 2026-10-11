import { describe, expect, test } from "bun:test";

import {
  createLogger,
  isRegisteredSecretKey,
  isSensitiveKey,
  sanitizeLogMetadata,
} from "../dist/index.js";

const PASSWORD = "TEST_PASSWORD_DO_NOT_LEAK";
const TOKEN = "TEST_ACCESS_TOKEN_DO_NOT_LEAK";
const SQL = "TEST_PRIVATE_DATABASE_DETAIL";

function createSink() {
  const lines = [];
  return {
    lines,
    write(chunk) {
      lines.push(chunk);
    },
    output() {
      return lines.map((line) => line.trim()).join("\n");
    },
  };
}

function sanitizeAndLog(metadata) {
  const sink = createSink();
  const logger = createLogger({ service: "svc", level: "debug", destination: sink });
  logger.info("record", metadata);
  return { sink, sanitized: JSON.parse(sink.lines[0]).context };
}

describe("registry-derived secret recognition", () => {
  test("recognizes the registered runtime database password", () => {
    expect(isRegisteredSecretKey("BUSINESS_OS_DB_APP_PASSWORD")).toBe(true);
    expect(isSensitiveKey("BUSINESS_OS_DB_APP_PASSWORD")).toBe(true);
  });

  test("recognizes the registered administrator password", () => {
    expect(isRegisteredSecretKey("BUSINESS_OS_DB_PASSWORD")).toBe(true);
    expect(isSensitiveKey("BUSINESS_OS_DB_PASSWORD")).toBe(true);
  });

  test("redacts registered secrets in emitted JSON", () => {
    for (const key of ["BUSINESS_OS_DB_APP_PASSWORD", "BUSINESS_OS_DB_PASSWORD"]) {
      const { sink } = sanitizeAndLog({ [key]: PASSWORD });

      expect({ key, leaked: sink.output().includes(PASSWORD) }).toEqual({
        key,
        leaked: false,
      });
    }
  });

  test("does not treat ordinary variables as secrets", () => {
    for (const key of ["BUSINESS_OS_ENV", "BUSINESS_OS_DB_PORT", "BUSINESS_OS_DB_NAME"]) {
      expect(isRegisteredSecretKey(key)).toBe(false);
    }
  });
});

describe("generic credential keys", () => {
  const credentialKeys = [
    "password",
    "passwd",
    "pwd",
    "secret",
    "clientSecret",
    "token",
    "accessToken",
    "refreshToken",
    "sessionToken",
    "authorization",
    "cookie",
    "setCookie",
    "apiKey",
    "privateKey",
    "credentials",
  ];

  test("recognizes credential-like keys", () => {
    for (const key of credentialKeys) {
      expect({ key, sensitive: isSensitiveKey(key) }).toEqual({ key, sensitive: true });
    }
  });

  test("handles case variations", () => {
    for (const key of ["PASSWORD", "Password", "pAsSwOrD", "SECRET", "Authorization"]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
  });

  test("handles separator variations", () => {
    for (const key of ["access_token", "access-token", "access.token", "ACCESS_TOKEN"]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
  });

  test("recognizes compound credential names", () => {
    for (const key of ["userPassword", "db_password", "stripeApiKey", "myClientSecret"]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
  });

  test("does not redact ordinary keys", () => {
    for (const key of ["username", "durationMs", "count", "operation", "id", "module"]) {
      expect({ key, sensitive: isSensitiveKey(key) }).toEqual({ key, sensitive: false });
    }
  });

  test("redacts each credential key in emitted JSON", () => {
    for (const key of credentialKeys) {
      const { sink } = sanitizeAndLog({ [key]: PASSWORD });

      expect({ key, leaked: sink.output().includes(PASSWORD) }).toEqual({
        key,
        leaked: false,
      });
    }
  });
});

describe("structural redaction", () => {
  test("redacts a nested secret", () => {
    expect(sanitizeAndLog({ user: { credentials: { password: PASSWORD } } }).sanitized).toEqual({
      user: { credentials: "[REDACTED]" },
    });
  });

  test("redacts a secret inside an array of objects", () => {
    const sanitized = sanitizeAndLog({ users: [{ name: "a", password: PASSWORD }] }).sanitized;

    expect(JSON.stringify(sanitized)).not.toContain(PASSWORD);
  });

  test("redacts the documented deep chain", () => {
    const sanitized = sanitizeAndLog({
      context: { operation: { credentials: { password: PASSWORD } } },
    }).sanitized;

    expect(JSON.stringify(sanitized)).not.toContain(PASSWORD);
  });

  test("preserves non-secret values", () => {
    expect(sanitizeAndLog({ durationMs: 12, ok: true, tag: "safe" }).sanitized).toEqual({
      durationMs: 12,
      ok: true,
      tag: "safe",
    });
  });
});

describe("input isolation", () => {
  test("does not modify the original input", () => {
    const input = { password: PASSWORD, nested: { token: TOKEN } };
    const snapshot = JSON.parse(JSON.stringify(input));

    sanitizeLogMetadata(input);

    expect(input).toEqual(snapshot);
  });

  test("handles a frozen input", () => {
    const input = Object.freeze({ password: PASSWORD, nested: Object.freeze({ a: 1 }) });

    expect(() => {
      sanitizeLogMetadata(input);
    }).not.toThrow();

    expect(JSON.stringify(sanitizeLogMetadata(input))).not.toContain(PASSWORD);
  });
});

describe("bounded traversal", () => {
  test("bounds excessive depth", () => {
    let deep = { password: PASSWORD };
    for (let i = 0; i < 40; i += 1) {
      deep = { nested: deep };
    }

    expect(JSON.stringify(sanitizeLogMetadata(deep))).not.toContain(PASSWORD);
  });

  test("bounds very large arrays", () => {
    const large = Array.from({ length: 5000 }, (_, index) => ({ index, password: PASSWORD }));
    const output = JSON.stringify(sanitizeLogMetadata(large));

    expect(output).not.toContain(PASSWORD);
    expect(output.length).toBeLessThan(200_000);
  });

  test("bounds very large strings", () => {
    const output = JSON.stringify(sanitizeLogMetadata({ blob: "x".repeat(100_000) }));

    expect(output.length).toBeLessThan(10_000);
  });

  test("bounds objects with many keys", () => {
    const wide = {};
    for (let i = 0; i < 5000; i += 1) {
      wide[`key${i}`] = i;
    }

    expect(Object.keys(sanitizeLogMetadata(wide)).length).toBeLessThan(60);
  });
});

describe("hostile structures", () => {
  test("handles a circular object safely", () => {
    const circular = { name: "root" };
    circular.self = circular;

    expect(() => {
      sanitizeLogMetadata(circular);
    }).not.toThrow();

    expect(JSON.stringify(sanitizeLogMetadata(circular))).toContain("root");
  });

  test("does not invoke a hostile getter", () => {
    let touched = false;

    const input = {};
    Object.defineProperty(input, "secretValue", {
      get() {
        touched = true;
        return PASSWORD;
      },
      enumerable: true,
    });

    const output = JSON.stringify(sanitizeLogMetadata(input));

    expect({ touched, leaked: output.includes(PASSWORD) }).toEqual({
      touched: false,
      leaked: false,
    });
  });

  test("does not invoke a custom toJSON", () => {
    let touched = false;

    const input = {
      toJSON() {
        touched = true;
        return { password: PASSWORD };
      },
    };

    sanitizeLogMetadata(input);

    expect(touched).toBe(false);
  });

  test("does not invoke a custom toString", () => {
    let touched = false;

    const input = {
      toString() {
        touched = true;
        return PASSWORD;
      },
    };

    sanitizeLogMetadata(input);

    expect(touched).toBe(false);
  });

  test("handles a hostile Proxy safely", () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("trap");
        },
        get() {
          throw new Error("trap");
        },
        getPrototypeOf() {
          throw new Error("trap");
        },
      },
    );

    expect(() => {
      sanitizeLogMetadata(hostile);
    }).not.toThrow();

    expect(JSON.stringify(sanitizeLogMetadata(hostile))).not.toContain("trap");
  });

  test("handles a revoked Proxy safely", () => {
    const revocable = Proxy.revocable({ password: PASSWORD }, {});
    revocable.revoke();

    expect(() => {
      sanitizeLogMetadata(revocable.proxy);
    }).not.toThrow();

    expect(JSON.stringify(sanitizeLogMetadata(revocable.proxy))).not.toContain(PASSWORD);
  });

  test("never exposes a native error internals as ordinary metadata", () => {
    const error = new Error("outer");
    error.cause = new Error(SQL);

    const output = JSON.stringify(sanitizeLogMetadata({ failure: error }));

    expect(output).not.toContain(SQL);
    expect(output).not.toContain("outer");
  });

  test("replaces non-plain objects with a safe placeholder", () => {
    const output = sanitizeLogMetadata({ when: new Date(0), re: /x/, set: new Set([1]) });

    expect(JSON.stringify(output)).not.toContain("1970");
  });
});

describe("known limitation", () => {
  test("key-based redaction cannot protect an innocently named field", () => {
    // Documented limitation: a secret placed under a key with no
    // credential-like name is NOT detected. Callers must not do this.
    const sanitized = sanitizeAndLog({ notes: PASSWORD }).sanitized;

    expect(sanitized.notes).toBe(PASSWORD);
  });
});

describe("array accessors are never executed (FND-010-SEC-FIX1)", () => {
  function arrayWithGetter(returnValue, throws = false) {
    const array = [{ safe: 1 }];
    Object.defineProperty(array, 0, {
      get() {
        arrayWithGetter.calls.push("invoked");
        if (throws) {
          throw new Error("boom");
        }
        return returnValue;
      },
      enumerable: true,
      configurable: true,
    });
    return array;
  }
  arrayWithGetter.calls = [];

  test("an array-index getter is not executed", () => {
    arrayWithGetter.calls = [];
    const array = arrayWithGetter("TEST_SECRET_DO_NOT_LEAK");

    sanitizeLogMetadata({ list: array });

    expect({ calls: arrayWithGetter.calls }).toEqual({ calls: [] });
  });

  test("an accessor returning a secret sentinel is never evaluated", () => {
    arrayWithGetter.calls = [];
    const array = arrayWithGetter("TEST_SECRET_DO_NOT_LEAK");

    const output = JSON.stringify(sanitizeLogMetadata({ list: array }));

    expect(output).not.toContain("TEST_SECRET_DO_NOT_LEAK");
    expect(output).toContain("[UNSAFE]");
  });

  test("an array-index getter that throws is not executed", () => {
    arrayWithGetter.calls = [];

    expect(() => {
      sanitizeLogMetadata({ list: arrayWithGetter(null, true) });
    }).not.toThrow();

    expect({ calls: arrayWithGetter.calls }).toEqual({ calls: [] });
  });

  test("an accessor element becomes the unsafe placeholder", () => {
    arrayWithGetter.calls = [];

    expect(sanitizeLogMetadata({ list: arrayWithGetter("x") })).toEqual({
      list: ["[UNSAFE]"],
    });
  });

  test("a normal array still serializes correctly", () => {
    expect(sanitizeLogMetadata({ list: [1, "two", true, null, { a: 1 }] })).toEqual({
      list: [1, "two", true, null, { a: 1 }],
    });
  });

  test("a sparse array stays JSON-safe", () => {
    const sparse = [];
    sparse[2] = "value";

    const output = sanitizeLogMetadata({ list: sparse });

    expect(output).toEqual({ list: [null, null, "value"] });
    expect(() => JSON.stringify(output)).not.toThrow();
  });

  test("a circular array remains bounded", () => {
    const circular = [];
    circular.push(circular);

    expect(sanitizeLogMetadata({ list: circular })).toEqual({ list: ["[UNSAFE]"] });
  });

  test("nested arrays remain safe", () => {
    expect(sanitizeLogMetadata({ a: [[{ password: PASSWORD }]] })).toEqual({
      a: [[{ password: "[REDACTED]" }]],
    });
  });

  test("existing nested credential redaction still applies inside arrays", () => {
    const output = JSON.stringify(sanitizeLogMetadata({ list: [{ accessToken: TOKEN }] }));

    expect(output).not.toContain(TOKEN);
    expect(output).toContain("[REDACTED]");
  });

  test("array element limits and truncation still apply", () => {
    const large = Array.from({ length: 250 }, (_, index) => index);
    const output = sanitizeLogMetadata({ list: large });

    expect(output.list.length).toBe(101);
    expect(output.list[100]).toBe("[TRUNCATED]");
  });

  test("the original array is not mutated", () => {
    const array = [{ keep: 1 }];

    sanitizeLogMetadata({ list: array });

    expect(array).toEqual([{ keep: 1 }]);
  });

  test("a hostile array proxy is contained without escaping", () => {
    const hostile = new Proxy([], {
      getOwnPropertyDescriptor() {
        throw new Error("boom");
      },
    });

    expect(() => {
      sanitizeLogMetadata({ list: hostile });
    }).not.toThrow();

    expect(JSON.stringify(sanitizeLogMetadata({ list: hostile }))).not.toContain("boom");
  });
});
