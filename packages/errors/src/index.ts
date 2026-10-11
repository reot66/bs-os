/**
 * `@business-os/errors` — the shared error foundation for Business OS.
 *
 * One catalog of stable codes, one canonical error class, and a strictly
 * separated public representation. The package has no third-party
 * dependencies, no transport coupling, no logging, and no global state,
 * and it imports nothing from other Business OS packages.
 *
 * Existing packages keep their own error classes until a separately
 * approved migration task adapts them onto this foundation.
 */

export {
  ERROR_CATALOG,
  ERROR_CATEGORIES,
  ERROR_CODES,
  getErrorCatalogEntry,
  isErrorCode,
} from "./error-catalog.js";

export type { ErrorCatalogEntry, ErrorCategory, ErrorCode } from "./error-catalog.js";

export { BusinessOsError } from "./platform-error.js";

export type { BusinessOsErrorOptions } from "./platform-error.js";

export { isBusinessOsError, normalizeUnknownError, toPublicError } from "./public-error.js";

export type { PublicError } from "./public-error.js";
