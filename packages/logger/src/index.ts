/**
 * `@business-os/logger` — the shared structured-logging foundation.
 *
 * Pino is the internal engine and is never exposed. The public surface is
 * a small interface that emits structured JSON, carries validated
 * context, applies centralized redaction, and summarizes errors through
 * the shared error contracts.
 *
 * The logger depends on `@business-os/configuration` and
 * `@business-os/errors`; neither depends on the logger.
 */

export {
  REDACTION_LIMITS,
  REDACTED_VALUE,
  TRUNCATED_MARKER,
  UNSAFE_VALUE,
  isRegisteredSecretKey,
  isSensitiveKey,
  sanitizeLogMetadata,
} from "./redaction.js";

export {
  MAX_CONTEXT_VALUE_LENGTH,
  MAX_IDENTIFIER_LENGTH,
  isTrustedContextKey,
  normalizeContext,
  validateContextValue,
} from "./context.js";

export type { LogContext } from "./context.js";

export {
  RESERVED_LOG_FIELDS,
  createLogger,
  toSafeErrorSummary,
} from "./logger.js";

export type {
  BusinessOsLogger,
  LogDestination,
  LogLevel,
  LogMetadata,
  LoggerOptions,
  SafeErrorSummary,
} from "./logger.js";
