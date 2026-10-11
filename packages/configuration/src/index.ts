/**
 * Business OS runtime bootstrap configuration.
 *
 * This package validates infrastructure environment
 * settings supplied by the calling application.
 *
 * It does not implement:
 * - tenant or business configuration
 * - feature flags
 * - entitlements
 * - secret management
 * - environment file loading
 */

export const RUNTIME_ENVIRONMENTS = ["local", "test", "staging", "production"] as const;

export type RuntimeEnvironment = (typeof RUNTIME_ENVIRONMENTS)[number];

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

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
 * they are not owned by this bootstrap parser.
 *
 * Dynamic business configuration will use a separate
 * typed registry in a future task.
 */
export function parseBootstrapConfig(source: BootstrapEnvironment): Readonly<BootstrapConfig> {
  const environmentValue = source.BUSINESS_OS_ENV;

  if (environmentValue === undefined || environmentValue === "") {
    throw new BootstrapConfigError("MISSING_REQUIRED_VALUE", "BUSINESS_OS_ENV");
  }

  if (!isAllowedValue(environmentValue, RUNTIME_ENVIRONMENTS)) {
    throw new BootstrapConfigError("INVALID_VALUE", "BUSINESS_OS_ENV");
  }

  const logLevelValue = source.BUSINESS_OS_LOG_LEVEL ?? "info";

  if (!isAllowedValue(logLevelValue, LOG_LEVELS)) {
    throw new BootstrapConfigError("INVALID_VALUE", "BUSINESS_OS_LOG_LEVEL");
  }

  return Object.freeze({
    environment: environmentValue,
    logLevel: logLevelValue,
  });
}
