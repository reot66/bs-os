/**
 * The canonical shared application error for Business OS.
 *
 * A `BusinessOsError` carries a stable catalog-backed classification
 * and a safe public message. Anything diagnostic — an internal message,
 * an original cause, private context — is kept strictly out of the
 * public surface.
 *
 * Security-critical classification is immutable and is derived from the
 * immutable catalog on every read, so a caller cannot swap `code`,
 * `category`, `retryable`, or `publicMessage` and have that change what
 * the error discloses.
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
  /**
   * Private brand.
   *
   * It is reachable only from inside this class body, so an object
   * produced by `Object.create(BusinessOsError.prototype)` — which has
   * the prototype but not this field — is not a genuine platform error.
   */
  readonly #brand = true;

  /**
   * The error code, held privately so it cannot be reassigned.
   *
   * Every classification below is derived from the catalog using this
   * value, never from a mutable public field.
   */
  readonly #code: ErrorCode;

  constructor(code: ErrorCode, options: BusinessOsErrorOptions = {}) {
    const entry: ErrorCatalogEntry = ERROR_CATALOG[code];

    if (entry === undefined) {
      // Fail fast on an unknown code instead of building an error whose
      // classification cannot be resolved. The thrown value carries no
      // user input, so the message stays safe.
      throw new TypeError("Unknown Business OS error code");
    }

    super(entry.publicMessage);

    this.#code = code;
    this.name = "BusinessOsError";

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

  /** Stable platform error code. Read-only. */
  get code(): ErrorCode {
    return this.#code;
  }

  /** Classification derived from the catalog. Read-only. */
  get category(): ErrorCategory {
    return ERROR_CATALOG[this.#code].category;
  }

  /** Retryability derived from the catalog. Read-only and advisory. */
  get retryable(): boolean {
    return ERROR_CATALOG[this.#code].retryable;
  }

  /**
   * Generic, non-sensitive message safe to return to a client.
   *
   * Read from the immutable catalog on every access, so replacing this
   * property is impossible and cannot change what is disclosed.
   */
  get publicMessage(): string {
    return ERROR_CATALOG[this.#code].publicMessage;
  }

  /**
   * Recognize a genuine platform error.
   *
   * A private-field presence check cannot be spoofed by setting a
   * property, and it does not read any public property. The `in`
   * operator does not invoke getters, but it can still reach a proxy
   * `has` trap, so a hostile or revoked proxy is contained here and
   * reported as "not a platform error" rather than being allowed to
   * throw during normalization.
   */
  static hasBrand(value: unknown): value is BusinessOsError {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
      return false;
    }

    try {
      return #brand in (value as object);
    } catch {
      return false;
    }
  }

  /**
   * Serialize to exactly the approved public shape.
   *
   * Built from the catalog rather than from a stored public field, so
   * tampering with any instance property cannot change the output.
   */
  toJSON(): Readonly<PublicError> {
    const entry = ERROR_CATALOG[this.#code];

    return Object.freeze({
      code: this.#code,
      message: entry.publicMessage,
      retryable: entry.retryable,
    });
  }
}
