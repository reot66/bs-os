/**
 * The Business OS structured logger.
 *
 * Pino is used as the internal engine, but the raw Pino instance is never
 * exposed: callers cannot disable redaction, change the destination, or
 * reach an unfiltered serializer. Callers can only emit records and create
 * child loggers with validated context.
 */

import { LOG_LEVELS } from "@business-os/configuration";
import { getErrorCatalogEntry, isBusinessOsError, toPublicError } from "@business-os/errors";
import pino from "pino";
import type { Logger as PinoLogger } from "pino";

import { normalizeContext, validateContextValue } from "./context.js";
import type { LogContext } from "./context.js";
import { REDACTED_VALUE, sanitizeLogMetadata } from "./redaction.js";

/** Log levels, taken from the shared configuration package. */
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Minimal writable sink, used for deterministic tests. */
export interface LogDestination {
  write(chunk: string): void;
}

/** Untrusted, caller-supplied structured metadata. */
export type LogMetadata = Readonly<Record<string, unknown>>;

export interface LoggerOptions {
  /** Owning service identifier. Required. */
  readonly service: string;
  /** Minimum level to emit. Required; never defaulted silently. */
  readonly level: LogLevel;
  /** Optional safe static context, typically `module`. */
  readonly context?: LogContext;
  /** Optional explicit sink. Defaults to stdout. */
  readonly destination?: LogDestination | undefined;
}

/** Safe, approved summary of any thrown value. */
export interface SafeErrorSummary {
  readonly code: string;
  readonly category: string;
  readonly retryable: boolean;
  readonly message: string;
}

/**
 * Top-level fields a caller may never inject through metadata.
 *
 * Caller metadata is nested under `context`, so overriding these is
 * impossible by construction; the list is exported for documentation and
 * for tests that assert the guarantee.
 */
export const RESERVED_LOG_FIELDS: readonly string[] = Object.freeze([
  "level",
  "time",
  "msg",
  "service",
  "module",
  "correlationId",
  "requestId",
  "err",
  "error",
  "context",
  "pid",
  "hostname",
]);

/**
 * Additional defense for predictable top-level paths.
 *
 * These are static literals, never constructed from caller input. The
 * primary boundary for arbitrary metadata is the structured sanitizer.
 */
const PINO_REDACT_PATHS: readonly string[] = Object.freeze([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apiKey",
  "clientSecret",
  "privateKey",
  "error.cause",
  "error.stack",
  "error.internalMessage",
  "error.context",
]);

/** The public logging interface exposed to business modules. */
export interface BusinessOsLogger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  /** Create an independent child logger with validated context. */
  child(context: LogContext): BusinessOsLogger;
  /** Log an unexpected error using the shared error contracts. */
  logError(error: unknown, message: string, metadata?: LogMetadata): void;
  /** Current level of this logger. */
  readonly level: LogLevel;
}

function assertLogLevel(value: unknown): LogLevel {
  if (typeof value !== "string" || !(LOG_LEVELS as readonly string[]).includes(value)) {
    throw new TypeError("Logger level must be one of the supported log levels");
  }

  return value as LogLevel;
}

/**
 * Convert any thrown value into a safe summary.
 *
 * The conversion boundary is the shared errors package, which uses the
 * genuine-error identity guard from FND-009-FIX2. Causes, stacks, internal
 * diagnostic messages, and private context are never included, and an
 * untrusted value can never select its own error code.
 */
export function toSafeErrorSummary(error: unknown): SafeErrorSummary {
  const publicError = toPublicError(error);
  const entry = getErrorCatalogEntry(publicError.code);

  return Object.freeze({
    code: publicError.code,
    category: entry.category,
    retryable: publicError.retryable,
    message: publicError.message,
  });
}

function createPino(options: {
  level: LogLevel;
  base: Record<string, string>;
  destination?: LogDestination | undefined;
}): PinoLogger {
  const config = {
    level: options.level,
    // Replaces pino's default base so records carry only our trusted
    // fields; process identity is deliberately not logged.
    base: options.base,
    // Epoch milliseconds, matching the documented record format.
    timestamp: (): string => `,"time":${Date.now()}`,
    redact: { paths: [...PINO_REDACT_PATHS], censor: REDACTED_VALUE },
  };

  return options.destination === undefined
    ? pino(config)
    : pino(config, options.destination as never);
}

function assertMessage(message: unknown): string {
  if (typeof message !== "string") {
    // A programmer error. Objects are never stringified into a message,
    // because that would bypass redaction entirely.
    throw new TypeError("Log message must be a string");
  }

  return message;
}

function buildRecord(
  metadata: LogMetadata | undefined,
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const parts: Record<string, unknown> = {};

  if (metadata !== undefined) {
    const sanitized = sanitizeLogMetadata(metadata);

    if (sanitized !== undefined) {
      parts.context = sanitized;
    }
  }

  if (extra !== undefined) {
    Object.assign(parts, extra);
  }

  return Object.keys(parts).length === 0 ? undefined : parts;
}

function buildLogger(
  level: LogLevel,
  base: Record<string, string>,
  destination: LogDestination | undefined,
): BusinessOsLogger {
  const instance = createPino({ level, base, destination });

  const emit = (
    method: "debug" | "info" | "warn" | "error",
    message: string,
    metadata: LogMetadata | undefined,
    extra: Record<string, unknown> | undefined,
  ): void => {
    // Skip sanitization entirely when the record would be discarded.
    if (instance.isLevelEnabled(method) === false) {
      return;
    }

    const record = buildRecord(metadata, extra);
    const text = assertMessage(message);

    if (record === undefined) {
      instance[method](text);
      return;
    }

    instance[method](record, text);
  };

  const logger: BusinessOsLogger = {
    level,

    debug(message, metadata) {
      emit("debug", message, metadata, undefined);
    },

    info(message, metadata) {
      emit("info", message, metadata, undefined);
    },

    warn(message, metadata) {
      emit("warn", message, metadata, undefined);
    },

    error(message, metadata) {
      emit("error", message, metadata, undefined);
    },

    child(context: LogContext): BusinessOsLogger {
      const normalized = normalizeContext(context);
      const bindings: Record<string, string> = {};

      for (const key of Object.keys(normalized)) {
        const value = (normalized as Record<string, string | undefined>)[key];

        if (value !== undefined && key !== "service") {
          bindings[key] = value;
        }
      }

      return buildLogger(level, { ...base, ...bindings }, destination);
    },

    logError(error: unknown, message: string, metadata?: LogMetadata): void {
      // The genuine-identity guard is exercised inside the errors package.
      // It is referenced here so the security boundary is explicit.
      const genuine = isBusinessOsError(error);

      // Deliberately NOT under pino's reserved `err` key: pino would run
      // its standard error serializer over it, which mutates the value.
      // The summary is already a safe, frozen public projection.
      emit("error", message, metadata, {
        error: toSafeErrorSummary(error),
        genuineError: genuine,
      });
    },
  };

  return Object.freeze(logger);
}

/**
 * Create a structured logger.
 *
 * Configuration is explicit: nothing is read from `.env`, `Bun.env`, or
 * `process.env`, and no global logger is created at import time.
 */
export function createLogger(options: LoggerOptions): BusinessOsLogger {
  if (options === undefined || options === null || typeof options !== "object") {
    throw new TypeError("Logger options must be an object");
  }

  const level = assertLogLevel(options.level);
  const context = normalizeContext(options.context);
  // The service identifier goes through the same validation as any other
  // trusted field, so whitespace or unsupported characters are rejected.
  const service = validateContextValue("service", context.service ?? options.service);

  const base: Record<string, string> = { service };

  if (context.module !== undefined) {
    base.module = context.module;
  }

  if (context.correlationId !== undefined) {
    base.correlationId = context.correlationId;
  }

  if (context.requestId !== undefined) {
    base.requestId = context.requestId;
  }

  return buildLogger(level, base, options.destination);
}
