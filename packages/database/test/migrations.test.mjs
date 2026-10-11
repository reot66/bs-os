/**
 * Unit tests for the local Core migration tooling.
 *
 * These tests are pure: they exercise the guards, the privilege rules
 * and the journal classifier without a database. Real PostgreSQL
 * behaviour is covered separately by `migration-integration.test.mjs`,
 * which is opt-in.
 */

import { describe, expect, test } from "bun:test";

import {
  ADVISORY_LOCK_CLASS_ID,
  ADVISORY_LOCK_OBJECT_ID,
  EXPECTED_LOCAL_DATABASE,
  EXPECTED_LOCAL_HOST,
  FORBIDDEN_MIGRATION_ROLES,
  JOURNAL_SCHEMA,
  JOURNAL_TABLE,
  LOCK_MAX_ATTEMPTS,
  MigrationGuardError,
  assertApplyConfirmed,
  assertExpectedServerVersion,
  assertLocalMigrationTarget,
  assertMigrationRolePermitted,
  classifyJournalIntegrity,
} from "../tools/migrations/apply-local.ts";

/** A fake migrator password. Never a real credential. */
const FAKE_MIGRATOR_PASSWORD = "fake-migrator-password-not-real-13579";

function localTarget(overrides = {}) {
  return {
    host: EXPECTED_LOCAL_HOST,
    database: EXPECTED_LOCAL_DATABASE,
    environment: "local",
    ssl: false,
    ...overrides,
  };
}

function roleAttributes(overrides = {}) {
  return {
    roleName: "business_os_migrator",
    canLogin: true,
    superuser: false,
    createDb: false,
    createRole: false,
    replication: false,
    bypassRls: false,
    memberOf: [],
    ...overrides,
  };
}

function guardError(fn) {
  try {
    fn();
  } catch (error) {
    if (error instanceof MigrationGuardError) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected a MigrationGuardError");
}

describe("local migration target guard", () => {
  test("accepts the approved loopback development database", () => {
    expect(() => {
      assertLocalMigrationTarget(localTarget());
    }).not.toThrow();
  });

  test("refuses every non-local runtime", () => {
    for (const environment of ["test", "staging", "production"]) {
      const error = guardError(() => assertLocalMigrationTarget(localTarget({ environment })));

      expect({ environment, message: error.message }).toEqual({
        environment,
        message: `Refusing to migrate: environment must be "local", found "${environment}".`,
      });
    }
  });

  test("refuses a remote host", () => {
    for (const host of ["db.example.com", "10.0.0.5", "localhost", "0.0.0.0", ""]) {
      const error = guardError(() => assertLocalMigrationTarget(localTarget({ host })));

      expect(error.message).toContain("host must be 127.0.0.1");
    }
  });

  test("refuses any database other than the approved local one", () => {
    for (const database of ["postgres", "business_os", "production", ""]) {
      const error = guardError(() => assertLocalMigrationTarget(localTarget({ database })));

      expect(error.message).toContain(`database must be ${EXPECTED_LOCAL_DATABASE}`);
    }
  });

  test("refuses a TLS-enabled local target", () => {
    const error = guardError(() => assertLocalMigrationTarget(localTarget({ ssl: true })));

    expect(error.message).toContain("expected to run without TLS");
  });

  test("never includes a credential in a refusal", () => {
    const error = guardError(() =>
      assertLocalMigrationTarget(localTarget({ host: FAKE_MIGRATOR_PASSWORD })),
    );

    expect(error.message).not.toContain(FAKE_MIGRATOR_PASSWORD);
  });
});

describe("migration role permission guard", () => {
  test("accepts the dedicated least-privilege migrator", () => {
    expect(() => {
      assertMigrationRolePermitted(roleAttributes(), "business_os_migrator");
    }).not.toThrow();
  });

  test("refuses a superuser", () => {
    const error = guardError(() =>
      assertMigrationRolePermitted(roleAttributes({ superuser: true }), "business_os_migrator"),
    );

    expect(error.message).toContain("superuser");
  });

  test("refuses database, role, and replication capability", () => {
    for (const [field, fragment] of [
      ["createDb", "create databases"],
      ["createRole", "create roles"],
      ["replication", "replicate"],
    ]) {
      const error = guardError(() =>
        assertMigrationRolePermitted(roleAttributes({ [field]: true }), "business_os_migrator"),
      );

      expect(error.message).toContain(fragment);
    }
  });

  test("refuses row-level-security bypass", () => {
    const error = guardError(() =>
      assertMigrationRolePermitted(roleAttributes({ bypassRls: true }), "business_os_migrator"),
    );

    expect(error.message).toContain("bypass row-level security");
  });

  test("refuses a role that cannot log in", () => {
    const error = guardError(() =>
      assertMigrationRolePermitted(roleAttributes({ canLogin: false }), "business_os_migrator"),
    );

    expect(error.message).toContain("cannot log in");
  });

  test("refuses any inherited role membership", () => {
    const error = guardError(() =>
      assertMigrationRolePermitted(
        roleAttributes({ memberOf: ["some_admin_role"] }),
        "business_os_migrator",
      ),
    );

    expect(error.message).toContain("inherits membership");
  });

  test("refuses a role whose name is not the configured migrator", () => {
    const error = guardError(() =>
      assertMigrationRolePermitted(
        roleAttributes({ roleName: "business_os_app" }),
        "business_os_migrator",
      ),
    );

    expect(error.message).toContain('connected as "business_os_app"');
  });

  test("explicitly refuses application and bootstrap-administrator credentials", () => {
    for (const forbidden of FORBIDDEN_MIGRATION_ROLES) {
      expect(FORBIDDEN_MIGRATION_ROLES).toContain(forbidden);

      const error = guardError(() =>
        assertMigrationRolePermitted(roleAttributes({ roleName: forbidden }), forbidden),
      );

      expect(error.message).toContain("not permitted to apply migrations");
    }
  });

  test("the application role is on the forbidden list", () => {
    expect(FORBIDDEN_MIGRATION_ROLES).toContain("business_os_app");
  });
});

describe("server version guard", () => {
  test("accepts the reviewed major version", () => {
    expect(() => {
      assertExpectedServerVersion("18.6 (Debian 18.6-1.pgdg12+2)");
    }).not.toThrow();
  });

  test("refuses any other major version", () => {
    for (const version of ["16.9", "17.2", "19.0", "18.5", ""]) {
      const error = guardError(() => assertExpectedServerVersion(version));

      expect(error.message).toContain("expected PostgreSQL 18.6");
    }
  });

  test("refuses a version that merely contains the expected string", () => {
    const error = guardError(() => assertExpectedServerVersion("118.6"));

    expect(error.message).toContain("expected PostgreSQL 18.6");
  });
});

describe("apply confirmation", () => {
  test("requires an explicit --apply", () => {
    const error = guardError(() => assertApplyConfirmed([]));

    expect(error.message).toContain("explicit --apply");
  });

  test("accepts an explicit --apply", () => {
    expect(() => {
      assertApplyConfirmed(["--apply"]);
    }).not.toThrow();
  });

  test("refuses unrecognized arguments", () => {
    for (const argument of ["--force", "--yes", "-f", "--apply-all", "extra"]) {
      const error = guardError(() => assertApplyConfirmed(["--apply", argument]));

      expect(error.message).toContain("Unrecognized argument");
    }
  });

  test("refuses --force, which does not exist", () => {
    const error = guardError(() => assertApplyConfirmed(["--force"]));

    expect(error.message).toContain("Unrecognized argument");
  });
});

describe("journal integrity classification", () => {
  const local = [
    { folderMillis: 1000, hash: "hash-1000" },
    { folderMillis: 2000, hash: "hash-2000" },
    { folderMillis: 3000, hash: "hash-3000" },
  ];

  test("reports every migration as pending on an empty journal", () => {
    const report = classifyJournalIntegrity(local, []);

    expect(report).toMatchObject({
      appliedCount: 0,
      pendingCount: 3,
      latestAppliedMillis: null,
      latestPendingMillis: 3000,
    });
    expect(report.problems).toEqual([]);
  });

  test("reports no pending work when fully applied", () => {
    const report = classifyJournalIntegrity(local, [
      { createdAt: 1000, hash: "hash-1000" },
      { createdAt: 2000, hash: "hash-2000" },
      { createdAt: 3000, hash: "hash-3000" },
    ]);

    expect(report).toMatchObject({
      appliedCount: 3,
      pendingCount: 0,
      latestAppliedMillis: 3000,
      latestPendingMillis: null,
    });
    expect(report.problems).toEqual([]);
  });

  test("reports only the unapplied tail as pending", () => {
    const report = classifyJournalIntegrity(local, [
      { createdAt: 1000, hash: "hash-1000" },
      { createdAt: 2000, hash: "hash-2000" },
    ]);

    expect(report).toMatchObject({ appliedCount: 2, pendingCount: 1, latestPendingMillis: 3000 });
    expect(report.problems).toEqual([]);
  });

  test("accepts journal timestamps delivered as strings", () => {
    const report = classifyJournalIntegrity(local, [{ createdAt: "1000", hash: "hash-1000" }]);

    expect(report.appliedCount).toBe(1);
    expect(report.pendingCount).toBe(2);
    expect(report.problems).toEqual([]);
  });

  test("detects a deleted migration file", () => {
    const report = classifyJournalIntegrity(
      [local[0]],
      [
        { createdAt: 1000, hash: "hash-1000" },
        { createdAt: 2000, hash: "hash-2000" },
      ],
    );

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toMatchObject({
      kind: "MISSING_MIGRATION_FILE",
      folderMillis: 2000,
    });
  });

  test("detects a modified migration file", () => {
    const tampered = [
      { folderMillis: 1000, hash: "hash-1000" },
      { folderMillis: 2000, hash: "DIFFERENT-HASH" },
    ];

    const report = classifyJournalIntegrity(tampered, [
      { createdAt: 1000, hash: "hash-1000" },
      { createdAt: 2000, hash: "hash-2000" },
    ]);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toMatchObject({
      kind: "MODIFIED_MIGRATION_FILE",
      folderMillis: 2000,
    });
  });

  test("detects a duplicated journal row", () => {
    const report = classifyJournalIntegrity(local, [
      { createdAt: 1000, hash: "hash-1000" },
      { createdAt: 1000, hash: "hash-1000" },
    ]);

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toMatchObject({ kind: "DUPLICATE_JOURNAL_ROW", folderMillis: 1000 });
  });

  test("does not repair an inconsistent history", () => {
    const report = classifyJournalIntegrity([local[0]], [{ createdAt: 2000, hash: "hash-2000" }]);

    // The missing-file problem is reported; it is never silently dropped.
    expect(report.problems.map((problem) => problem.kind)).toEqual(["MISSING_MIGRATION_FILE"]);
  });

  test("returns a frozen report", () => {
    const report = classifyJournalIntegrity(local, []);

    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.problems)).toBe(true);
  });

  test("pending selection matches the migrator's own rule", () => {
    // The migrator applies migrations strictly newer than the newest
    // applied one. A gap in the middle must therefore not be reported as
    // pending, because the migrator would not run it either.
    const applied = [{ createdAt: 1000, hash: "hash-1000" }];
    const withGap = [
      { folderMillis: 1000, hash: "hash-1000" },
      { folderMillis: 2500, hash: "hash-2500" },
    ];

    const report = classifyJournalIntegrity(withGap, applied);

    expect(report.pendingCount).toBe(1);
    expect(report.latestPendingMillis).toBe(2500);
  });
});

describe("journal and lock constants", () => {
  test("journal lives in its own dedicated schema and table", () => {
    expect(JOURNAL_SCHEMA).toBe("drizzle");
    expect(JOURNAL_TABLE).toBe("__drizzle_migrations_core");
  });

  test("the advisory lock uses two 32-bit integers within exact range", () => {
    for (const key of [ADVISORY_LOCK_CLASS_ID, ADVISORY_LOCK_OBJECT_ID]) {
      expect(Number.isInteger(key)).toBe(true);
      expect(key >= -(2 ** 31) && key <= 2 ** 31 - 1).toBe(true);
    }

    // Values must be exactly representable as JavaScript numbers.
    expect(ADVISORY_LOCK_CLASS_ID).toBe(16_979);
    expect(ADVISORY_LOCK_OBJECT_ID).toBe(1);
  });

  test("the lock wait is bounded, never an unbounded retry", () => {
    expect(LOCK_MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(LOCK_MAX_ATTEMPTS).toBeLessThanOrEqual(120);
  });
});
