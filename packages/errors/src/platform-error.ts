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
 * Genuine identity is proven by a module-private `WeakSet` that only the
 * constructor can populate. That is deliberately chosen over a private
 * field brand: per the language specification a `PrivateIdentifier in`
 * check consults a proxy's `has` trap, so a prototype-based brand can be
 * satisfied by a crafted proxy on some engines. Weak-set membership is an
 * internal identity test that no proxy trap can intercept.
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

/**
 * Module-private registry of genuine platform errors.
 *
 * This is intentionally never exported: exposing it would let any caller
 * register an arbitrary object as a trusted platform error. Only the
 * constructor below can add to it, and only after the error code has been
 * validated against the catalog.
 *
 * `WeakSet.has` is an internal identity test. Unlike a prototype chain
 * walk or a `PrivateIdentifier in` check, it cannot be influenced by any
 * proxy trap, so a forged prototype, a lying `has` trap, or a revoked
 * proxy can never satisfy it.
 */
const GENUINE_ERRORS = new WeakSet<BusinessOsError>();

export class BusinessOsError extends Error {
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

    // Register only after the code has been validated, so an object that
    // exists is always a fully constructed, catalog-backed error.
    GENUINE_ERRORS.add(this);
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
   * Membership of `GENUINE_ERRORS` is an internal identity test, so no
   * proxy trap can be reached and no public property is read: a `has`,
   * `get`, or `getPrototypeOf` trap is never invoked, and a fabricated
   * prototype is irrelevant. The set is module-private and is populated
   * only by the constructor, so there is no way to register an arbitrary
   * object as genuine.
   *
   * The `try`/`catch` is defensive only. A revoked proxy is already
   * rejected without error, but it guarantees that no exotic value can
   * make this security boundary throw.
   */
  static hasBrand(value: unknown): value is BusinessOsError {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
      return false;
    }

    try {
      return GENUINE_ERRORS.has(value as BusinessOsError);
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
