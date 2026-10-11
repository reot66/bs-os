/**
 * The canonical shared application error for Business OS.
 *
 * A `BusinessOsError` carries a stable catalog-backed classification
 * and a safe public message. Anything diagnostic — an internal message,
 * an original cause, private context — is kept strictly out of the
 * public surface.
 *
 * The class uses only standard JavaScript Error capabilities, so it
 * carries no runtime-specific behaviour.
 */

import { ERROR_CATALOG } from "./error-catalog.js";
import type { ErrorCatalogEntry, ErrorCategory, ErrorCode } from "./error-catalog.js";
import type { PublicError } from "./public-error.js";

/** Options accepted when constructing a platform error. */
export interface BusinessOsErrorOptions {
  /**
   * Internal-only diagnostic text.
   *
   * It is never returned publicly and is not enumerable, so it cannot
   * leak through `JSON.stringify`, object spread, or `Object.keys`.
   * It is still readable by trusted diagnostic code.
   */
  readonly internalMessage?: string;
  /**
   * The original thrown value.
   *
   * Typed as `unknown` because not every thrown value is an `Error`.
   * The cause is never stringified eagerly and never exposed publicly.
   */
  readonly cause?: unknown;
  /**
   * Private diagnostic context for trusted internal tooling.
   *
   * Not redacted and not safe to log as-is; see the ADR for why.
   * Stored non-enumerably so it cannot reach a public payload.
   */
  readonly context?: Readonly<Record<string, unknown>>;
}

/** Attach a value as a non-enumerable own property. */
function defineHidden(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: false,
    writable: false,
    configurable: false,
  });
}

export class BusinessOsError extends Error {
  /** Stable platform error code. */
  readonly code: ErrorCode;
  /** Classification derived from the catalog. */
  readonly category: ErrorCategory;
  /** Retryability derived from the catalog. Advisory only. */
  readonly retryable: boolean;
  /** Generic, non-sensitive message safe to return to a client. */
  readonly publicMessage: string;

  constructor(code: ErrorCode, options: BusinessOsErrorOptions = {}) {
    const entry: ErrorCatalogEntry = ERROR_CATALOG[code];

    if (entry === undefined) {
      // Fail fast on an unknown code instead of building an error whose
      // classification cannot be resolved. The thrown value carries no
      // user input, so the message stays safe.
      throw new TypeError("Unknown Business OS error code");
    }

    super(entry.publicMessage);

    this.name = "BusinessOsError";
    this.code = code;
    this.category = entry.category;
    this.retryable = entry.retryable;
    this.publicMessage = entry.publicMessage;

    if (options.cause !== undefined) {
      // Preserve native cause behaviour, including for non-Error values.
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        writable: true,
        configurable: true,
      });
    }

    if (options.internalMessage !== undefined) {
      defineHidden(this, "internalMessage", options.internalMessage);
    }

    if (options.context !== undefined) {
      defineHidden(this, "context", options.context);
    }
  }

  /**
   * Serialize to exactly the approved public shape.
   *
   * Without this, class properties, a native `cause`, or a stack trace
   * could leak into a serialized payload.
   */
  toJSON(): Readonly<PublicError> {
    return Object.freeze({
      code: this.code,
      message: this.publicMessage,
      retryable: this.retryable,
    });
  }
}
