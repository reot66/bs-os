/**
 * Safe public conversion and normalization for platform errors.
 *
 * The public representation is deliberately minimal: a stable code, a
 * generic message, and retryability. Internal causes, internal
 * messages, private context, and stack traces never appear in it.
 *
 * Untrusted values are never trusted. A plain object that merely carries
 * a `code` property is not a platform error, and normalization reads no
 * public property of the input, so a hostile getter is never invoked.
 */

import { ERROR_CATALOG } from "./error-catalog.js";
import type { ErrorCode } from "./error-catalog.js";
import { BusinessOsError } from "./platform-error.js";

/** The only error information that may leave the process boundary. */
export interface PublicError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

/** Frozen fallback used whenever an input cannot be read safely. */
const INTERNAL_ERROR_PAYLOAD: Readonly<PublicError> = Object.freeze({
  code: "INTERNAL_ERROR",
  message: ERROR_CATALOG.INTERNAL_ERROR.publicMessage,
  retryable: ERROR_CATALOG.INTERNAL_ERROR.retryable,
});

/**
 * Recognize a genuine platform error.
 *
 * This is an identity check backed by a private brand, not duck typing.
 * A plain object that merely looks like a platform error is rejected,
 * and so is an object that merely carries the right prototype.
 */
export function isBusinessOsError(value: unknown): value is BusinessOsError {
  return BusinessOsError.hasBrand(value);
}

/**
 * Convert any thrown value into a platform error.
 *
 * An existing `BusinessOsError` keeps its identity. Anything else —
 * including a plain object, a forged prototype clone, a hostile proxy,
 * and a revoked proxy — is wrapped as `INTERNAL_ERROR` with the original
 * value preserved only as an internal cause.
 */
export function normalizeUnknownError(error: unknown): BusinessOsError {
  if (isBusinessOsError(error)) {
    return error;
  }

  return new BusinessOsError("INTERNAL_ERROR", { cause: error });
}

/**
 * Convert any thrown value into the approved public shape.
 *
 * The result contains exactly `code`, `message`, and `retryable`, and is
 * frozen. Internal diagnostics never appear.
 *
 * Reading the classification from an untrusted value can still fail if
 * that value is a proxy with a hostile accessor. Such a value is
 * reported as `INTERNAL_ERROR` rather than being allowed to throw, and
 * its contents are never inspected or disclosed.
 */
export function toPublicError(error: unknown): Readonly<PublicError> {
  const normalized = normalizeUnknownError(error);

  try {
    const code = normalized.code;
    const entry = ERROR_CATALOG[code];

    if (entry === undefined) {
      return INTERNAL_ERROR_PAYLOAD;
    }

    return Object.freeze({
      code,
      message: entry.publicMessage,
      retryable: entry.retryable,
    });
  } catch {
    // A hostile object that reached this point is not trusted with any
    // of its contents.
    return INTERNAL_ERROR_PAYLOAD;
  }
}
