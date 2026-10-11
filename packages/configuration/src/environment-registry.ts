/**
 * Central environment-variable registry for Business OS.
 *
 * This module is the single authoritative source of truth for every
 * supported `BUSINESS_OS_*` environment variable: its name, its
 * validation schema, and its metadata.
 *
 * Environment is only one of five separate concerns. This registry does
 * NOT implement tenant or business configuration, feature flags,
 * entitlements, or a secrets vault. A variable may be *classified* as
 * sensitive without this package becoming a secret-management service.
 *
 * This module never reads `process.env`, `Bun.env`, or `.env`. Callers
 * pass values explicitly, so validation stays pure and portable.
 */

import { z } from "zod";

/**
 * Canonical runtime environment values.
 *
 * These are the only accepted runtime environments. Matching is
 * case-sensitive. Nothing here is ever defaulted to `production` or
 * `local` implicitly.
 */
export const RUNTIME_ENVIRONMENTS = Object.freeze([
  "local",
  "test",
  "staging",
  "production",
] as const);

export type RuntimeEnvironment = (typeof RUNTIME_ENVIRONMENTS)[number];

/** Canonical log levels. */
export const LOG_LEVELS = Object.freeze(["debug", "info", "warn", "error"] as const);

export type LogLevel = (typeof LOG_LEVELS)[number];

export const ENVIRONMENT_VARIABLE_CATEGORIES = Object.freeze([
  "runtime-bootstrap",
  "runtime-database",
  "database-infrastructure",
  "local-database-administration",
  "local-database-migration",
] as const);

export type EnvironmentVariableCategory = (typeof ENVIRONMENT_VARIABLE_CATEGORIES)[number];

export const ENVIRONMENT_VARIABLE_OWNERS = Object.freeze(["platform-core", "database"] as const);

export type EnvironmentVariableOwner = (typeof ENVIRONMENT_VARIABLE_OWNERS)[number];

/**
 * Which parser boundary consumes a variable.
 *
 * `runtime` variables are visible to application configuration.
 * `local-administration` variables are reserved for authorized local
 * database tooling and are never returned by the runtime parser.
 * `local-migration` variables are reserved for the schema-migration
 * tooling. They are deliberately kept apart from both other scopes:
 * migration credentials must never reach ordinary application
 * configuration, and an application credential must never be usable to
 * apply a migration.
 */
export const ENVIRONMENT_VARIABLE_SCOPES = Object.freeze([
  "runtime",
  "local-administration",
  "local-migration",
] as const);

export type EnvironmentVariableScope = (typeof ENVIRONMENT_VARIABLE_SCOPES)[number];

/**
 * Parser grouping.
 *
 * Grouping expresses which variables travel together, so each parser is
 * assembled from metadata instead of a hand-written key list. It also
 * keeps the three database credential pairs unambiguously distinct from
 * the shared connection settings they all need.
 */
export const ENVIRONMENT_VARIABLE_GROUPS = Object.freeze([
  "environment",
  "logging",
  "database-connection",
  "application-credentials",
  "administration-credentials",
  "migration-credentials",
] as const);

export type EnvironmentVariableGroup = (typeof ENVIRONMENT_VARIABLE_GROUPS)[number];

/** Prefix identifying variables owned by this platform. */
export const ENVIRONMENT_VARIABLE_PREFIX = "BUSINESS_OS_";

/** Default applied when the log-level variable is absent entirely. */
export const DEFAULT_LOG_LEVEL: LogLevel = "info";

/** Shared marker used by `.env.example` for values a developer must replace. */
export const SECRET_PLACEHOLDER_PREFIX = "REPLACE_WITH_";

/** Text substituted for any value that must not be displayed. */
export const REDACTED_VALUE = "[redacted]";

/**
 * A single centrally maintained environment-variable definition.
 *
 * There is exactly one definition per variable. Validation schemas are
 * never duplicated in a second parallel structure.
 */
export interface EnvironmentVariableDefinition<TOutput = unknown> {
  /** The exact environment-variable name. */
  readonly variable: string;
  /** Zod schema used to validate and coerce the raw string value. */
  readonly schema: z.ZodType<TOutput>;
  /** What the variable configures. */
  readonly category: EnvironmentVariableCategory;
  /** Which subsystem owns the variable. */
  readonly owner: EnvironmentVariableOwner;
  /** Which parser boundary may consume the variable. */
  readonly scope: EnvironmentVariableScope;
  /** Which variables travel together through a parser. */
  readonly group: EnvironmentVariableGroup;
  /** Whether the variable must be present. */
  readonly required: boolean;
  /** Value applied when the variable is absent, or undefined when there is none. */
  readonly defaultValue: string | undefined;
  /** True when the value is a credential that must never be displayed. */
  readonly sensitive: boolean;
  /** True when the value may appear in a diagnostic summary. */
  readonly displaySafe: boolean;
  /** Whether changing the variable requires a process restart. */
  readonly restartRequired: boolean;
  /** Short human description. */
  readonly description: string;
}

const runtimeEnvironmentSchema = z.enum(RUNTIME_ENVIRONMENTS);
const logLevelSchema = z.enum(LOG_LEVELS);

/**
 * Strict database port parsing.
 *
 * A numeric string is converted to an integer, but malformed input is
 * rejected rather than coerced. `z.coerce.number()` is deliberately not
 * used because it silently turns `""` and `"   "` into `0`.
 */
const databasePortSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[0-9]+$/, "must be a decimal integer string")
  .transform(Number)
  .refine((value) => Number.isInteger(value) && value >= 1 && value <= 65_535, {
    message: "must be between 1 and 65535",
  });

/**
 * Strict boolean parsing that accepts only the exact strings
 * `true` and `false`.
 *
 * `Boolean("false")` is `true`, so it is deliberately avoided.
 */
const databaseSslSchema = z
  .union([z.literal("true"), z.literal("false")], {
    message: 'must be exactly "true" or "false"',
  })
  .transform((value) => value === "true");

const databaseHostSchema = z.string().trim().min(1);

const databaseNameSchema = z.string().trim().min(1);

/**
 * A credential value.
 *
 * Empty values and the documented `REPLACE_WITH_*` placeholders are
 * rejected, because both would otherwise become real credentials by
 * accident.
 */
const secretSchema = z
  .string()
  .min(1, "must not be empty")
  .refine((value) => !value.startsWith(SECRET_PLACEHOLDER_PREFIX), {
    message: "must not be a placeholder value",
  });

function define<TOutput>(
  definition: EnvironmentVariableDefinition<TOutput>,
): EnvironmentVariableDefinition<TOutput> {
  return Object.freeze(definition);
}

/**
 * The authoritative environment-variable inventory.
 *
 * The first eight variables are runtime-visible. The last four are
 * reserved for local database administration and local schema
 * migration, and are deliberately NOT part of runtime application
 * configuration.
 */
export const ENVIRONMENT_VARIABLE_REGISTRY: readonly EnvironmentVariableDefinition<unknown>[] =
  Object.freeze([
    define({
      variable: "BUSINESS_OS_ENV",
      schema: runtimeEnvironmentSchema,
      category: "runtime-bootstrap",
      owner: "platform-core",
      scope: "runtime",
      group: "environment",
      required: true,
      defaultValue: undefined,
      sensitive: false,
      displaySafe: true,
      restartRequired: false,
      description: "Active runtime environment.",
    }),
    define({
      variable: "BUSINESS_OS_LOG_LEVEL",
      schema: logLevelSchema,
      category: "runtime-bootstrap",
      owner: "platform-core",
      scope: "runtime",
      group: "logging",
      required: false,
      defaultValue: DEFAULT_LOG_LEVEL,
      sensitive: false,
      displaySafe: true,
      restartRequired: false,
      description: "Minimum application log level.",
    }),
    define({
      variable: "BUSINESS_OS_DB_HOST",
      schema: databaseHostSchema,
      category: "runtime-database",
      owner: "database",
      scope: "runtime",
      group: "database-connection",
      required: true,
      defaultValue: undefined,
      sensitive: false,
      // Host names can reveal internal topology, so they stay redacted.
      displaySafe: false,
      restartRequired: true,
      description: "PostgreSQL host used by application connections.",
    }),
    define({
      variable: "BUSINESS_OS_DB_PORT",
      schema: databasePortSchema,
      category: "runtime-database",
      owner: "database",
      scope: "runtime",
      group: "database-connection",
      required: true,
      defaultValue: undefined,
      sensitive: false,
      displaySafe: true,
      restartRequired: true,
      description: "PostgreSQL port used by application connections.",
    }),
    define({
      variable: "BUSINESS_OS_DB_NAME",
      schema: databaseNameSchema,
      category: "database-infrastructure",
      owner: "database",
      scope: "runtime",
      group: "database-connection",
      required: true,
      defaultValue: undefined,
      sensitive: false,
      displaySafe: false,
      restartRequired: true,
      description: "PostgreSQL database name for the application.",
    }),
    define({
      variable: "BUSINESS_OS_DB_SSL",
      schema: databaseSslSchema,
      category: "runtime-database",
      owner: "database",
      scope: "runtime",
      group: "database-connection",
      required: true,
      defaultValue: undefined,
      sensitive: false,
      displaySafe: true,
      restartRequired: true,
      description: "Explicit TLS decision for application database connections.",
    }),
    define({
      variable: "BUSINESS_OS_DB_APP_USER",
      schema: databaseNameSchema,
      category: "runtime-database",
      owner: "database",
      scope: "runtime",
      group: "application-credentials",
      required: true,
      defaultValue: undefined,
      sensitive: false,
      displaySafe: false,
      restartRequired: true,
      description: "Least-privilege runtime database role.",
    }),
    define({
      variable: "BUSINESS_OS_DB_APP_PASSWORD",
      schema: secretSchema,
      category: "runtime-database",
      owner: "database",
      scope: "runtime",
      group: "application-credentials",
      required: true,
      defaultValue: undefined,
      sensitive: true,
      displaySafe: false,
      restartRequired: true,
      description: "Password for the least-privilege runtime database role.",
    }),
    define({
      variable: "BUSINESS_OS_DB_USER",
      schema: databaseNameSchema,
      category: "local-database-administration",
      owner: "database",
      scope: "local-administration",
      group: "administration-credentials",
      required: true,
      defaultValue: undefined,
      sensitive: false,
      displaySafe: false,
      restartRequired: true,
      description: "Local-only bootstrap administration database role.",
    }),
    define({
      variable: "BUSINESS_OS_DB_PASSWORD",
      schema: secretSchema,
      category: "local-database-administration",
      owner: "database",
      scope: "local-administration",
      group: "administration-credentials",
      required: true,
      defaultValue: undefined,
      sensitive: true,
      displaySafe: false,
      restartRequired: true,
      description: "Password for the local-only bootstrap administration role.",
    }),
    define({
      variable: "BUSINESS_OS_DB_MIGRATOR_USER",
      schema: databaseNameSchema,
      category: "local-database-migration",
      owner: "database",
      scope: "local-migration",
      group: "migration-credentials",
      required: true,
      defaultValue: undefined,
      sensitive: false,
      // Role names can reveal internal topology, so they stay redacted.
      displaySafe: false,
      restartRequired: true,
      description: "Dedicated local role that applies versioned Core migrations.",
    }),
    define({
      variable: "BUSINESS_OS_DB_MIGRATOR_PASSWORD",
      schema: secretSchema,
      category: "local-database-migration",
      owner: "database",
      scope: "local-migration",
      group: "migration-credentials",
      required: true,
      defaultValue: undefined,
      // A credential: classified once here, and never displayed.
      sensitive: true,
      displaySafe: false,
      restartRequired: true,
      description: "Password for the dedicated local Core migration role.",
    }),
  ]);

/** Every registered variable name, in registry order. */
export const REGISTERED_ENVIRONMENT_VARIABLES: readonly string[] = Object.freeze(
  ENVIRONMENT_VARIABLE_REGISTRY.map((entry) => entry.variable),
);

function indexRegistry(
  predicate: (definition: EnvironmentVariableDefinition<unknown>) => boolean,
): readonly EnvironmentVariableDefinition<unknown>[] {
  return Object.freeze(ENVIRONMENT_VARIABLE_REGISTRY.filter(predicate));
}

/** Registry entries visible to application runtime configuration. */
export const RUNTIME_ENVIRONMENT_VARIABLES: readonly EnvironmentVariableDefinition<unknown>[] =
  indexRegistry((entry) => entry.scope === "runtime");

/** Registry entries reserved for local database administration. */
export const LOCAL_ADMIN_ENVIRONMENT_VARIABLES: readonly EnvironmentVariableDefinition<unknown>[] =
  indexRegistry((entry) => entry.scope === "local-administration");

/**
 * Registry entries reserved for local schema migration.
 *
 * These credentials are held apart from both runtime application
 * credentials and local administrator credentials so that migration
 * authority is never reachable from an ordinary application request.
 */
export const MIGRATION_ENVIRONMENT_VARIABLES: readonly EnvironmentVariableDefinition<unknown>[] =
  indexRegistry((entry) => entry.scope === "local-migration");

/** Variable names visible to the runtime parser. */
export const RUNTIME_ENVIRONMENT_VARIABLE_NAMES: readonly string[] = Object.freeze(
  RUNTIME_ENVIRONMENT_VARIABLES.map((entry) => entry.variable),
);

/** Variable names reserved for local administration. */
export const LOCAL_ADMIN_ENVIRONMENT_VARIABLE_NAMES: readonly string[] = Object.freeze(
  LOCAL_ADMIN_ENVIRONMENT_VARIABLES.map((entry) => entry.variable),
);

/** Variable names reserved for local schema migration. */
export const MIGRATION_ENVIRONMENT_VARIABLE_NAMES: readonly string[] = Object.freeze(
  MIGRATION_ENVIRONMENT_VARIABLES.map((entry) => entry.variable),
);

/** Variable names classified as credentials. */
export const SENSITIVE_ENVIRONMENT_VARIABLES: readonly string[] = Object.freeze(
  ENVIRONMENT_VARIABLE_REGISTRY.filter((entry) => entry.sensitive).map((entry) => entry.variable),
);

/**
 * Database connection settings shared by both credential pairs.
 *
 * Host, port, database name, and the TLS decision are needed by the
 * runtime parser and by local administration tooling alike.
 */
export const DATABASE_CONNECTION_VARIABLES: readonly EnvironmentVariableDefinition<unknown>[] =
  indexRegistry((entry) => entry.group === "database-connection");

/** Entries consumed by the runtime application parser. */
export const RUNTIME_PARSER_VARIABLES: readonly EnvironmentVariableDefinition<unknown>[] =
  Object.freeze(
    ENVIRONMENT_VARIABLE_REGISTRY.filter(
      (entry) =>
        entry.group === "environment" ||
        entry.group === "logging" ||
        entry.group === "database-connection" ||
        entry.group === "application-credentials",
    ),
  );

/**
 * Entries consumed by the local administration parser.
 *
 * Administration tooling needs the shared connection settings plus the
 * administrator credentials, but never the runtime application
 * credentials.
 */
export const LOCAL_ADMIN_PARSER_VARIABLES: readonly EnvironmentVariableDefinition<unknown>[] =
  Object.freeze(
    ENVIRONMENT_VARIABLE_REGISTRY.filter(
      (entry) =>
        entry.group === "database-connection" || entry.group === "administration-credentials",
    ),
  );

/**
 * Entries consumed by the local migration parser.
 *
 * Migration tooling needs the shared connection settings plus the
 * dedicated migration credentials. It never receives the runtime
 * application credentials or the bootstrap administrator credentials,
 * so a migration command cannot be pointed at either of them by
 * accident.
 */
export const MIGRATION_PARSER_VARIABLES: readonly EnvironmentVariableDefinition<unknown>[] =
  Object.freeze(
    ENVIRONMENT_VARIABLE_REGISTRY.filter(
      (entry) => entry.group === "database-connection" || entry.group === "migration-credentials",
    ),
  );

const REGISTRY_BY_VARIABLE: Readonly<Record<string, EnvironmentVariableDefinition<unknown>>> =
  Object.freeze(
    Object.fromEntries(ENVIRONMENT_VARIABLE_REGISTRY.map((entry) => [entry.variable, entry])),
  );

/** Look up a definition by variable name, or undefined when unregistered. */
export function findEnvironmentVariable(
  variable: string,
): EnvironmentVariableDefinition<unknown> | undefined {
  return REGISTRY_BY_VARIABLE[variable];
}

/** True when the name is a centrally registered platform variable. */
export function isRegisteredEnvironmentVariable(variable: string): boolean {
  return Object.hasOwn(REGISTRY_BY_VARIABLE, variable);
}

/** True when the name belongs to this platform but is not registered. */
export function isUnregisteredPlatformVariable(variable: string): boolean {
  return (
    variable.startsWith(ENVIRONMENT_VARIABLE_PREFIX) && !isRegisteredEnvironmentVariable(variable)
  );
}
