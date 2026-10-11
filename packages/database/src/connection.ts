/**
 * Database connection factory built on `pg` and Drizzle ORM.
 *
 * The factory is explicit and caller-owned: nothing is created at module
 * import time, no environment variable is read, and no global singleton
 * exists. The caller creates the database, uses it, and closes it.
 *
 * Only standard JavaScript and TypeScript APIs are used here so the
 * shared package stays portable across JavaScript runtimes.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Pool } from "pg";

import type { ValidatedDatabaseConfig } from "./config.js";

const { Pool: PgPool } = pg;

/**
 * The Drizzle client type exposed to callers.
 *
 * `Record<string, never>` means no schema tables are registered yet.
 * FND-007 intentionally defines no tables; a later schema task will
 * supply the schema type parameter.
 */
export type DatabaseClient = NodePgDatabase<Record<string, never>>;

export interface DatabaseHandle {
  /** Drizzle client for typed, parameterized data access. */
  readonly db: DatabaseClient;
  /** Underlying `pg` pool, exposed for pool metrics and controlled shutdown. */
  readonly pool: Pool;
  /** Verify connectivity with a real round trip to the database. */
  ping(): Promise<void>;
  /** Release every pooled connection. Safe to call more than once. */
  close(): Promise<void>;
}

/**
 * Sanitized database failure.
 *
 * Raw driver errors can contain connection details, so they are never
 * returned to callers. Only the PostgreSQL SQLSTATE code is preserved,
 * because it is non-sensitive and essential for diagnosis.
 */
export class DatabaseConnectionError extends Error {
  readonly sqlstate: string | undefined;

  constructor(message: string, sqlstate: string | undefined) {
    super(message);

    this.name = "DatabaseConnectionError";
    this.sqlstate = sqlstate;
  }
}

function toSanitizedError(error: unknown): DatabaseConnectionError {
  const sqlstate =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;

  return new DatabaseConnectionError(
    "Database operation failed. Inspect the SQLSTATE code for the PostgreSQL error category.",
    sqlstate,
  );
}

/**
 * Create a database handle from validated configuration.
 *
 * The returned handle is inert: the pool is created but no connection is
 * opened until the first query or an explicit `ping()`.
 */
export function createDatabase(config: Readonly<ValidatedDatabaseConfig>): DatabaseHandle {
  const pool = new PgPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    max: config.maxPoolSize,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
  });

  const db = drizzle({ client: pool });

  let closed = false;

  return {
    db,
    pool,

    async ping(): Promise<void> {
      try {
        // Parameterized round trip. `sql` builds a parameter-safe statement.
        await db.execute(sql`SELECT 1`);
      } catch (error) {
        throw toSanitizedError(error);
      }
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }

      closed = true;

      try {
        await pool.end();
      } catch (error) {
        throw toSanitizedError(error);
      }
    },
  };
}
