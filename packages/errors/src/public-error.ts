/**
 * Safe public conversion and normalization for platform errors.
 *
 * The public representation is deliberately minimal: a stable code, a
 * generic message, and retryability. Internal causes, internal
 * messages, private context, and stack traces never appear in it.
 *
 * Untrusted values are never trusted. A plain object that carries a
 * `code` property is not a platform error, and no property of an
 * untrusted value is read during normalization.
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

/**
 * Recognize a genuine platform error.
 *
 * This is an identity check, not duck typing. A plain object that
 * merely looks like a platform error is rejected, so an untrusted
 * payload can never acquire trusted classification.
 */
export function isBusinessOsError(value: unknown): value is BusinessOsError {
  return value instanceof BusinessOsError;
}

/**
 * Convert any thrown value into a platform error.
 *
 * An existing `BusinessOsError` keeps its identity. Anything else is
 * wrapped as `INTERNAL_ERROR` with the original value preserved only as
 * an internal cause. No property of the input is read, so a hostile
 * getter is never invoked and no untrusted string becomes a message.
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
 */
export function toPublicError(error: unknown): Readonly<PublicError> {
  const normalized = normalizeUnknownError(error);
  const entry = ERROR_CATALOG[normalized.code];

  return Object.freeze({
    code: normalized.code,
    message: entry.publicMessage,
    retryable: entry.retryable,
  });
}
