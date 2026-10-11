/**
 * Centralized redaction for structured logging metadata.
 *
 * Sensitive-key recognition is derived from two sources:
 *
 *  1. The authoritative environment-variable registry exported by
 *     `@business-os/configuration`. Any variable that registry marks as
 *     sensitive is recognized automatically, so a new registered secret
 *     needs no change here.
 *  2. A generic set of credential-like key names, which protects common
 *     credential fields that are not environment variables at all.
 *
 * Known limitation, stated plainly: key-based redaction cannot detect a
 * secret that has been placed in an ordinary field with an innocuous
 * name, nor a secret embedded in a free-form log message string. This
 * module protects *keys*, not values.
 */

import { SENSITIVE_ENVIRONMENT_VARIABLES } from "@business-os/configuration";

/** Marker substituted for any value under a sensitive key. */
export const REDACTED_VALUE = "[REDACTED]";

/** Marker substituted for a structure that could not be inspected safely. */
export const UNSAFE_VALUE = "[UNSAFE]";

/** Marker appended when a bounded collection or string was truncated. */
export const TRUNCATED_MARKER = "[TRUNCATED]";

/**
 * Defensive limits applied while walking untrusted metadata.
 *
 * They bound the cost of logging an enormous or adversarial structure.
 */
export const REDACTION_LIMITS = Object.freeze({
  /** Maximum nesting depth walked before a placeholder is used. */
  maxDepth: 6,
  /** Maximum keys copied from a single object. */
  maxKeysPerObject: 50,
  /** Maximum elements copied from a single array. */
  maxArrayLength: 100,
  /** Maximum characters retained from a single string. */
  maxStringLength: 4096,
  /** Maximum total nodes visited for one sanitize call. */
  maxTotalNodes: 500,
});

/**
 * Generic credential-like key names, normalized.
 *
 * A key is sensitive when its normalized form matches one of these
 * exactly, or ends with one of them so that `userPassword` and
 * `db_password` are also recognized.
 */
const CREDENTIAL_KEY_TOKENS: readonly string[] = Object.freeze([
  "password",
  "passwd",
  "pwd",
  "passphrase",
  "secret",
  "clientsecret",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "idtoken",
  "bearer",
  "jwt",
  "authorization",
  "cookie",
  "setcookie",
  "apikey",
  "privatekey",
  "credential",
  "credentials",
]);

/** Reduce a key to a comparable form: lowercase, alphanumeric only. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Registered environment secrets, normalized.
 *
 * Derived once at module load from the central registry. The registry is
 * already frozen, so this cannot drift at runtime.
 */
const REGISTERED_SECRET_KEYS: readonly string[] = Object.freeze(
  SENSITIVE_ENVIRONMENT_VARIABLES.map(normalizeKey),
);

const NORMALIZED_CREDENTIAL_TOKENS: readonly string[] = Object.freeze(
  CREDENTIAL_KEY_TOKENS.map(normalizeKey),
);

/**
 * True when a field name should never have its value emitted.
 *
 * Registry-derived names are matched exactly; generic credential names are
 * matched exactly or as a suffix so compound names are covered.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);

  if (normalized === "") {
    return false;
  }

  if (REGISTERED_SECRET_KEYS.includes(normalized)) {
    return true;
  }

  return NORMALIZED_CREDENTIAL_TOKENS.some(
    (token) => normalized === token || normalized.endsWith(token),
  );
}

/** True when a key comes from the authoritative environment registry. */
export function isRegisteredSecretKey(key: string): boolean {
  return REGISTERED_SECRET_KEYS.includes(normalizeKey(key));
}

interface SanitizeState {
  readonly seen: WeakSet<object>;
  nodes: number;
}

function isPlainObject(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value) as object | null;
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function sanitizeString(value: string): string {
  if (value.length <= REDACTION_LIMITS.maxStringLength) {
    return value;
  }

  return value.slice(0, REDACTION_LIMITS.maxStringLength) + TRUNCATED_MARKER;
}

function sanitizeNumber(value: number): number | string {
  // NaN and Infinity are not valid JSON numbers.
  return Number.isFinite(value) ? value : UNSAFE_VALUE;
}

function sanitizeArray(value: unknown[], state: SanitizeState, depth: number): unknown {
  if (state.seen.has(value)) {
    return UNSAFE_VALUE;
  }

  state.seen.add(value);

  const limit = Math.min(value.length, REDACTION_LIMITS.maxArrayLength);
  const output: unknown[] = [];

  for (let index = 0; index < limit; index += 1) {
    output.push(sanitizeValue(value[index], state, depth + 1));
  }

  if (value.length > limit) {
    output.push(TRUNCATED_MARKER);
  }

  return output;
}

/**
 * Copy a plain object using property descriptors.
 *
 * Accessor properties are never invoked: a descriptor with `get` or `set`
 * is replaced by a placeholder. Symbol-keyed properties are never
 * enumerated. A proxy whose traps throw is contained by the caller's
 * try/catch and becomes a placeholder.
 */
function sanitizeObject(value: object, state: SanitizeState, depth: number): unknown {
  if (state.seen.has(value)) {
    return UNSAFE_VALUE;
  }

  state.seen.add(value);

  // Throws for a revoked proxy; the caller converts that to a placeholder.
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const output: Record<string, unknown> = {};

  let emitted = 0;

  for (const key of Object.keys(descriptors)) {
    if (emitted >= REDACTION_LIMITS.maxKeysPerObject) {
      output[TRUNCATED_MARKER] = true;
      break;
    }

    const descriptor = descriptors[key];

    if (descriptor === undefined) {
      continue;
    }

    // Accessors could run arbitrary code and could return a secret.
    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      output[key] = UNSAFE_VALUE;
      emitted += 1;
      continue;
    }

    if (descriptor.enumerable !== true) {
      continue;
    }

    emitted += 1;

    if (isSensitiveKey(key)) {
      output[key] = REDACTED_VALUE;
      continue;
    }

    output[key] = sanitizeValue(descriptor.value, state, depth + 1);
  }

  return output;
}

function sanitizeValue(value: unknown, state: SanitizeState, depth: number): unknown {
  state.nodes += 1;

  if (state.nodes > REDACTION_LIMITS.maxTotalNodes) {
    return UNSAFE_VALUE;
  }

  if (depth > REDACTION_LIMITS.maxDepth) {
    return UNSAFE_VALUE;
  }

  if (value === null || value === undefined) {
    return value;
  }

  switch (typeof value) {
    case "string":
      return sanitizeString(value);
    case "number":
      return sanitizeNumber(value);
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "symbol":
    case "function":
      // Never stringified: `toString` on these could run attacker code.
      return UNSAFE_VALUE;
    default:
      break;
  }

  try {
    if (Array.isArray(value)) {
      return sanitizeArray(value as unknown[], state, depth);
    }

    if (!isPlainObject(value as object)) {
      // Dates, regexps, maps, sets, errors and class instances are not
      // plain data. Converting them would invoke user-defined methods.
      return UNSAFE_VALUE;
    }

    return sanitizeObject(value as object, state, depth);
  } catch {
    // A hostile or revoked proxy reached here. Its contents are never
    // read and its own error message is never surfaced.
    return UNSAFE_VALUE;
  }
}

/**
 * Produce a JSON-safe, redacted copy of untrusted logging metadata.
 *
 * The input is never modified, never stringified, and never passed to
 * `JSON.stringify`, so a custom `toJSON` is never invoked. Accessors are
 * never executed. Circular references, hostile proxies, revoked proxies,
 * and oversized structures all resolve to bounded placeholders.
 */
export function sanitizeLogMetadata(metadata: unknown): unknown {
  if (metadata === undefined) {
    return undefined;
  }

  try {
    return sanitizeValue(metadata, { seen: new WeakSet<object>(), nodes: 0 }, 0);
  } catch {
    return UNSAFE_VALUE;
  }
}
