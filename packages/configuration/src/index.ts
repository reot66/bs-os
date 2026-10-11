/**
 * Business OS runtime bootstrap configuration.
 *
 * This package validates infrastructure environment settings supplied
 * by the calling application.
 *
 * It does not implement:
 * - tenant or business configuration
 * - feature flags
 * - entitlements
 * - secret management
 * - environment file loading
 *
 * `environment-registry.ts` is the single source of truth for every
 * supported environment variable. The bootstrap parser below keeps its
 * original public contract and reuses the canonical value lists from
 * that registry, so no enum is defined twice.
 */

import { DEFAULT_LOG_LEVEL, LOG_LEVELS, RUNTIME_ENVIRONMENTS } from "./environment-registry.js";
import type { LogLevel, RuntimeEnvironment } from "./environment-registry.js";

export {
  DATABASE_CONNECTION_VARIABLES,
  DEFAULT_LOG_LEVEL,
  ENVIRONMENT_VARIABLE_CATEGORIES,
  ENVIRONMENT_VARIABLE_GROUPS,
  ENVIRONMENT_VARIABLE_OWNERS,
  ENVIRONMENT_VARIABLE_PREFIX,
  ENVIRONMENT_VARIABLE_REGISTRY,
  ENVIRONMENT_VARIABLE_SCOPES,
  LOCAL_ADMIN_ENVIRONMENT_VARIABLES,
  LOCAL_ADMIN_ENVIRONMENT_VARIABLE_NAMES,
  LOCAL_ADMIN_PARSER_VARIABLES,
  LOG_LEVELS,
  REDACTED_VALUE,
  REGISTERED_ENVIRONMENT_VARIABLES,
  RUNTIME_ENVIRONMENTS,
  RUNTIME_ENVIRONMENT_VARIABLES,
  RUNTIME_ENVIRONMENT_VARIABLE_NAMES,
  RUNTIME_PARSER_VARIABLES,
  SECRET_PLACEHOLDER_PREFIX,
  SENSITIVE_ENVIRONMENT_VARIABLES,
  findEnvironmentVariable,
  isRegisteredEnvironmentVariable,
  isUnregisteredPlatformVariable,
} from "./environment-registry.js";

export type {
  EnvironmentVariableCategory,
  EnvironmentVariableDefinition,
  EnvironmentVariableGroup,
  EnvironmentVariableOwner,
  EnvironmentVariableScope,
  LogLevel,
  RuntimeEnvironment,
} from "./environment-registry.js";

export {
  ENVIRONMENT_ERROR_CODES,
  EnvironmentConfigError,
  areAllPlatformVariablesRegistered,
  findUnregisteredPlatformVariables,
  parseLocalAdminEnvironment,
  parseRuntimeEnvironment,
  summarizeEnvironmentConfig,
} from "./environment.js";

export type {
  EnvironmentErrorCode,
  EnvironmentSource,
  EnvironmentSummary,
  LocalAdminDatabaseSettings,
  LocalAdminEnvironmentConfig,
  RuntimeDatabaseSettings,
  RuntimeEnvironmentConfig,
} from "./environment.js";

export type BootstrapConfigKey = "BUSINESS_OS_ENV" | "BUSINESS_OS_LOG_LEVEL";

export type BootstrapConfigErrorCode = "MISSING_REQUIRED_VALUE" | "INVALID_VALUE";

export interface BootstrapConfig {
  readonly environment: RuntimeEnvironment;
  readonly logLevel: LogLevel;
}

export type BootstrapEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Structured error that never includes the rejected
 * configuration value.
 */
export class BootstrapConfigError extends Error {
  readonly code: BootstrapConfigErrorCode;
  readonly key: BootstrapConfigKey;

  constructor(code: BootstrapConfigErrorCode, key: BootstrapConfigKey) {
    super(`Bootstrap configuration error: ${key} (${code})`);

    this.name = "BootstrapConfigError";
    this.code = code;
    this.key = key;
  }
}

function isAllowedValue<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.some((candidate) => candidate === value);
}

/**
 * Parse explicitly supplied bootstrap environment values.
 *
 * No global environment is read by this function.
 *
 * BUSINESS_OS_ENV is mandatory.
 * BUSINESS_OS_LOG_LEVEL defaults to "info".
 *
 * Unrelated process environment keys are ignored because
 * they are not owned by this bootstrap parser. Undeclared
 * BUSINESS_OS_ keys are rejected by the registry-aware
 * environment parsers instead.
 */
export function parseBootstrapConfig(source: BootstrapEnvironment): Readonly<BootstrapConfig> {
  // Preserve the original contract: this bootstrap parser ignores
  // unregistered platform keys rather than rejecting them, because
  // callers may legitimately supply variables owned elsewhere.
  // Registry-aware rejection lives in the environment parsers.
  const environmentValue = source.BUSINESS_OS_ENV;

  if (environmentValue === undefined || environmentValue === "") {
    throw new BootstrapConfigError("MISSING_REQUIRED_VALUE", "BUSINESS_OS_ENV");
  }

  if (!isAllowedValue(environmentValue, RUNTIME_ENVIRONMENTS)) {
    throw new BootstrapConfigError("INVALID_VALUE", "BUSINESS_OS_ENV");
  }

  const logLevelValue = source.BUSINESS_OS_LOG_LEVEL ?? DEFAULT_LOG_LEVEL;

  if (!isAllowedValue(logLevelValue, LOG_LEVELS)) {
    throw new BootstrapConfigError("INVALID_VALUE", "BUSINESS_OS_LOG_LEVEL");
  }

  return Object.freeze({
    environment: environmentValue,
    logLevel: logLevelValue,
  });
}
