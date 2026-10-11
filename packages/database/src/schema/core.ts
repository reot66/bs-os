/**
 * The Core schema namespace.
 *
 * FND-011 establishes the migration foundation only. It deliberately
 * declares **no tables**. Rule 12 assigns every entity a single domain
 * owner, and D-044 separates Core schema ownership from Module schema
 * ownership; inventing placeholder tables here would create ownership
 * decisions that no approved task has made.
 *
 * Declaring the namespace here gives Drizzle Kit a real, versioned
 * schema source to generate against. The first approved Core table can
 * be added to this file by a later, separately approved task, and
 * drizzle-kit will then produce a diff against the recorded baseline.
 *
 * @see docs/adr/0006-database-migration-governance.md
 */

import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Core-owned database objects.
 *
 * `pgSchema` declares a PostgreSQL schema and gives every table defined
 * inside it an explicit `core` qualification, so generated SQL can never
 * silently fall back to the `public` schema.
 */
export const core = pgSchema("core");
