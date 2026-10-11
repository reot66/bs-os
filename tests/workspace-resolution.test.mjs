import { expect, test } from "bun:test";

import { CONTRACTS_PACKAGE_ID } from "@business-os/contracts";

import { RUNTIME_ENVIRONMENTS, parseBootstrapConfig } from "@business-os/configuration";

test("contracts package resolves from the repository root", () => {
  expect(CONTRACTS_PACKAGE_ID).toBe("@business-os/contracts");
});

test("configuration package resolves from the repository root", () => {
  const config = parseBootstrapConfig({
    BUSINESS_OS_ENV: "test",
  });

  expect(config).toEqual({
    environment: "test",
    logLevel: "info",
  });
});

test("workspace configuration exports are accessible by package name", () => {
  expect(RUNTIME_ENVIRONMENTS).toEqual(["local", "test", "staging", "production"]);
});
