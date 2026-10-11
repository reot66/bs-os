import { describe, expect, test } from "bun:test";

import { LOG_LEVELS } from "@business-os/configuration";

import { RESERVED_LOG_FIELDS, REDACTED_VALUE, createLogger } from "../dist/index.js";

/** In-memory sink so tests never write to stdout. */
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
  };
}

function createTestLogger(overrides = {}) {
  const sink = createSink();
  const logger = createLogger({
    service: "business-os-api",
    level: "info",
    destination: sink,
    ...overrides,
  });
  return { sink, logger };
}

describe("logger creation", () => {
  test("accepts a valid service and level", () => {
    const { logger } = createTestLogger();

    expect(logger.level).toBe("info");
  });

  test("accepts every supported level", () => {
    for (const level of LOG_LEVELS) {
      const { logger } = createTestLogger({ level });
      expect(logger.level).toBe(level);
    }
  });

  test("rejects an invalid level", () => {
    for (const level of ["trace", "fatal", "silent", "verbose", 5, null]) {
      expect(() => {
        createLogger({ service: "svc", level, destination: createSink() });
      }).toThrow(TypeError);
    }
  });

  test("rejects a missing or empty service identifier", () => {
    for (const service of ["", "   ", null, undefined]) {
      expect(() => {
        createLogger({ service, level: "info", destination: createSink() });
      }).toThrow(TypeError);
    }
  });

  test("rejects a non-object options argument", () => {
    for (const options of [null, undefined, "logger"]) {
      expect(() => {
        createLogger(options);
      }).toThrow(TypeError);
    }
  });
});

describe("structured JSON output", () => {
  test("emits level, time, service, and message", () => {
    const { sink, logger } = createTestLogger();

    logger.info("Application started");

    const [record] = sink.records();

    expect(record.level).toBe(30);
    expect(record.service).toBe("business-os-api");
    expect(record.msg).toBe("Application started");
    expect(typeof record.time).toBe("number");
    expect(String(record.time).length).toBe(13);
  });

  test("nests caller metadata under context", () => {
    const { sink, logger } = createTestLogger();

    logger.info("Catalog initialized", { durationMs: 120 });

    const [record] = sink.records();

    expect(record.context).toEqual({ durationMs: 120 });
  });

  test("supports debug, info, warn, and error", () => {
    const { sink, logger } = createTestLogger({ level: "debug" });

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(sink.records().map((record) => record.level)).toEqual([20, 30, 40, 50]);
  });

  test("rejects a non-string message instead of stringifying it", () => {
    const { logger } = createTestLogger();
    const dangerous = { toString: () => "leaked" };

    expect(() => {
      logger.info(dangerous);
    }).toThrow(TypeError);
  });

  test("every emitted line is valid JSON", () => {
    const { sink, logger } = createTestLogger();

    logger.info("one");
    logger.warn("two", { a: 1 });
    logger.error("three");

    for (const line of sink.lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

describe("level filtering", () => {
  test("suppresses debug at info level", () => {
    const { sink, logger } = createTestLogger({ level: "info" });

    logger.debug("hidden");
    logger.info("shown");

    expect(sink.records().map((record) => record.msg)).toEqual(["shown"]);
  });

  test("emits warning and error at info level", () => {
    const { sink, logger } = createTestLogger({ level: "info" });

    logger.warn("warned");
    logger.error("failed");

    expect(sink.records().map((record) => record.msg)).toEqual(["warned", "failed"]);
  });

  test("suppresses everything at error level", () => {
    const { sink, logger } = createTestLogger({ level: "error" });

    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");

    expect(sink.records().map((record) => record.msg)).toEqual(["d"]);
  });

  test("skips sanitization work for disabled levels", () => {
    const sink = createSink();
    const logger = createLogger({ service: "svc", level: "error", destination: sink });
    let touched = false;

    const metadata = {
      get dangerous() {
        touched = true;
        return "value";
      },
    };

    logger.debug("suppressed", metadata);

    expect({ touched, emitted: sink.lines.length }).toEqual({ touched: false, emitted: 0 });
  });
});

describe("reserved fields", () => {
  test("caller metadata cannot override reserved top-level fields", () => {
    const { sink, logger } = createTestLogger();

    logger.info("Safe message", {
      level: 999,
      time: 1,
      msg: "injected",
      service: "attacker-service",
      error: { code: "FORBIDDEN" },
    });

    const [record] = sink.records();

    expect(record.level).toBe(30);
    expect(record.msg).toBe("Safe message");
    expect(record.service).toBe("business-os-api");
    expect(record.time).not.toBe(1);
    expect(record.error).toBeUndefined();
    expect(record.context.msg).toBe("injected");
  });

  test("reserved field list covers the documented names", () => {
    for (const field of ["level", "time", "msg", "service", "err", "error", "context"]) {
      expect([...RESERVED_LOG_FIELDS]).toContain(field);
    }
  });
});

describe("public surface", () => {
  test("exposes no raw Pino instance and no unsafe raw method", () => {
    const { logger } = createTestLogger();

    expect(logger.raw).toBeUndefined();
    expect(logger.pino).toBeUndefined();
    expect(logger.destination).toBeUndefined();

    for (const key of Object.keys(logger).sort()) {
      expect(key).not.toBe("raw");
    }
  });

  test("exposes only the documented methods", () => {
    const { logger } = createTestLogger();

    expect(Object.keys(logger).sort()).toEqual([
      "child",
      "debug",
      "error",
      "info",
      "level",
      "logError",
      "warn",
    ]);
  });

  test("creates independent logger instances", () => {
    const first = createSink();
    const second = createSink();

    const a = createLogger({ service: "svc-a", level: "info", destination: first });
    const b = createLogger({ service: "svc-b", level: "info", destination: second });

    a.info("from a");
    b.info("from b");

    expect(first.records()[0].service).toBe("svc-a");
    expect(second.records()[0].service).toBe("svc-b");
  });

  test("holds no global singleton", () => {
    expect(globalThis.__businessOsLogger).toBeUndefined();
    expect(globalThis.logger).toBeUndefined();
  });

  test("a child logger cannot change the destination", () => {
    const sink = createSink();
    const logger = createLogger({ service: "svc", level: "info", destination: sink });
    const child = logger.child({ module: "mod" });

    child.info("still captured");

    expect(sink.lines.length).toBe(1);
  });

  test("uses the shared redaction marker", () => {
    const { sink, logger } = createTestLogger();

    logger.info("m", { password: "TEST_PASSWORD_DO_NOT_LEAK" });

    expect(JSON.stringify(sink.records()[0])).toContain(REDACTED_VALUE);
  });
});

describe("safe error logging", () => {
  test("records classification without private internals", async () => {
    const { sink, logger } = createTestLogger();
    const { BusinessOsError } = await import("@business-os/errors");
    const error = new BusinessOsError("DEPENDENCY_UNAVAILABLE", {
      internalMessage: "TEST_SQL_INTERNAL_DETAIL",
      cause: new Error("TEST_PRIVATE_ERROR_CAUSE"),
      context: { query: "TEST_PRIVATE_CONTEXT" },
    });

    logger.logError(error, "Operation failed");

    const [record] = sink.records();
    const serialized = JSON.stringify(record);

    expect(record.error).toEqual({
      code: "DEPENDENCY_UNAVAILABLE",
      category: "infrastructure",
      retryable: true,
      message: "The service is temporarily unavailable.",
    });
    expect(serialized).not.toContain("TEST_SQL_INTERNAL_DETAIL");
    expect(serialized).not.toContain("TEST_PRIVATE_ERROR_CAUSE");
    expect(serialized).not.toContain("TEST_PRIVATE_CONTEXT");
    expect(record.error).not.toHaveProperty("stack");
    expect(record.error).not.toHaveProperty("cause");
    expect(record.msg).toBe("Operation failed");
  });

  test("maps an unknown thrown value to INTERNAL_ERROR", () => {
    for (const value of ["a string", 42, null, undefined, true]) {
      const { sink, logger } = createTestLogger();

      logger.logError(value, "Unexpected failure");

      const [record] = sink.records();

      expect(record.error.code).toBe("INTERNAL_ERROR");
      expect(record.error.category).toBe("internal");
      expect(record.error.retryable).toBe(false);
      expect(record.genuineError).toBe(false);
    }
  });
});
