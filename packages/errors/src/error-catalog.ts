/**
 * Central error-code catalog for Business OS.
 *
 * This module is the single source of truth for platform error codes.
 * There is exactly one definition per code, and no other module may
 * duplicate the list, its classifications, or its public messages.
 *
 * The catalog is deliberately transport-independent. It carries no HTTP
 * status codes, because mapping an error onto a transport belongs to a
 * future API adapter rather than to the shared foundation.
 */

/** Stable, typed error categories. */
export const ERROR_CATEGORIES = Object.freeze([
  "validation",
  "authentication",
  "authorization",
  "domain",
  "infrastructure",
  "internal",
] as const);

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/** One catalog entry. Every field is safe to inspect and serialize. */
export interface ErrorCatalogEntry {
  /** Stable classification used by callers and adapters. */
  readonly category: ErrorCategory;
  /**
   * Generic, non-sensitive text safe to return to an untrusted client.
   * It never contains SQL, connection strings, credentials, stack
   * traces, file paths, driver messages, or private user information.
   */
  readonly publicMessage: string;
  /**
   * Whether retrying the same operation may be appropriate.
   *
   * This is advisory metadata only. It never triggers a retry by
   * itself: whether a retry is safe depends on idempotency, transaction
   * state, rate limits, and caller policy.
   */
  readonly retryable: boolean;
}

const CATALOG_DEFINITIONS = {
  VALIDATION_ERROR: {
    category: "validation",
    publicMessage: "The request is invalid.",
    retryable: false,
  },
  UNAUTHENTICATED: {
    category: "authentication",
    publicMessage: "Authentication is required.",
    retryable: false,
  },
  FORBIDDEN: {
    category: "authorization",
    publicMessage: "You do not have permission to perform this action.",
    retryable: false,
  },
  NOT_FOUND: {
    category: "authorization",
    publicMessage: "The requested resource was not found.",
    retryable: false,
  },
  CONFLICT: {
    category: "domain",
    publicMessage: "The operation conflicts with the current state.",
    retryable: false,
  },
  PRECONDITION_FAILED: {
    category: "domain",
    publicMessage: "The operation's requirements were not met.",
    retryable: false,
  },
  BUSINESS_RULE_VIOLATION: {
    category: "domain",
    publicMessage: "The operation cannot be completed.",
    retryable: false,
  },
  RATE_LIMITED: {
    category: "infrastructure",
    publicMessage: "Too many requests. Please try again later.",
    retryable: true,
  },
  DEPENDENCY_UNAVAILABLE: {
    category: "infrastructure",
    publicMessage: "The service is temporarily unavailable.",
    retryable: true,
  },
  OPERATION_TIMEOUT: {
    category: "infrastructure",
    publicMessage: "The operation timed out.",
    retryable: true,
  },
  INTERNAL_ERROR: {
    category: "internal",
    publicMessage: "An unexpected error occurred.",
    retryable: false,
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

/** Every supported platform error code. */
export type ErrorCode = keyof typeof CATALOG_DEFINITIONS;

/**
 * Freeze one entry and the catalog as a whole, so neither the mapping
 * nor a nested entry can be mutated at runtime.
 */
function freezeCatalog(
  definitions: Record<string, ErrorCatalogEntry>,
): Readonly<Record<string, ErrorCatalogEntry>> {
  const frozen: Record<string, ErrorCatalogEntry> = {};

  for (const code of Object.keys(definitions)) {
    const entry = definitions[code];

    if (entry !== undefined) {
      frozen[code] = Object.freeze({
        category: entry.category,
        publicMessage: entry.publicMessage,
        retryable: entry.retryable,
      });
    }
  }

  return Object.freeze(frozen);
}

/** The immutable platform error catalog. */
export const ERROR_CATALOG: Readonly<Record<ErrorCode, ErrorCatalogEntry>> =
  freezeCatalog(CATALOG_DEFINITIONS);

/** Every registered error code, in catalog order. */
export const ERROR_CODES: readonly ErrorCode[] = Object.freeze(
  Object.keys(CATALOG_DEFINITIONS) as ErrorCode[],
);

/** Look up a catalog entry. */
export function getErrorCatalogEntry(code: ErrorCode): ErrorCatalogEntry {
  return ERROR_CATALOG[code];
}

/**
 * Narrow an untrusted string to a registered error code.
 *
 * Used to reject values rather than to trust them: an arbitrary string
 * is never treated as a platform code simply because it looks like one.
 */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.hasOwn(ERROR_CATALOG, value);
}
