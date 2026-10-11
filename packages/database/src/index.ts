/**
 * Business OS shared database access layer.
 *
 * This package exposes an explicit, caller-owned PostgreSQL connection
 * built on `pg` and Drizzle ORM. It intentionally exports no singleton,
 * no credentials, and no administrative tooling.
 *
 * Developer-only role provisioning and verification tools live under
 * `packages/database/tools/local/` and are deliberately excluded from
 * this public export map.
 */

export {
  DATABASE_CONFIG_ERROR_CODES,
  DATABASE_CONFIG_KEYS,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_MAX_POOL_SIZE,
  DatabaseConfigError,
  parseDatabaseConfig,
} from "./config.js";

export type {
  DatabaseConfigErrorCode,
  DatabaseConfigInput,
  DatabaseConfigKey,
  ValidatedDatabaseConfig,
} from "./config.js";

export { DatabaseConnectionError, createDatabase } from "./connection.js";

export type { DatabaseClient, DatabaseHandle } from "./connection.js";
