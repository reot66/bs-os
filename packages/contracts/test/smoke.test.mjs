import { expect, test } from "bun:test";

import { CONTRACTS_PACKAGE_ID } from "../dist/index.js";

test("contracts package exports its identifier", () => {
  expect(CONTRACTS_PACKAGE_ID).toBe("@business-os/contracts");
});
