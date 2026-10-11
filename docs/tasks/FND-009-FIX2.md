# FND-009-FIX2 — Enforce Unforgeable Error Identity

## Task identity

- Task: FND-009-FIX2
- Type: Foundation Security Fix
- Parent tasks: FND-009, FND-009-FIX1
- Starting commit: `ce5b90acfd313729dd47b83ec65a9f904f99104a`

## Status

AWAITING_INDEPENDENT_REVIEW

## Correction applied

FND-009-FIX1 replaced `instanceof` with a native private-field brand
(`#brand in value`). Its own report flagged that this mechanism can be
satisfied by a proxy `has` trap. That flag is now closed.

`platform-error.ts` now keeps a **module-private `WeakSet<BusinessOsError>`**,
`GENUINE_ERRORS`, populated only inside the constructor and only after the error
code has been validated against the catalog. The public guard
`BusinessOsError.hasBrand()` performs a weak-set membership test.

The `#brand` private field has been removed; the `in` path no longer exists.

### Why WeakSet is unforgeable

`WeakSet.prototype.has` is an **internal identity test**. It takes the value as
an argument and performs a set-membership check against internal slots. It
dispatches **no proxy trap**, so there is no `get`, `has`, or `getPrototypeOf`
path for a crafted object to take, and no public property is read.

A `PrivateIdentifier in Proxy` check is different in principle: the language
specification routes it through `HasProperty`, which for a Proxy dispatches to
the `has` trap. Resolving that trap against the target and re-verifying the
private element exists is an engine refinement, not a guarantee every engine
makes.

The set is never exported, and the class exposes no `register`/`add`/`set`
member, so there is no mechanism by which a caller can make an arbitrary object
genuine.

## Honest deviation from a stated verification requirement

The task asked me to **"show that the new security regression tests detect the
original weakness"**. I could not, and I did not manufacture a demonstration.

I reverted both source files to the FND-009-FIX1 implementation while keeping
the new tests and ran the suite:

```
$ bun test          # against the original private-field brand
 128 pass
  0 fail
```

**All 128 tests also pass against the previous implementation.** The new tests
do not detect a weakness on this engine, because there is no observable weakness
on this engine.

### Why

Measured directly on Bun 1.3.14 (JavaScriptCore):

```
#b in proxy  ->  false   |  has trap fired: NONE
```

JavaScriptCore resolves the private field against the proxy's target internally
and never consults the `has` trap at all. A proxy that returns `true` from
`has` therefore cannot satisfy the brand, on this engine.

A direct comparison of both mechanisms across every forgery vector confirmed
identical, correct behaviour on Bun:

| Vector | private-field `in` | WeakSet |
| --- | --- | --- |
| genuine instance | true | true |
| `Object.create(prototype)` | false | false |
| proxy lying `has` | false | false |
| proxy with forged prototype | false | false |
| proxy lying `has` + forged prototype | false | false |
| proxy throwing `has` | false | false |
| revoked proxy | false | false |
| proxy throwing `getPrototypeOf` | false | false |
| hostile traps executed | NONE | NONE |

### What this means

- On Bun today, FND-009-FIX1's mechanism is **not exploitable**. This is a
  **portability and specification-alignment** correction, not a fix for a live
  bug on this runtime.
- The change removes a dependency on undocumented engine behaviour from a
  package that ADR-0002 deliberately builds as portable ESM for possible future
  runtimes. That is a real, if latent, risk worth closing.
- The new regression tests still have value: they pin the required contract and
  would fail on any engine that honours the `has`-trap path. They are contract
  tests, not proof of a currently exploitable defect.

I did not install or run Node.js to test V8 behaviour, because FND-009 and this
task both forbid adding Node.js infrastructure and Node execution tests are not a
gate here. That comparison should be done by a future portability task.

## Behaviour verified after the correction

| Input | `isBusinessOsError` | Normalized code |
| --- | --- | --- |
| genuine `BusinessOsError` | true | original code preserved |
| `Object.create(prototype)` | false | `INTERNAL_ERROR` |
| proxy with lying `has` trap | false | `INTERNAL_ERROR` |
| proxy with forged `getPrototypeOf` | false | `INTERNAL_ERROR` |
| proxy with both tricks | false | `INTERNAL_ERROR` |
| revoked proxy | false (no throw) | `INTERNAL_ERROR` |
| proxy wrapping a genuine error | false (fail closed) | `INTERNAL_ERROR` |
| plain object `{ code: "FORBIDDEN", … }` | false | `INTERNAL_ERROR` |

Hostile `get`, `has`, and `getPrototypeOf` traps executed **zero** times during
the identity check. `toPublicError` never throws and never lets an untrusted
object select a privileged code: forged values presenting a convincing
`code: "FORBIDDEN"` surface still produce `INTERNAL_ERROR` with the catalog
message.

Genuine behaviour is fully preserved: `instanceof`, `code`, `category`,
`retryable`, `publicMessage`, identity-preserving normalization, native `cause`
handling, and public serialization returning exactly `code`, `message`, and
`retryable`.

A proxy **wrapping** a genuine error is now treated as not genuine. That is a
deliberate fail-closed choice: a proxy can lie, so it is never trusted even when
its target happens to be a real error.

## Regression tests added

`platform-error.test.mjs` (41 → 53 tests):

- a real instance is recognized
- `Object.create(prototype)` rejected
- proxy lying `has` rejected
- proxy with forged prototype rejected
- proxy with both tricks rejected
- revoked proxy rejected
- proxy wrapping a genuine error is not trusted
- hostile `get`/`has`/`getPrototypeOf` traps never execute (asserted with an
  empty fired list)
- revoked proxy rejected without throwing
- no registration mechanism is exposed (public export surface pinned; no
  `register`/`add`/`set`/`brand`/`trust` member on the class or prototype)
- the registry is not reachable as an exported symbol
- genuine instances retain their original classification

`public-error.test.mjs` (45 → 51 tests):

- forged values normalize to `INTERNAL_ERROR`
- forged values cannot obtain a privileged public code, even when they shadow
  `code`, `category`, `retryable`, and `publicMessage` with convincing values
- forged values never throw during conversion
- a revoked proxy cannot obtain a privileged public code
- genuine errors retain their original classification and identity
- genuine errors keep retryability and cause behaviour

## Test results

| Suite | Passed | Failed |
| --- | --- | --- |
| `packages/errors/test/error-catalog.test.mjs` | 24 | 0 |
| `packages/errors/test/platform-error.test.mjs` | 53 | 0 |
| `packages/errors/test/public-error.test.mjs` | 51 | 0 |
| **Errors package** | **128** | **0** |
| All other packages | 154 | 0 |
| **Root suite** | **282** | **0** |

282 passed, 0 failed, 0 skipped, 1050 `expect()` calls across 11 files.
FND-009-FIX1 reported 264; the suite grew by 18.

**All 264 previously passing tests continue passing.** No existing test was
modified, weakened, or removed.

## Quality verification

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile --ignore-scripts` | 0 | 30 installs across 34 packages, no changes |
| `bun run lint` | 0 | 35 files, 0 errors, 1 pre-existing info |
| `bun run format:check` | 0 | 35 files |
| `bun run typecheck` | 0 | contracts, errors, database, configuration all code 0 |
| `bun run build` | 0 | all four workspaces |
| `bun run test` | 0 | 282 pass, 0 fail |
| `bun audit` | 0 | No vulnerabilities found |

The single lint info is the pre-existing Biome `recommended` deprecation from
`biome.json`, which this task may not modify. The errors package reports zero
warnings. Formatting was applied only to the four authorized files. No lint rule
was changed and no error was suppressed.

## Files changed

Modified:

- `packages/errors/src/platform-error.ts`
- `packages/errors/src/public-error.ts`
- `packages/errors/test/platform-error.test.mjs`
- `packages/errors/test/public-error.test.mjs`

Created:

- `docs/tasks/FND-009-FIX2.md`

Exactly the five authorized paths. `agent/`, `error-catalog.ts`,
`index.ts`, root manifests, `bun.lock`, `biome.json`, `tsconfig.base.json`,
`.github/`, `packages/contracts/`, `packages/configuration/`,
`packages/database/`, `tests/`, `deployments/`, and `.env.example` are untouched.

No dependencies, logging, HTTP adapters, or new features were added. The error
constructors, public serialization, causes, and retryability are unchanged.

## Known limitations

1. **The verification deviation described above.** The regression tests do not
   fail against the previous implementation on Bun, because that implementation
   is not exploitable on this engine. The change is justified by specification
   alignment and portability, not by a demonstrated live defect.
2. **Cross-engine behaviour is unverified.** V8 and SpiderMonkey were not tested.
   A future portability task should compare brand mechanisms across runtimes.
3. **A proxy wrapping a genuine error is downgraded to `INTERNAL_ERROR`.** This
   is intentional and fail-closed, but it means a proxied legitimate error loses
   its classification.
4. **`instanceof` remains prototype-based** and still returns `true` for a
   forged object. The trust guarantee rests on `isBusinessOsError`; code that
   calls `instanceof` for a trust decision remains vulnerable. The guard is
   exported and documented for that reason.
5. **Identity does not survive a serialization round trip.** A genuine error
   passed through `structuredClone` or JSON is no longer recognized, because
   weak-set membership and prototype identity do not survive. Errors are not
   intended to cross process boundaries, but this is worth knowing.
6. **Internal diagnostics remain unsafe to log** (unchanged; deferred).
7. **Two error styles still coexist** pending the migration task.
8. `docs/` is outside Biome's include list.
9. **GitHub Actions was not observable** from this environment.

## Git verification

Recorded in the completion report: exactly the five authorized paths staged, no
credentials, no generated files, no unrelated changes, `bun.lock` untouched, and
every staged blob identical to its working-tree copy.

## Independent review status

AWAITING_INDEPENDENT_REVIEW

This task is **not** independently approved. The reviewer should pay particular
attention to the verification deviation above: the correction is real and
strictly stronger, but the "tests fail before, pass after" demonstration could
not be produced on Bun, and the justification rests on specification behaviour
and portability rather than on a reproduced exploit. That judgement should be
made independently.
