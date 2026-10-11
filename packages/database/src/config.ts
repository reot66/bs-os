/**
 * Explicit, validated database connection configuration.
 *
 * This module is intentionally pure: it never reads `process.env`,
 * `Bun.env`, `.env` files, or any ambient runtime state, and it never
 * opens a database connection. Callers must pass configuration
 * explicitly, which keeps the package testable, portable and free of
 * hidden environment coupling.
 */

export const DATABASE_CONFIG_ERROR_CODES = Object.freeze([
  "MISSING_REQUIRED_VALUE",
  "INVALID_VALUE",
] as const);

export type DatabaseConfigErrorCode = (typeof DATABASE_CONFIG_ERROR_CODES)[number];

export const DATABASE_CONFIG_KEYS = Object.freeze([
  "host",
  "port",
  "database",
  "user",
  "password",
  "ssl",
  "maxPoolSize",
  "connectionTimeoutMs",
  "idleTimeoutMs",
] as const);

export type DatabaseConfigKey = (typeof DATABASE_CONFIG_KEYS)[number];

/**
 * Structured configuration error.
 *
 * The message intentionally identifies only the offending key and the
 * error code. Rejected values are never included, so a password or
 * host that fails validation can never leak through an error message
 * or a log line.
 */
export class DatabaseConfigError extends Error {
  readonly code: DatabaseConfigErrorCode;
  readonly key: DatabaseConfigKey;

  constructor(code: DatabaseConfigErrorCode, key: DatabaseConfigKey) {
    super(`Database configuration error: ${key} (${code})`);

    this.name = "DatabaseConfigError";
    this.code = code;
    this.key = key;
  }
}

/** Configuration exactly as supplied by the caller, before validation. */
export interface DatabaseConfigInput {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly maxPoolSize?: number;
  readonly connectionTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
}

/** Configuration after validation, safe to hand to the connection factory. */
export interface ValidatedDatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly maxPoolSize: number;
  readonly connectionTimeoutMs: number;
  readonly idleTimeoutMs: number;
}

export const DEFAULT_MAX_POOL_SIZE = 10;
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
export const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

const MIN_PORT = 1;
const MAX_PORT = 65_535;

function requireNonEmptyString(value: unknown, key: DatabaseConfigKey): string {
  if (value === undefined || value === null || value === "") {
    throw new DatabaseConfigError("MISSING_REQUIRED_VALUE", key);
  }

  if (typeof value !== "string") {
    throw new DatabaseConfigError("INVALID_VALUE", key);
  }

  if (value.trim() === "") {
    throw new DatabaseConfigError("MISSING_REQUIRED_VALUE", key);
  }

  return value;
}

function requirePositiveInteger(value: unknown, key: DatabaseConfigKey): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new DatabaseConfigError("INVALID_VALUE", key);
  }

  return value;
}

function requirePort(value: unknown, key: DatabaseConfigKey): number {
  if (value === undefined || value === null) {
    throw new DatabaseConfigError("MISSING_REQUIRED_VALUE", key);
  }

  const port = requirePositiveInteger(value, key);

  if (port < MIN_PORT || port > MAX_PORT) {
    throw new DatabaseConfigError("INVALID_VALUE", key);
  }

  return port;
}

function requireBoolean(value: unknown, key: DatabaseConfigKey): boolean {
  if (value === undefined || value === null) {
    throw new DatabaseConfigError("MISSING_REQUIRED_VALUE", key);
  }

  if (typeof value !== "boolean") {
    throw new DatabaseConfigError("INVALID_VALUE", key);
  }

  return value;
}

function optionalPositiveInteger(
  value: number | undefined,
  fallback: number,
  key: DatabaseConfigKey,
): number {
  if (value === undefined) {
    return fallback;
  }

  return requirePositiveInteger(value, key);
}

/**
 * Validate an explicit database configuration.
 *
 * Every mandatory field is required, including `ssl`, so the TLS
 * decision can never be left to an implicit default. Pool sizing and
 * timeouts are optional and fall back to bounded defaults.
 *
 * The supplied input is never modified, and the returned object is
 * frozen.
 */
export function parseDatabaseConfig(input: DatabaseConfigInput): Readonly<ValidatedDatabaseConfig> {
  if (typeof input !== "object" || input === null) {
    throw new DatabaseConfigError("INVALID_VALUE", "host");
  }

  const host = requireNonEmptyString(input.host, "host");
  const port = requirePort(input.port, "port");
  const database = requireNonEmptyString(input.database, "database");
  const user = requireNonEmptyString(input.user, "user");
  const password = requireNonEmptyString(input.password, "password");
  const ssl = requireBoolean(input.ssl, "ssl");
  const maxPoolSize = optionalPositiveInteger(
    input.maxPoolSize,
    DEFAULT_MAX_POOL_SIZE,
    "maxPoolSize",
  );
  const connectionTimeoutMs = optionalPositiveInteger(
    input.connectionTimeoutMs,
    DEFAULT_CONNECTION_TIMEOUT_MS,
    "connectionTimeoutMs",
  );
  const idleTimeoutMs = optionalPositiveInteger(
    input.idleTimeoutMs,
    DEFAULT_IDLE_TIMEOUT_MS,
    "idleTimeoutMs",
  );

  return Object.freeze({
    host,
    port,
    database,
    user,
    password,
    ssl,
    maxPoolSize,
    connectionTimeoutMs,
    idleTimeoutMs,
  });
}
