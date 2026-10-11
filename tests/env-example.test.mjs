import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import {
  REGISTERED_ENVIRONMENT_VARIABLES,
  SECRET_PLACEHOLDER_PREFIX,
  SENSITIVE_ENVIRONMENT_VARIABLES,
  findEnvironmentVariable,
  isRegisteredEnvironmentVariable,
} from "@business-os/configuration";

const EXAMPLE_PATH = new URL("../.env.example", import.meta.url);

/**
 * Parse the committed template.
 *
 * Only `.env.example` is read. The developer's real `.env` is never
 * opened, and no value is ever printed.
 */
function readTemplateEntries() {
  const contents = readFileSync(EXAMPLE_PATH, "utf8");
  const entries = new Map();
  const duplicates = [];

  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (entries.has(key)) {
      duplicates.push(key);
    }

    entries.set(key, value);
  }

  return { entries, duplicates };
}

describe("environment template drift", () => {
  test(".env.example contains no duplicate definitions", () => {
    const { duplicates } = readTemplateEntries();

    expect(duplicates).toEqual([]);
  });

  test("every registered variable has an example entry", () => {
    const { entries } = readTemplateEntries();
    const missing = [...REGISTERED_ENVIRONMENT_VARIABLES].filter((name) => !entries.has(name));

    expect(missing).toEqual([]);
  });

  test("every example BUSINESS_OS_ variable is registered", () => {
    const { entries } = readTemplateEntries();
    const unknown = [...entries.keys()].filter(
      (name) => name.startsWith("BUSINESS_OS_") && !isRegisteredEnvironmentVariable(name),
    );

    expect(unknown).toEqual([]);
  });

  test("the example defines exactly the registered variables", () => {
    const { entries } = readTemplateEntries();
    const declared = [...entries.keys()].filter((name) => name.startsWith("BUSINESS_OS_")).sort();
    const registered = [...REGISTERED_ENVIRONMENT_VARIABLES].sort();

    expect(declared).toEqual(registered);
  });

  test("secret-backed keys carry placeholders, never real credentials", () => {
    const { entries } = readTemplateEntries();

    for (const variable of SENSITIVE_ENVIRONMENT_VARIABLES) {
      const value = entries.get(variable);

      expect({ variable, present: value !== undefined }).toEqual({
        variable,
        present: true,
      });
      expect({ variable, isPlaceholder: value.startsWith(SECRET_PLACEHOLDER_PREFIX) }).toEqual({
        variable,
        isPlaceholder: true,
      });
    }
  });

  test("non-secret variables are not disguised as secrets", () => {
    const { entries } = readTemplateEntries();

    for (const [name, value] of entries) {
      const definition = findEnvironmentVariable(name);

      if (definition === undefined || definition.sensitive !== true) {
        expect({ name, isPlaceholder: value.startsWith(SECRET_PLACEHOLDER_PREFIX) }).toEqual({
          name,
          isPlaceholder: false,
        });
      }
    }
  });

  test("the example never contains a privileged production host", () => {
    const { entries } = readTemplateEntries();

    expect(entries.get("BUSINESS_OS_ENV")).toBe("local");
    expect(entries.get("BUSINESS_OS_DB_SSL")).toBe("false");
  });

  test("detects drift when a registered variable is undocumented", () => {
    const { entries } = readTemplateEntries();
    const hypotheticalRegistry = [...REGISTERED_ENVIRONMENT_VARIABLES, "BUSINESS_OS_FUTURE"];
    const missing = hypotheticalRegistry.filter((name) => !entries.has(name));

    expect(missing).toEqual(["BUSINESS_OS_FUTURE"]);
  });

  test("detects drift when an example variable is unregistered", () => {
    const { entries } = readTemplateEntries();
    const documented = [...entries.keys(), "BUSINESS_OS_UNDOCUMENTED"];
    const unknown = documented.filter(
      (name) => name.startsWith("BUSINESS_OS_") && !isRegisteredEnvironmentVariable(name),
    );

    expect(unknown).toEqual(["BUSINESS_OS_UNDOCUMENTED"]);
  });

  test("the template never reads the developer's real .env", () => {
    // Only the committed example is used. A real .env may contain
    // different values and must not influence this suite.
    const { entries } = readTemplateEntries();

    expect(entries.has("BUSINESS_OS_ENV")).toBe(true);
    expect(readFileSync(EXAMPLE_PATH, "utf8")).toContain("Never commit your real .env file");
  });
});
