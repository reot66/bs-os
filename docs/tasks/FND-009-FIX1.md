# FND-009-FIX1 — Harden Shared Error Identity and Public Serialization

## Task identity

- Task: FND-009-FIX1
- Type: Foundation Security Fix
- Parent task: FND-009
- Starting commit: `0584406331d0d46eb2670194c87ff4a613cf10d0`

## Status

AWAITING_INDEPENDENT_REVIEW

## Reproduced vulnerabilities

All three defects were reproduced against the committed FND-009 implementation
before any code was changed.

### A. Mutable classification allowed disclosure through public serialization

`BusinessOsError.toJSON()` built the public payload from the instance field
`this.publicMessage`, and `code`, `category`, `retryable`, and `publicMessage`
were ordinary writable own properties.

Reproduction:

```js
const a = new BusinessOsError("VALIDATION_ERROR");
a.publicMessage = "leaked: TEST_SECRET_DO_NOT_EXPOSE";
JSON.stringify(a);
// {"code":"VALIDATION_ERROR","message":"leaked: TEST_SECRET_DO_NOT_EXPOSE","retryable":false}
```

The sentinel was disclosed. `toPublicError(a)` returned the correct catalog
message, so the two public paths disagreed. Reassigning `code`, `category`, and
`retryable` also succeeded, so trusted classification was caller-mutable.

### B. Forged platform-error identity

`isBusinessOsError` relied on `instanceof` alone.

Reproduction:

```js
const forged = Object.create(BusinessOsError.prototype);
isBusinessOsError(forged);            // true  <- wrong
normalizeUnknownError(forged).code;   // undefined
```

A forged object was accepted as a genuine platform error. This had two
consequences:

1. It received **trusted classification** and bypassed the `INTERNAL_ERROR`
   downgrade.
2. It additionally crashed the public converter:
   `toPublicError(forged)` threw
   `TypeError: undefined is not an object (evaluating 'entry.publicMessage')`
   because the forged object had no `code`, so the catalog lookup returned
   `undefined`.

### C. Hostile proxies could throw during normalization

Reproduction:

```js
new Proxy({}, { getPrototypeOf() { throw new Error("boom"); } });
normalizeUnknownError(hostile);
// >>> THREW: Error - boom

Proxy.revocable({}, {}) /* revoked */;
// >>> THREW: TypeError: Proxy has already been revoked.
```

`instanceof` reaches a proxy's `getPrototypeOf` trap, so an untrusted object
could make a security-boundary function throw instead of being normalized.

## Corrections applied

### A. Immutable, catalog-derived classification

`platform-error.ts` now stores the code in a **private** field `#code` and
exposes `code`, `category`, `retryable`, and `publicMessage` as **prototype
accessors** that derive their value from the immutable catalog on every read.

- Assignment to any of the four throws `TypeError` (getter-only, strict mode).
- `toJSON()` builds from `ERROR_CATALOG[this.#code]`, not from a stored field.
- The Error instance itself is **not** frozen, so native behaviour, `stack`,
  `name`, and the writable `cause` are unaffected.
- `JSON.stringify(error)` and `toPublicError(error)` remain identical.

### B. Genuine identity via a private brand

The class carries a native private field `#brand`. Genuine instances are
recognized with `#brand in value` from inside the class body, exposed as
`BusinessOsError.hasBrand()` and used by the public `isBusinessOsError` guard.

- `Object.create(BusinessOsError.prototype)` is rejected: it has the prototype
  but not the private field.
- A brand cannot be forged by copying own properties.
- `instanceof BusinessOsError` is preserved and unchanged for genuine instances.
- No duck typing or structural matching is used.

### C. Hostile objects are contained

`BusinessOsError.hasBrand()` wraps the `in` check in `try`/`catch`. The `in`
operator does not invoke getters, but it can still reach a proxy `has` trap, so
a hostile or revoked proxy is contained and reported as "not a platform error"
rather than being allowed to throw.

`toPublicError()` additionally wraps its catalog read in `try`/`catch` and falls
back to a frozen `INTERNAL_ERROR` payload. This also covers a proxy that lies in
`has` and throws on `get`.

The catch blocks are scoped strictly to operations on the **untrusted input**.
They do not wrap the constructor or any trusted internal logic, so a genuine bug
in our own code still surfaces normally.

### No circular runtime dependency

`platform-error.ts` imports `PublicError` as a **type-only** import, which is
erased at compile time. The runtime dependency edge remains one-directional:
`public-error.ts` → `platform-error.ts` → `error-catalog.ts`.

## Regression tests

### Before the correction

Both source files were reverted to the committed FND-009 implementation while
keeping the new tests:

```
$ bun test
 (fail) publicMessage cannot be replaced with a sensitive value
 (fail) JSON serialization cannot disclose a tampered public message
 (fail) classification properties cannot be reassigned
 (fail) tampering cannot change trusted classification
 (fail) a tampered error still serializes to the catalog shape
 (fail) an object with the correct prototype is not a platform error
 (fail) a forged object cannot receive a trusted classification
 (fail) a brand cannot be forged by copying own properties
 (fail) the brand check contains hostile proxies without throwing
 (fail) the brand check contains a revoked proxy
 (fail) an object with the correct prototype normalizes to INTERNAL_ERROR
 (fail) a forged object never reaches trusted public classification
 (fail) toPublicError does not throw for a forged object
 (fail) a proxy with a throwing prototype trap normalizes safely
 (fail) a revoked proxy is handled safely
 (fail) a hostile proxy cause is preserved internally but never disclosed
 94 pass
 16 fail
```

### After the correction

```
 110 pass
  0 fail
```

**16 of the new regression tests fail against the original implementation and
pass after the correction**, covering all three defects.

Honest note: two new tests do **not** discriminate and passed both before and
after. "A proxy with a lying has trap and throwing getter is contained" passed
against the original too, because `instanceof` consults `getPrototypeOf` (which
that proxy did not trap) and therefore returned false, wrapping it harmlessly.
The test is kept as forward protection for the new `has`-trap code path.

### Coverage added

`platform-error.test.mjs` (31 → 41 tests):

- `publicMessage` cannot be replaced with a sensitive value.
- JSON serialization cannot disclose a tampered public message.
- `code`, `category`, `retryable`, `publicMessage` all throw on assignment.
- Tampering cannot change trusted classification.
- A tampered error still serializes to the catalog shape.
- `instanceof` still recognizes genuine instances.
- `Object.create(prototype)` fails the genuine-error guard.
- A forged object cannot receive a trusted classification.
- A brand cannot be forged by copying own properties.
- The brand check contains hostile proxies and revoked proxies without throwing.

`public-error.test.mjs` (28 → 45 tests):

- A forged prototype clone normalizes to `INTERNAL_ERROR`.
- A forged object never reaches trusted public classification.
- `toPublicError` does not throw for a forged object.
- Ordinary objects with trusted-looking codes are still downgraded.
- Genuine instances preserve identity.
- A throwing-prototype proxy, a revoked proxy, and a lying-`has` proxy are all
  contained.
- A hostile proxy cause is preserved internally but never disclosed.
- Unknown objects still normalize to `INTERNAL_ERROR`.
- Public serialization still returns exactly `code`, `message`, `retryable`.
- Native Error cause behaviour remains intact.
- Internal cause, internal message, context, and stack remain absent from public
  output.
- No global exception handler is installed by normalization.

## Existing tests preserved

No existing test was modified, weakened, or removed. The FND-009 catalog suite
is byte-identical (24 tests). The other two suites only gained new `describe`
blocks and two corrected assertions in the newly added code. All 239 tests that
passed before still pass.

Two authoring bugs in the new tests were found and corrected (not
implementation defects): a `toContain` call was given an array instead of a
string, and two tests assigned to prototype accessors that now throw — which is
itself evidence the fix works. Those tests were rewritten to shadow properties
with `Object.defineProperty`.

## Full test count

| Suite | Passed | Failed |
| --- | --- | --- |
| `packages/errors/test/error-catalog.test.mjs` | 24 | 0 |
| `packages/errors/test/platform-error.test.mjs` | 41 | 0 |
| `packages/errors/test/public-error.test.mjs` | 45 | 0 |
| **Errors package total** | **110** | **0** |
| All other packages | 154 | 0 |
| **Root suite** | **264** | **0** |

264 passed, 0 failed, 0 skipped, 989 `expect()` calls across 11 files. FND-009
reported 239; the suite grew by 25.

## Quality verification

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile --ignore-scripts` | 0 | 30 installs across 34 packages, no changes |
| `bun run lint` | 0 | 35 files, 0 errors, 1 pre-existing info |
| `bun run format:check` | 0 | 35 files |
| `bun run typecheck` | 0 | contracts, errors, database, configuration all code 0 |
| `bun run build` | 0 | all four workspaces |
| `bun run test` | 0 | 264 pass, 0 fail |
| `bun audit` | 0 | No vulnerabilities found |

The single lint info is the pre-existing Biome `recommended` deprecation from
`biome.json`, which this task may not modify. The errors package reports zero
warnings. Formatting was applied only to the four authorized files. No lint rule
was changed and no error was suppressed.

## Lockfile

`bun.lock` is **unchanged**: sha256 `451074abf6eaa8db2231594258f4b55c59cd5a6c493372111f58d7510ed6ed94`
before and after, confirmed with `git diff`.

## Files changed

Modified:

- `packages/errors/src/platform-error.ts`
- `packages/errors/src/public-error.ts`
- `packages/errors/test/platform-error.test.mjs`
- `packages/errors/test/public-error.test.mjs`

Created:

- `docs/tasks/FND-009-FIX1.md`

Exactly the five authorized paths. `agent/`, `error-catalog.ts`, root manifests,
`bun.lock`, `biome.json`, `tsconfig.base.json`, `.github/`,
`packages/contracts/`, `packages/configuration/`, `packages/database/`, `tests/`,
`deployments/`, and `.env.example` are all untouched.

## Security findings after the correction

- Public serialization cannot be influenced by instance mutation.
- Forged identities are rejected and downgraded to `INTERNAL_ERROR`.
- `toPublicError` no longer throws for any input, including forged objects and
  hostile proxies.
- Hostile and revoked proxies are contained without invoking their traps beyond
  the contained `has`/`getPrototypeOf` probe, and their contents are never read
  or disclosed.
- The hostile proxy is still preserved as an internal `cause` for trusted
  debugging, and never appears publicly.
- No new runtime dependencies, no global exception handlers, no retry
  behaviour, no HTTP coupling, and no Bun-only APIs were introduced.
- Genuine `instanceof` behaviour and native `cause` semantics are intact.

One unrelated observation: during verification, a single `bun -e` invocation
printed `BusinessOsError` as the `constructor.name` of a caught `TypeError`. I
re-ran the snippet twice, in isolation and in combination, and both reported
`TypeError` correctly, so it was an artifact of that one evaluation context
rather than a behaviour. The substantive facts — assignment throws, and
classification stays intact — were confirmed repeatedly.

## Remaining limitations

1. **A proxy that lies in `has` *and* returns a plausible classification is
   still contained, but only because reading its properties is guarded.** A
   proxy that both lies in `has` and returns a real `code` string could pass the
   brand check and influence the returned code. Mitigation today is that the
   catalog lookup and the private-field-derived getters mean the value can only
   select an existing catalog entry, never inject text. Fully closing this would
   require an unforgeable cross-realm check, which is not practical.
2. **Internal diagnostics remain unsafe to log.** Unchanged by this task and
   still deferred to the logger task.
3. **Two error styles still coexist** pending the migration task.
4. **`instanceof` is deliberately still prototype-based** and still returns
   `true` for a forged object. The security guarantee now rests on
   `isBusinessOsError`, which uses the private brand. Code that calls
   `instanceof` directly for a trust decision would still be vulnerable; the
   guard is documented and exported for that reason.
5. **`docs/` is outside Biome's include list**, so this record is not
   format-checked.
6. **GitHub Actions was not observable** from this environment.

## Git verification

Recorded in the completion report: exactly the five authorized paths staged, no
credentials, no generated files, no unrelated changes, `bun.lock` untouched, and
every staged blob identical to its working-tree copy.

## Independent review status

AWAITING_INDEPENDENT_REVIEW

This task is **not** independently approved. Per D-071 and
`agent/workflow/AGENT_REVIEW_GATE.md`, the implementation agent's own report is
not evidence. The reviewer should independently reproduce the three defects
against the parent commit, confirm the 16 regression tests fail before the
correction and pass after, and confirm an actual successful GitHub Actions run.
