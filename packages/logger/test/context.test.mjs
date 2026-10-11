import { describe, expect, test } from "bun:test";

import { BusinessOsError } from "@business-os/errors";
import { createLogger } from "@business-os/logger";

import {
  MAX_CONTEXT_VALUE_LENGTH,
  MAX_IDENTIFIER_LENGTH,
  isTrustedContextKey,
  normalizeContext,
} from "../dist/index.js";

const PRIVATE_CAUSE = "TEST_PRIVATE_ERROR_CAUSE";
const SQL_DETAIL = "TEST_PRIVATE_DATABASE_DETAIL";
const PASSWORD = "TEST_PASSWORD_DO_NOT_LEAK";

function createSink() {
  const lines = [];
  return {
    lines,
    write(chunk) {
      lines.push(chunk);
    },
    records() {
      return lines.map((line) => JSON.parse(line));
    },
    output() {
      return lines.map((line) => line.trim()).join("\n");
    },
  };
}

function createTestLogger() {
  const sink = createSink();
  const logger = createLogger({ service: "business-os-api", level: "debug", destination: sink });
  return { sink, logger };
}

describe("context propagation", () => {
  test("a child inherits and emits its context", () => {
    const { sink, logger } = createTestLogger();

    logger.child({ module: "checkout", correlationId: "request-123" }).info("Started");

    const [record] = sink.records();

    expect(record.module).toBe("checkout");
    expect(record.correlationId).toBe("request-123");
    expect(record.service).toBe("business-os-api");
  });

  test("child creation does not mutate the parent", () => {
    const { sink, logger } = createTestLogger();

    logger.child({ module: "checkout" }).info("child");
    logger.info("parent");

    const [child, parent] = sink.records();

    expect(child.module).toBe("checkout");
    expect(parent.module).toBeUndefined();
  });

  test("sibling children stay independent", () => {
    const { sink, logger } = createTestLogger();

    logger.child({ module: "catalog" }).info("a");
    logger.child({ module: "checkout" }).info("b");
    logger.child({ module: "billing" }).info("c");

    expect(sink.records().map((record) => record.module)).toEqual([
      "catalog",
      "checkout",
      "billing",
    ]);
  });

  test("inherited context persists across descendants", () => {
    const { sink, logger } = createTestLogger();

    logger.child({ module: "catalog" }).child({ correlationId: "req-9" }).info("deep");

    const [record] = sink.records();

    expect({ module: record.module, correlationId: record.correlationId }).toEqual({
      module: "catalog",
      correlationId: "req-9",
    });
  });

  test("a correlation id is optional", () => {
    const { sink, logger } = createTestLogger();

    logger.child({ module: "jobs" }).info("no correlation");

    const [record] = sink.records();

    expect(record.correlationId).toBeUndefined();
    expect(record.module).toBe("jobs");
  });

  test("no correlation id is generated inside the logger", () => {
    const { sink, logger } = createTestLogger();

    logger.info("plain");

    expect(sink.records()[0].correlationId).toBeUndefined();
  });
});

describe("context validation", () => {
  test("accepts a valid identifier", () => {
    expect(normalizeContext({ correlationId: "req-123abc" })).toEqual({
      correlationId: "req-123abc",
    });
  });

  test("rejects an empty or non-string value", () => {
    for (const value of ["", 42, null, {}, []]) {
      expect(() => {
        normalizeContext({ correlationId: value });
      }).toThrow(TypeError);
    }
  });

  test("rejects an excessively long correlation id", () => {
    expect(() => {
      normalizeContext({ correlationId: "a".repeat(MAX_IDENTIFIER_LENGTH + 1) });
    }).toThrow(TypeError);
  });

  test("accepts a value at exactly the maximum identifier length", () => {
    expect(() => {
      normalizeContext({ correlationId: "a".repeat(MAX_IDENTIFIER_LENGTH) });
    }).not.toThrow();
  });

  test("rejects an excessively long service name", () => {
    expect(() => {
      normalizeContext({ service: "a".repeat(MAX_CONTEXT_VALUE_LENGTH + 1) });
    }).toThrow(TypeError);
  });

  test("accepts underscore and dot in authored service names but not identifiers", () => {
    expect(() => {
      normalizeContext({ service: "business_os.api", module: "catalog_v2" });
    }).not.toThrow();

    expect(() => {
      normalizeContext({ correlationId: "has_underscore" });
    }).toThrow(TypeError);
  });

  test("accepts common identifier formats", () => {
    for (const id of [
      "018f0c2a-1b2c-7def-8abc-0123456789ab",
      "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      "4bf92f3577b34da6a3ce929d0e0e4736",
      "req-123",
    ]) {
      expect(() => {
        normalizeContext({ correlationId: id });
      }).not.toThrow();
    }
  });

  test("rejects characters that could carry free-form data", () => {
    for (const value of ["has space", PASSWORD, "semi;colon", "quote'd", "new\nline"]) {
      expect(() => {
        normalizeContext({ correlationId: value });
      }).toThrow(TypeError);
    }
  });

  test("identifies the trusted context keys", () => {
    for (const key of ["service", "module", "correlationId", "requestId"]) {
      expect(isTrustedContextKey(key)).toBe(true);
    }

    for (const key of ["password", "level", "msg", "tenantId"]) {
      expect(isTrustedContextKey(key)).toBe(false);
    }
  });

  test("ignores untrusted keys so they cannot become trusted fields", () => {
    const { sink, logger } = createTestLogger();

    logger.child({ module: "catalog", password: PASSWORD }).info("m");

    const [record] = sink.records();
    const serialized = sink.output();

    expect(record.password).toBeUndefined();
    expect(record.context).toBeUndefined();
    expect(serialized).not.toContain(PASSWORD);
  });
});

describe("error logging", () => {
  test("records a genuine platform error with its classification", () => {
    const { sink, logger } = createTestLogger();

    logger.logError(new BusinessOsError("RATE_LIMITED"), "Too many requests");

    const [record] = sink.records();

    expect(record.error).toEqual({
      code: "RATE_LIMITED",
      category: "infrastructure",
      retryable: true,
      message: "Too many requests. Please try again later.",
    });
    expect(record.genuineError).toBe(true);
  });

  test("keeps private cause and internal message out of the record", () => {
    const { sink, logger } = createTestLogger();

    logger.logError(
      new BusinessOsError("DEPENDENCY_UNAVAILABLE", {
        internalMessage: SQL_DETAIL,
        cause: new Error(PRIVATE_CAUSE),
        context: { query: SQL_DETAIL },
      }),
      "Operation failed",
    );

    const serialized = sink.output();

    expect(serialized).not.toContain(SQL_DETAIL);
    expect(serialized).not.toContain(PRIVATE_CAUSE);
  });

  test("does not trust a fake code property", () => {
    const { sink, logger } = createTestLogger();

    logger.logError({ code: "FORBIDDEN", message: "Fake privileged error" }, "Failed");

    const [record] = sink.records();

    expect(record.error.code).toBe("INTERNAL_ERROR");
    expect(record.genuineError).toBe(false);
    expect(sink.output()).not.toContain("Fake privileged error");
  });

  test("rejects an object that merely has the right prototype", () => {
    const { sink, logger } = createTestLogger();

    logger.logError(Object.create(BusinessOsError.prototype), "Failed");

    const [record] = sink.records();

    expect(record.error.code).toBe("INTERNAL_ERROR");
    expect(record.genuineError).toBe(false);
  });

  test("handles a hostile proxy without throwing", () => {
    const { sink, logger } = createTestLogger();
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("trap");
        },
        get() {
          throw new Error("trap");
        },
        has() {
          return true;
        },
      },
    );

    expect(() => {
      logger.logError(hostile, "Failed");
    }).not.toThrow();

    expect(sink.records()[0].error.code).toBe("INTERNAL_ERROR");
  });

  test("handles a revoked proxy without throwing", () => {
    const { sink, logger } = createTestLogger();
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() => {
      logger.logError(revocable.proxy, "Failed");
    }).not.toThrow();

    expect(sink.records()[0].error.code).toBe("INTERNAL_ERROR");
  });

  test("handles a cyclic thrown value safely", () => {
    const { sink, logger } = createTestLogger();
    const cyclic = { name: "loop" };
    cyclic.self = cyclic;

    expect(() => {
      logger.logError(cyclic, "Failed");
    }).not.toThrow();

    expect(sink.records()[0].error.code).toBe("INTERNAL_ERROR");
  });

  test("maps unknown thrown primitives to INTERNAL_ERROR", () => {
    for (const value of ["a string", 42, true, null, undefined]) {
      const { sink, logger } = createTestLogger();

      logger.logError(value, "Unexpected failure");

      const [record] = sink.records();

      expect({ value: String(value), code: record.error.code }).toEqual({
        value: String(value),
        code: "INTERNAL_ERROR",
      });
    }
  });

  test("logs a native error without exposing its stack or message", () => {
    const { sink, logger } = createTestLogger();

    logger.logError(new Error(PRIVATE_CAUSE), "Failed");

    const serialized = sink.output();

    expect(serialized).not.toContain(PRIVATE_CAUSE);
    expect(serialized).not.toContain("at ");
  });

  test("a context value carrying an error is sanitized, not serialized raw", () => {
    const { sink, logger } = createTestLogger();

    logger.info("m", { failure: new Error(PRIVATE_CAUSE) });

    expect(sink.output()).not.toContain(PRIVATE_CAUSE);
  });

  test("child loggers cannot bypass redaction for errors", () => {
    const { sink, logger } = createTestLogger();
    const child = logger.child({ module: "catalog" });

    child.logError(new BusinessOsError("CONFLICT", { internalMessage: SQL_DETAIL }), "Failed");

    expect(sink.output()).not.toContain(SQL_DETAIL);
  });
});
