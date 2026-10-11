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
 * The only context fields that may be promoted to trusted log fields.
 *
 * The list is closed on purpose: any other key is ignored, so a caller
 * cannot place an arbitrary value — including a secret — into a trusted
 * field.
 */
const TRUSTED_CONTEXT_FIELDS = Object.freeze([
  "service",
  "module",
  "correlationId",
  "requestId",
] as const);

/**
 * Validate context and return only the recognized fields.
 *
 * Recognized fields are read through property descriptors, so an accessor
 * defined for `service`, `module`, `correlationId`, or `requestId` is never
 * invoked and its value is never adopted. Accessor-backed trusted fields are
 * rejected with a generic `TypeError` that carries no input value.
 *
 * Unknown keys are ignored, and no property of an unrecognized key is read.
 */
export function normalizeContext(context: LogContext | undefined): LogContext {
  if (context === undefined || context === null) {
    return {};
  }

  if (typeof context !== "object") {
    throw new TypeError("Log context must be an object");
  }

  let isArray: boolean;
  let descriptors: PropertyDescriptorMap;

  try {
    isArray = Array.isArray(context);
    descriptors = Object.getOwnPropertyDescriptors(context);
  } catch {
    // A hostile or revoked object. Its contents and any underlying
    // exception message are deliberately not surfaced.
    throw new TypeError("Log context could not be inspected safely");
  }

  if (isArray) {
    throw new TypeError("Log context must be an object");
  }

  const normalized: Record<string, string> = {};

  for (const key of TRUSTED_CONTEXT_FIELDS) {
    const descriptor = descriptors[key];

    if (descriptor === undefined) {
      continue;
    }

    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new TypeError(`Log context field ${key} must be a plain value`);
    }

    if (descriptor.enumerable !== true) {
      continue;
    }

    const value = descriptor.value;

    if (value === undefined) {
      continue;
    }

    if (typeof value !== "string") {
      throw new TypeError(`Log context field ${key} must be a string`);
    }

    normalized[key] = assertSafeValue(value, key);
  }

  return Object.freeze(normalized) as LogContext;
}

/** True when a context key is one of the trusted, promoted fields. */
export function isTrustedContextKey(key: string): boolean {
  return (TRUSTED_CONTEXT_FIELDS as readonly string[]).includes(key);
}
