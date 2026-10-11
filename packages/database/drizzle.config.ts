/**
 * Drizzle Kit configuration for the Core migration set.
 *
 * Generation is a purely local, offline operation: `drizzle-kit
 * generate` reads this file and the schema source, and writes SQL plus
 * metadata under `migrations/core/`. It never connects to a database,
 * which is why `dbCredentials` is deliberately absent here. Applying
 * those files is a separate, explicit step performed by
 * `tools/migrations/apply-local.ts` with the dedicated migrator role.
 *
 * `drizzle-kit push` and `drizzle-kit migrate` are not used. `push`
 * mutates a live schema by diffing without a reviewed SQL file, and
 * `migrate` would take its connection from this file, which would place
 * credentials in a committed source file and would bypass the advisory
 * lock that serializes concurrent migrations.
 *
 * @see docs/adr/0006-database-migration-governance.md
 */

import { defineConfig } from "drizzle-kit";

import { core } from "./src/schema/core.js";

export default defineConfig({
  dialect: "postgresql",
  /** The approved Core schema source. */
  schema: "./src/schema/core.ts",
  /** Version-controlled Core SQL migrations and their metadata. */
  out: "./migrations/core",
  migrations: {
    /**
     * A dedicated journal, separate from any future domain journal, so
     * Core and Module migration histories can never be confused for one
     * another or silently applied into the wrong schema.
     */
    table: "__drizzle_migrations_core",
    schema: "drizzle",
    /**
     * Deterministic file naming. An index prefix removes wall-clock time
     * from generated filenames, which keeps regeneration reproducible.
     */
    prefix: "index",
  },
  /** Require explicit confirmation before any schema-synchronizing action. */
  strict: true,
  verbose: true,
});

/**
 * Referenced so the import is not tree-shaken away and so a broken
 * schema source fails this configuration file's typecheck loudly.
 */
void core;
