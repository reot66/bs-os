/**
 * Typed, validated logging context.
 *
 * Context is deliberately a small closed set of trusted fields rather
 * than an open bag of caller-supplied keys. Only `service`, `module`,
 * `correlationId`, and `requestId` are promoted to trusted top-level log
 * fields. Any other key is ignored, so a caller can never place an
 * arbitrary value — including a secret — into a trusted field.
 *
 * Correlation identifiers are supplied by the request boundary or job
 * coordinator. This module never generates them.
 */

/** Trusted context fields promoted to top-level log fields. */
export interface LogContext {
  /** Owning service, for example `business-os-api`. */
  readonly service?: string;
  /** Owning module, for example `catalog`. */
  readonly module?: string;
  /** Opaque identifier correlating related log records. */
  readonly correlationId?: string;
  /** Opaque identifier for the originating request. */
  readonly requestId?: string;
}

/** Maximum accepted length for a developer-authored service or module name. */
export const MAX_CONTEXT_VALUE_LENGTH = 128;

/** Maximum accepted length for an opaque correlation or request identifier. */
export const MAX_IDENTIFIER_LENGTH = 64;

/**
 * Accepted character set for developer-authored names.
 *
 * Service and module names are written by developers, so dashes, dots and
 * underscores are permitted.
 */
const SAFE_NAME_PATTERN = /^[A-Za-z0-9._:-]+$/;

/**
 * Accepted character set for opaque correlation and request identifiers.
 *
 * Deliberately narrower: letters, digits and hyphens only. Every identifier
 * format this platform uses (UUID, ULID, hex trace ID, short request ID)
 * fits, while separators such as underscore allow password-shaped strings to
 * be smuggled into a trusted field. This is the structural reason the
 * identifier alphabet is stricter than the name alphabet.
 */
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9-]+$/;

/** Fields that carry opaque runtime identifiers rather than authored names. */
const IDENTIFIER_FIELDS: readonly string[] = Object.freeze(["correlationId", "requestId"]);

function assertSafeValue(value: string, key: keyof LogContext): string {
  if (typeof value !== "string" || value === "") {
    throw new TypeError(`Log context field ${String(key)} must be a non-empty string`);
  }

  const isIdentifier = IDENTIFIER_FIELDS.includes(key);
  const limit = isIdentifier ? MAX_IDENTIFIER_LENGTH : MAX_CONTEXT_VALUE_LENGTH;

  if (value.length > limit) {
    throw new TypeError(`Log context field ${String(key)} exceeds the maximum length of ${limit}`);
  }

  const pattern = isIdentifier ? SAFE_IDENTIFIER_PATTERN : SAFE_NAME_PATTERN;

  if (!pattern.test(value)) {
    throw new TypeError(`Log context field ${String(key)} contains unsupported characters`);
  }

  return value;
}

/** Validate a single trusted context field. */
export function validateContextValue(key: keyof LogContext, value: string): string {
  return assertSafeValue(value, key);
}

/**
 * Validate context and return only the recognized fields.
 *
 * Unknown keys are silently ignored so that stray metadata — including a
 * key such as `password` — can never become a trusted log field. This
 * function never reads a value the caller did not supply as a string.
 */
export function normalizeContext(context: LogContext | undefined): LogContext {
  if (context === undefined || context === null) {
    return {};
  }

  if (typeof context !== "object" || Array.isArray(context)) {
    throw new TypeError("Log context must be an object");
  }

  const normalized: Record<string, string> = {};

  for (const key of Object.keys(context)) {
    if (!["service", "module", "correlationId", "requestId"].includes(key)) {
      continue;
    }

    const value = (context as Record<string, unknown>)[key];

    if (value === undefined) {
      continue;
    }

    if (typeof value !== "string") {
      throw new TypeError(`Log context field ${key} must be a string`);
    }

    normalized[key] = assertSafeValue(value, key as keyof LogContext);
  }

  return Object.freeze(normalized) as LogContext;
}

/** True when a context key is one of the trusted, promoted fields. */
export function isTrustedContextKey(key: string): boolean {
  return key === "service" || key === "module" || key === "correlationId" || key === "requestId";
}
