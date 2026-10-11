import { describe, expect, test } from "bun:test";

import {
  ERROR_CATALOG,
  ERROR_CATEGORIES,
  ERROR_CODES,
  getErrorCatalogEntry,
  isErrorCode,
} from "../dist/index.js";

const EXPECTED_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "BUSINESS_RULE_VIOLATION",
  "RATE_LIMITED",
  "DEPENDENCY_UNAVAILABLE",
  "OPERATION_TIMEOUT",
  "INTERNAL_ERROR",
];

const EXPECTED_CATEGORIES = {
  VALIDATION_ERROR: "validation",
  UNAUTHENTICATED: "authentication",
  FORBIDDEN: "authorization",
  NOT_FOUND: "authorization",
  CONFLICT: "domain",
  PRECONDITION_FAILED: "domain",
  BUSINESS_RULE_VIOLATION: "domain",
  RATE_LIMITED: "infrastructure",
  DEPENDENCY_UNAVAILABLE: "infrastructure",
  OPERATION_TIMEOUT: "infrastructure",
  INTERNAL_ERROR: "internal",
};

const EXPECTED_RETRYABLE = {
  RATE_LIMITED: true,
  DEPENDENCY_UNAVAILABLE: true,
  OPERATION_TIMEOUT: true,
  VALIDATION_ERROR: false,
  UNAUTHENTICATED: false,
  FORBIDDEN: false,
  NOT_FOUND: false,
  CONFLICT: false,
  PRECONDITION_FAILED: false,
  BUSINESS_RULE_VIOLATION: false,
  INTERNAL_ERROR: false,
};

describe("error catalog inventory", () => {
  test("contains every approved platform code", () => {
    expect(Object.keys(ERROR_CATALOG).sort()).toEqual([...EXPECTED_CODES].sort());
  });

  test("exposes the same codes through the enumeration", () => {
    expect([...ERROR_CODES].sort()).toEqual([...EXPECTED_CODES].sort());
  });

  test("identifiers are unique", () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  test("every entry has a valid category", () => {
    for (const code of ERROR_CODES) {
      expect({ code, valid: [...ERROR_CATEGORIES].includes(ERROR_CATALOG[code].category) }).toEqual(
        {
          code,
          valid: true,
        },
      );
    }
  });

  test("every entry has the expected category", () => {
    for (const code of ERROR_CODES) {
      expect({ code, category: ERROR_CATALOG[code].category }).toEqual({
        code,
        category: EXPECTED_CATEGORIES[code],
      });
    }
  });

  test("every entry declares retryability explicitly", () => {
    for (const code of ERROR_CODES) {
      expect(typeof ERROR_CATALOG[code].retryable).toBe("boolean");
    }
  });

  test("every entry has the expected retryability", () => {
    for (const code of ERROR_CODES) {
      expect({ code, retryable: ERROR_CATALOG[code].retryable }).toEqual({
        code,
        retryable: EXPECTED_RETRYABLE[code],
      });
    }
  });
});

describe("safe public messages", () => {
  test("every public message is non-empty", () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_CATALOG[code].publicMessage.trim().length).toBeGreaterThan(0);
    }
  });

  test("no public message leaks infrastructure or private detail", () => {
    const forbidden = [
      /postgres/i,
      /mysql/i,
      /select\s/i,
      /insert\s/i,
      /password/i,
      /secret/i,
      /token/i,
      /bearer/i,
      /\/[a-z0-9_-]+\/[a-z0-9_-]+\//i,
      /127\.0\.0\.1/,
      /localhost/,
      /\b\d{1,3}(\.\d{1,3}){3}\b/,
      /\bat\s+\w+\s*\(/,
      /Traceback|Error:/,
    ];

    for (const code of ERROR_CODES) {
      const message = ERROR_CATALOG[code].publicMessage;

      for (const pattern of forbidden) {
        expect({ code, matched: pattern.test(message) }).toEqual({ code, matched: false });
      }
    }
  });

  test("no message contains a file path or stack trace marker", () => {
    for (const code of ERROR_CODES) {
      const message = ERROR_CATALOG[code].publicMessage;

      expect(message).not.toContain("/src/");
      expect(message).not.toContain(".ts:");
      expect(message).not.toContain("\n");
    }
  });
});

describe("catalog immutability", () => {
  test("the catalog object is frozen", () => {
    expect(Object.isFrozen(ERROR_CATALOG)).toBe(true);
  });

  test("every nested entry is frozen", () => {
    for (const code of ERROR_CODES) {
      expect(Object.isFrozen(ERROR_CATALOG[code])).toBe(true);
    }
  });

  test("adding a code does not change the catalog", () => {
    const before = Object.keys(ERROR_CATALOG).length;

    try {
      ERROR_CATALOG.INJECTED = {
        category: "internal",
        publicMessage: "Injected.",
        retryable: false,
      };
    } catch {
      // Strict mode throws on a frozen object, which is the expected outcome.
    }

    expect(Object.keys(ERROR_CATALOG).length).toBe(before);
  });

  test("mutating a nested entry has no effect", () => {
    const before = ERROR_CATALOG.VALIDATION_ERROR.publicMessage;

    try {
      ERROR_CATALOG.VALIDATION_ERROR.publicMessage = "Leaked.";
    } catch {
      // Expected in strict mode.
    }

    expect(ERROR_CATALOG.VALIDATION_ERROR.publicMessage).toBe(before);
  });

  test("the code enumeration is frozen", () => {
    expect(Object.isFrozen(ERROR_CODES)).toBe(true);
  });

  test("the category list is frozen", () => {
    expect(Object.isFrozen(ERROR_CATEGORIES)).toBe(true);
  });
});

describe("catalog independence", () => {
  test("no entry carries an HTTP status code", () => {
    for (const code of ERROR_CODES) {
      expect(Object.keys(ERROR_CATALOG[code]).sort()).toEqual([
        "category",
        "publicMessage",
        "retryable",
      ]);
    }
  });

  test("no entry carries runtime-specific or environment information", () => {
    for (const code of ERROR_CODES) {
      const serialized = JSON.stringify(ERROR_CATALOG[code]);

      expect(serialized).not.toContain("process.env");
      expect(serialized).not.toContain("Bun.");
      expect(serialized).not.toContain("http");
    }
  });

  test("the catalog is importable without initializing services", () => {
    expect(Object.keys(ERROR_CATALOG).length).toBe(EXPECTED_CODES.length);
  });

  test("lookup returns the catalog entry", () => {
    expect(getErrorCatalogEntry("FORBIDDEN")).toBe(ERROR_CATALOG.FORBIDDEN);
  });
});

describe("error code narrowing", () => {
  test("accepts registered codes", () => {
    for (const code of ERROR_CODES) {
      expect(isErrorCode(code)).toBe(true);
    }
  });

  test("rejects unregistered lookalike codes", () => {
    for (const value of ["NOT_A_CODE", "validation_error", "FORBIDDEN ", "", "FORBIDDEN\n"]) {
      expect(isErrorCode(value)).toBe(false);
    }
  });

  test("rejects non-string values", () => {
    for (const value of [null, undefined, 1, true, {}, [], Symbol("x")]) {
      expect(isErrorCode(value)).toBe(false);
    }
  });

  test("does not trust inherited object properties as codes", () => {
    expect(isErrorCode("toString")).toBe(false);
    expect(isErrorCode("constructor")).toBe(false);
  });
});
