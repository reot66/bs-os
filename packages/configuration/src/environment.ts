/**
 * Explicit environment parsing built on the central registry.
 *
 * Both parsers are pure functions of an explicitly supplied object.
 * Neither reads `process.env`, `Bun.env`, or `.env`, and neither writes
 * to global state. Application entry points remain responsible for
 * deciding where environment values come from.
 *
 * Validation failures are sanitized: an error carries a stable code and
 * a variable name, never a rejected value, never a raw Zod issue, and
 * never a Zod error attached as a public cause.
 */

import { z } from "zod";

import {
  DEFAULT_LOG_LEVEL,
  ENVIRONMENT_VARIABLE_REGISTRY,
  LOCAL_ADMIN_PARSER_VARIABLES,
  MIGRATION_PARSER_VARIABLES,
  REDACTED_VALUE,
  RUNTIME_PARSER_VARIABLES,
  findEnvironmentVariable,
  isRegisteredEnvironmentVariable,
  isUnregisteredPlatformVariable,
} from "./environment-registry.js";
import type {
  EnvironmentVariableDefinition,
  LogLevel,
  RuntimeEnvironment,
} from "./environment-registry.js";

/** Raw environment input. Values are always strings or absent. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export const ENVIRONMENT_ERROR_CODES = Object.freeze([
  "MISSING_REQUIRED_VALUE",
  "INVALID_VALUE",
  "UNKNOWN_VARIABLE",
  "FORBIDDEN_IN_PRODUCTION",
] as const);

export type EnvironmentErrorCode = (typeof ENVIRONMENT_ERROR_CODES)[number];

/**
 * Sanitized configuration failure.
 *
 * The message intentionally contains only the variable name and the
 * stable error code. The rejected value, the surrounding environment
 * object, and any underlying Zod issue are deliberately omitted so a
 * secret cannot leak through a log line or an error response.
 */
export class EnvironmentConfigError extends Error {
  readonly code: EnvironmentErrorCode;
  readonly variable: string;

  constructor(code: EnvironmentErrorCode, variable: string) {
    super(`Environment configuration error: ${variable} (${code})`);

    this.name = "EnvironmentConfigError";
    this.code = code;
    this.variable = variable;
  }
}

/** Application database settings usable by `@business-os/database`. */
export interface RuntimeDatabaseSettings {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
}

/** Validated runtime application configuration. */
export interface RuntimeEnvironmentConfig {
  readonly environment: RuntimeEnvironment;
  readonly logLevel: LogLevel;
  readonly database: RuntimeDatabaseSettings;
}

/** Local-only database administration settings. */
export interface LocalAdminDatabaseSettings {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
}

/** Validated local administration configuration. */
export interface LocalAdminEnvironmentConfig {
  readonly environment: RuntimeEnvironment;
  readonly database: LocalAdminDatabaseSettings;
}

/**
 * Local-only schema-migration settings.
 *
 * These are the dedicated migrator credentials. They are structurally
 * distinct from both the runtime application settings and the bootstrap
 * administration settings so that neither can be substituted for the
 * other by accident.
 */
export interface LocalMigrationDatabaseSettings {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
}

/** Validated local migration configuration. */
export interface LocalMigrationEnvironmentConfig {
  readonly environment: RuntimeEnvironment;
  readonly database: LocalMigrationDatabaseSettings;
}

/** Redacted, diagnostics-safe view of a configuration object. */
export type EnvironmentSummary = Readonly<Record<string, unknown>>;

/**
 * Build an object schema from registry entries.
 *
 * Whether a variable is required comes from the registry metadata, so
 * optionality is never re-declared in a second parallel structure.
 */
function schemaFor(
  entries: readonly { variable: string; schema: z.ZodType<unknown, unknown>; required: boolean }[],
): z.ZodType<Record<string, unknown>, unknown> {
  const shape: Record<string, z.ZodType<unknown, unknown>> = {};

  for (const entry of entries) {
    shape[entry.variable] = entry.required
      ? (entry.schema as z.ZodType<unknown, unknown>)
      : (entry.schema as z.ZodType<unknown, unknown>).optional();
  }

  return z.object(shape) as unknown as z.ZodType<Record<string, unknown>, unknown>;
}

const RUNTIME_SCHEMA = schemaFor(RUNTIME_PARSER_VARIABLES);

const LOCAL_ADMIN_SCHEMA = schemaFor(LOCAL_ADMIN_PARSER_VARIABLES);

const MIGRATION_SCHEMA = schemaFor(MIGRATION_PARSER_VARIABLES);

/**
 * Reject undeclared `BUSINESS_OS_*` keys.
 *
 * Ordinary operating-system variables such as `PATH` are ignored,
 * because they are not owned by this platform. A platform-prefixed key
 * that no subsystem has registered is rejected rather than silently
 * accepted, while a key registered for another subsystem stays valid
 * even when this particular parser does not consume it.
 */
function assertNoUnregisteredPlatformVariables(source: EnvironmentSource): void {
  for (const key of Object.keys(source)) {
    if (isUnregisteredPlatformVariable(key)) {
      throw new EnvironmentConfigError("UNKNOWN_VARIABLE", key);
    }
  }
}

/**
 * Convert a Zod failure into exactly one sanitized error.
 *
 * Only the first failing variable is reported, because reporting all of
 * them would widen the information an attacker learns from a single
 * probe. The Zod error itself is discarded rather than attached.
 *
 * "Missing" versus "invalid" is decided from the registry and the
 * supplied source rather than from Zod internals, because Zod issue
 * codes differ between validators and must not become part of this
 * package's error contract.
 */
function throwSanitized(
  result: { success: false; error: z.ZodError },
  source: EnvironmentSource,
): never {
  const issue = result.error.issues[0];

  if (issue === undefined) {
    throw new EnvironmentConfigError("INVALID_VALUE", "unknown");
  }

  const root = Array.isArray(issue.path) ? issue.path[0] : undefined;
  const variable = typeof root === "string" ? root : "unknown";
  const definition = findEnvironmentVariable(variable);
  const isMissing = definition?.required === true && source[variable] === undefined;

  throw new EnvironmentConfigError(
    isMissing ? "MISSING_REQUIRED_VALUE" : "INVALID_VALUE",
    variable,
  );
}

function parseWith(
  schema: z.ZodType<Record<string, unknown>, unknown>,
  source: EnvironmentSource,
): Record<string, unknown> {
  const result = schema.safeParse(source);

  if (!result.success) {
    throwSanitized(result, source);
  }

  return result.data;
}

function readString(values: Record<string, unknown>, variable: string): string {
  const value = values[variable];

  if (typeof value !== "string") {
    throw new EnvironmentConfigError("MISSING_REQUIRED_VALUE", variable);
  }

  return value;
}

function readNumber(values: Record<string, unknown>, variable: string): number {
  const value = values[variable];

  if (typeof value !== "number") {
    throw new EnvironmentConfigError("INVALID_VALUE", variable);
  }

  return value;
}

function readBoolean(values: Record<string, unknown>, variable: string): boolean {
  const value = values[variable];

  if (typeof value !== "boolean") {
    throw new EnvironmentConfigError("INVALID_VALUE", variable);
  }

  return value;
}

function freezeSettings<T extends Readonly<Record<string, unknown>>>(settings: T): Readonly<T> {
  return Object.freeze({ ...settings });
}

/**
 * Validate explicitly supplied runtime application environment values.
 *
 * Administrator credentials are never read or returned, even when
 * present in the source object. TLS must be decided explicitly, and a
 * `production` runtime may not run with TLS disabled.
 *
 * @param source Explicit environment values supplied by the caller.
 * @returns A deeply frozen runtime configuration.
 */
export function parseRuntimeEnvironment(source: EnvironmentSource): RuntimeEnvironmentConfig {
  assertNoUnregisteredPlatformVariables(source);

  const values = parseWith(RUNTIME_SCHEMA, source);

  const environment = readString(values, "BUSINESS_OS_ENV") as RuntimeEnvironment;
  const logLevel = (values.BUSINESS_OS_LOG_LEVEL ?? DEFAULT_LOG_LEVEL) as LogLevel;
  const ssl = readBoolean(values, "BUSINESS_OS_DB_SSL");

  // Production must never silently run without transport encryption.
  if (environment === "production" && ssl === false) {
    throw new EnvironmentConfigError("FORBIDDEN_IN_PRODUCTION", "BUSINESS_OS_DB_SSL");
  }

  const database = freezeSettings({
    host: readString(values, "BUSINESS_OS_DB_HOST"),
    port: readNumber(values, "BUSINESS_OS_DB_PORT"),
    database: readString(values, "BUSINESS_OS_DB_NAME"),
    user: readString(values, "BUSINESS_OS_DB_APP_USER"),
    password: readString(values, "BUSINESS_OS_DB_APP_PASSWORD"),
    ssl,
  });

  return Object.freeze({ environment, logLevel, database });
}

/**
 * Validate explicitly supplied local database administration values.
 *
 * This parser is intended only for authorized local developer tooling.
 * It refuses any runtime other than `local`, never falls back to
 * application credentials, and never provisions or modifies anything:
 * it only validates and returns values.
 *
 * @param source Explicit environment values supplied by the caller.
 * @returns A deeply frozen local administration configuration.
 */
export function parseLocalAdminEnvironment(source: EnvironmentSource): LocalAdminEnvironmentConfig {
  assertNoUnregisteredPlatformVariables(source);

  requireLocalEnvironment(source);

  const values = parseWith(LOCAL_ADMIN_SCHEMA, source);

  const database = freezeSettings({
    host: readString(values, "BUSINESS_OS_DB_HOST"),
    port: readNumber(values, "BUSINESS_OS_DB_PORT"),
    database: readString(values, "BUSINESS_OS_DB_NAME"),
    user: readString(values, "BUSINESS_OS_DB_USER"),
    password: readString(values, "BUSINESS_OS_DB_PASSWORD"),
    // The registry schema already transforms this value into a boolean,
    // so it must be read as one. Comparing it against the string "true"
    // would silently report an explicitly enabled TLS as disabled.
    ssl: readBoolean(values, "BUSINESS_OS_DB_SSL"),
  });

  return Object.freeze({ environment: "local", database });
}

/**
 * Require an explicitly declared `local` runtime.
 *
 * Schema migration is a privileged, local-only operation. Refusing every
 * other runtime here means a staging or production deployment cannot
 * produce migration credentials through this parser at all, rather than
 * producing them and relying on a later runtime check to refuse them.
 */
function requireLocalEnvironment(source: EnvironmentSource): void {
  const environmentValue = source.BUSINESS_OS_ENV;

  if (environmentValue === undefined || environmentValue === "") {
    throw new EnvironmentConfigError("MISSING_REQUIRED_VALUE", "BUSINESS_OS_ENV");
  }

  if (environmentValue !== "local") {
    throw new EnvironmentConfigError("FORBIDDEN_IN_PRODUCTION", "BUSINESS_OS_ENV");
  }
}

/**
 * Validate explicitly supplied local schema-migration values.
 *
 * This parser is for the dedicated migrator tooling only. It refuses any
 * runtime other than `local`, never falls back to application or
 * administrator credentials, and never provisions or modifies anything:
 * it only validates and returns values.
 *
 * @param source Explicit environment values supplied by the caller.
 * @returns A deeply frozen local migration configuration.
 */
export function parseLocalMigrationEnvironment(
  source: EnvironmentSource,
): LocalMigrationEnvironmentConfig {
  assertNoUnregisteredPlatformVariables(source);

  requireLocalEnvironment(source);

  const values = parseWith(MIGRATION_SCHEMA, source);

  const database = freezeSettings({
    host: readString(values, "BUSINESS_OS_DB_HOST"),
    port: readNumber(values, "BUSINESS_OS_DB_PORT"),
    database: readString(values, "BUSINESS_OS_DB_NAME"),
    user: readString(values, "BUSINESS_OS_DB_MIGRATOR_USER"),
    password: readString(values, "BUSINESS_OS_DB_MIGRATOR_PASSWORD"),
    // The registry schema transforms this into a boolean, so it must be
    // read as one rather than compared against the string "true".
    ssl: readBoolean(values, "BUSINESS_OS_DB_SSL"),
  });

  return Object.freeze({ environment: "local", database });
}

/**
 * Produce a diagnostics-safe summary of a configuration object.
 *
 * Redaction is derived entirely from registry metadata rather than a
 * second hand-maintained list of secret keys. A value is displayed only
 * when its registry entry is explicitly marked display-safe; every
 * other value, including every credential, is redacted. Administrator
 * credentials are never included at all.
 */
export function summarizeEnvironmentConfig(config: unknown): EnvironmentSummary {
  const settings = displayableSettings(config);
  const summary: Record<string, unknown> = {};

  for (const [variable, value] of Object.entries(settings)) {
    const definition = findEnvironmentVariable(variable);
    const field = databaseFieldFor(variable);

    // If any variable feeding the same field is a credential, the value
    // is redacted even when this particular entry is display-safe.
    const siblingIsSecret =
      field === undefined
        ? false
        : databaseVariablesForField(field).some((entry) => entry.sensitive === true);

    const displayable =
      siblingIsSecret !== true &&
      definition?.sensitive !== true &&
      definition?.displaySafe === true;

    summary[variable] = displayable ? value : REDACTED_VALUE;
  }

  summary.BUSINESS_OS_DB_CONFIGURED = typeof settings.BUSINESS_OS_DB_NAME === "string";

  return Object.freeze(summary);
}

function displayableSettings(config: unknown): Record<string, unknown> {
  if (typeof config !== "object" || config === null) {
    return {};
  }

  const record = config as Record<string, unknown>;
  const settings: Record<string, unknown> = {};

  if (typeof record.environment === "string") {
    settings.BUSINESS_OS_ENV = record.environment;
  }

  if (typeof record.logLevel === "string") {
    settings.BUSINESS_OS_LOG_LEVEL = record.logLevel;
  }

  const database = record.database;

  if (typeof database !== "object" || database === null) {
    return settings;
  }

  const databaseRecord = database as Record<string, unknown>;

  for (const field of ["host", "port", "database", "user", "password", "ssl"] as const) {
    const candidates = databaseVariablesForField(field);

    // Report under the runtime-scoped name so the shape is stable.
    const primary = candidates.find((entry) => entry.scope === "runtime") ?? candidates[0];

    if (primary !== undefined) {
      settings[primary.variable] = databaseRecord[field];
    }
  }

  return settings;
}

/**
 * Every registered variable that feeds a given database field.
 *
 * Both the runtime and the administration credential pairs map onto the
 * `user` and `password` fields, so both are considered. The migration
 * pair is considered as well. Redaction is therefore correct regardless
 * of which parser produced the object.
 */
function databaseVariablesForField(field: string): EnvironmentVariableDefinition<unknown>[] {
  return ENVIRONMENT_VARIABLE_REGISTRY.filter(
    (entry) => databaseFieldFor(entry.variable) === field,
  );
}

function databaseFieldFor(variable: string): string | undefined {
  switch (variable) {
    case "BUSINESS_OS_DB_HOST":
      return "host";
    case "BUSINESS_OS_DB_PORT":
      return "port";
    case "BUSINESS_OS_DB_NAME":
      return "database";
    case "BUSINESS_OS_DB_APP_USER":
      return "user";
    case "BUSINESS_OS_DB_APP_PASSWORD":
      return "password";
    case "BUSINESS_OS_DB_MIGRATOR_USER":
      return "user";
    case "BUSINESS_OS_DB_MIGRATOR_PASSWORD":
      return "password";
    case "BUSINESS_OS_DB_SSL":
      return "ssl";
    default:
      return undefined;
  }
}

/**
 * Reject a set of platform variable names that is not covered by the
 * central registry.
 *
 * Exposed so tooling and tests can assert drift without duplicating the
 * registry rules themselves.
 *
 * @param names Candidate platform variable names.
 * @returns The unregistered names, in input order.
 */
export function findUnregisteredPlatformVariables(names: readonly string[]): string[] {
  return names.filter((name) => isUnregisteredPlatformVariable(name));
}

/** True when every supplied platform name is centrally registered. */
export function areAllPlatformVariablesRegistered(names: readonly string[]): boolean {
  return names.every(
    (name) => !name.startsWith("BUSINESS_OS_") || isRegisteredEnvironmentVariable(name),
  );
}
