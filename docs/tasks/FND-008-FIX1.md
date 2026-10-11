# FND-008-FIX1 — Correct Local Administration TLS Parsing

## Task identity

- Task: FND-008-FIX1
- Type: Foundation Bug Fix
- Parent task: FND-008
- Starting commit: `521eefb48dd90aabe02e839d33a10955b32bebca`

## Status

AWAITING_INDEPENDENT_REVIEW

## Problem

The independent reviewer confirmed a defect in
`packages/configuration/src/environment.ts`.

`parseLocalAdminEnvironment()` read the already-validated `BUSINESS_OS_DB_SSL`
value and compared it against the **string** `"true"`:

```ts
ssl: (values.BUSINESS_OS_DB_SSL ?? "false") === "true",
```

The registry schema `databaseSslSchema` ends with
`.transform((value) => value === "true")`, so by the time the parser reads
`values`, the value is already a **boolean**. Comparing a boolean to the string
`"true"` is always `false`, so an explicitly enabled TLS was silently reported
as disabled.

This is a security-relevant defect: a caller that explicitly requested
`BUSINESS_OS_DB_SSL=true` for local administration received `ssl: false` and
would connect without transport encryption while believing TLS was on.

Reproduced against the unmodified code before fixing:

```
admin   BUSINESS_OS_DB_SSL="true"  -> ssl = false   (expected true)
admin   BUSINESS_OS_DB_SSL="false" -> ssl = false   (expected false)
runtime BUSINESS_OS_DB_SSL="true"  -> ssl = true    (correct)
runtime BUSINESS_OS_DB_SSL="false" -> ssl = false   (correct)
```

The runtime parser was correct because it already used the `readBoolean()`
helper. Only the administration parser was affected.

The `?? "false"` fallback was also unreachable: `BUSINESS_OS_DB_SSL` is declared
`required: true` in the registry, so `LOCAL_ADMIN_SCHEMA` rejects a missing value
with `MISSING_REQUIRED_VALUE` before this line is reached. The fallback
therefore implied a default that could never apply.

## Correction applied

The administration parser now consumes the validated boolean through the existing
`readBoolean()` helper, matching the runtime parser:

```ts
// The registry schema already transforms this value into a boolean,
// so it must be read as one. Comparing it against the string "true"
// would silently report an explicitly enabled TLS as disabled.
ssl: readBoolean(values, "BUSINESS_OS_DB_SSL"),
```

No new schema was introduced, no new coercion rule was added, no implicit SSL
default was created, and no new helper was written. The existing
`databaseSslSchema`, the strict `true`/`false` rule, and the
`FORBIDDEN_IN_PRODUCTION` production TLS policy are all untouched.

## Audit of both parsers for similar mistakes

Every field read in `parseRuntimeEnvironment()` and `parseLocalAdminEnvironment()`
was checked against the output type of its registry schema.

| Variable | Schema output type | Accessor used | Correct |
| --- | --- | --- | --- |
| `BUSINESS_OS_ENV` | string (`z.enum`) | `readString` | yes |
| `BUSINESS_OS_LOG_LEVEL` | string (`z.enum`, optional) | `?? DEFAULT_LOG_LEVEL`, refined with `as LogLevel` | yes |
| `BUSINESS_OS_DB_HOST` | string | `readString` | yes |
| `BUSINESS_OS_DB_PORT` | **number** (`.transform(Number)`) | `readNumber` | yes |
| `BUSINESS_OS_DB_NAME` | string | `readString` | yes |
| `BUSINESS_OS_DB_SSL` | **boolean** (`.transform`) | `readBoolean` (both parsers, after this fix) | yes |
| `BUSINESS_OS_DB_APP_USER` | string | `readString` | yes |
| `BUSINESS_OS_DB_APP_PASSWORD` | string | `readString` | yes |
| `BUSINESS_OS_DB_USER` | string | `readString` | yes |
| `BUSINESS_OS_DB_PASSWORD` | string | `readString` | yes |

**Findings: no further instances.** The two transformed outputs are the port
(number) and the TLS flag (boolean). The port was already read with `readNumber`
in both parsers and was never affected. After this correction, every field in
both parsers is read through the accessor matching its schema output type.

The only remaining type assertion is `as RuntimeEnvironment` and `as LogLevel` on
the two enum outputs. Those are type refinements over values the schema has
already constrained to a member of the list, not string-versus-transformed-type
confusions, so they are not the same class of defect.

Per the task instruction, no further implementation change was made.

## Regression tests added

Added to `packages/configuration/test/environment.test.mjs` in the existing
"local administration parser" block:

| Test | Purpose |
| --- | --- |
| returns an explicitly enabled TLS as true | the defect itself |
| returns an explicitly disabled TLS as false | correct-false case |
| reports TLS as a real boolean rather than a string | type guard |
| rejects a missing TLS setting instead of defaulting it | no implicit default |
| rejects invalid TLS values | strict `true`/`false` rule |
| keeps the rest of the administration settings unchanged when TLS is enabled | no collateral change |
| the runtime parser still reports TLS correctly | cross-parser guard |

`BUSINESS_OS_DB_SSL="true"` returns `database.ssl === true`.
`BUSINESS_OS_DB_SSL="false"` returns `database.ssl === false`.
A missing value is rejected with `MISSING_REQUIRED_VALUE`.
`TRUE`, `1`, `0`, `yes`, `""`, and `"true "` are rejected with `INVALID_VALUE`.

### Proof the tests detect the defect

The fix was temporarily reverted to the original single line while keeping the
new tests, then rebuilt:

```
$ bun test test/environment.test.mjs        # against ORIGINAL implementation
(fail) local administration parser > returns an explicitly enabled TLS as true
 48 pass
  1 fail
```

Restoring the correction:

```
$ bun test test/environment.test.mjs        # against FIXED implementation
 49 pass
  0 fail
```

Honest note on discriminating power: only the first test fails against the
original code, because the defect is only observable when TLS is explicitly
enabled. The `false` case returned the correct value by accident, and the
remaining tests are guard cases that lock in behaviour the correction must not
break. They were kept because they pin the strictness rules and the
no-implicit-default requirement, but they should not be mistaken for
additional proof of the defect.

## Files changed

Modified:

- `packages/configuration/src/environment.ts`
- `packages/configuration/test/environment.test.mjs`

Created:

- `docs/tasks/FND-008-FIX1.md`

No other tracked file was changed. `bun.lock`, every package manifest,
`agent/`, `biome.json`, `tsconfig.base.json`, `.github/workflows/ci.yml`,
`packages/database/**`, `packages/contracts/**`, `deployments/**`, `.env`, and
`.env.example` are all untouched.

## Public API

Unchanged. The correction alters behaviour of an existing function, not the
exported surface, error codes, metadata, or types.

## Verification

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile --ignore-scripts` | 0 | 29 installs across 33 packages, no changes |
| `bun run lint` | 0 | 26 files, 0 errors, 1 pre-existing info |
| `bun run format:check` | 0 | 26 files |
| `bun run typecheck` | 0 | contracts, database, configuration all code 0 |
| `bun run build` | 0 | all three workspaces |
| `bun run test` | 0 | 154 pass, 0 fail |
| `bun audit` | 0 | No vulnerabilities found |

Test counts: the root suite was 147 and is now **154**, with 7 tests added and 0
removed. The configuration package went from 88 to 95. No previously passing
test was modified or weakened.

The single lint info is the pre-existing Biome `linter.rules.recommended`
deprecation from `biome.json`, which this task may not modify.

## Security review

- **Severity of the defect:** a local administration caller that explicitly set
  `BUSINESS_OS_DB_SSL=true` received `ssl: false` and could connect without
  transport encryption while believing TLS was enabled. The value was wrong, but
  it failed in the conservative direction for local administration tooling, and
  the exposure was limited to the loopback-bound local development service.
  The production TLS policy (`FORBIDDEN_IN_PRODUCTION`) lived in the runtime
  parser, which was unaffected and remained enforced throughout.
- **No secret was involved or exposed.** The corrected field is a TLS boolean.
- **The strict TLS rule is preserved.** Only the exact strings `true` and
  `false` are accepted; no permissive coercion was introduced.
- **No implicit default was introduced.** The unreachable `?? "false"` fallback
  was removed; a missing value is now rejected by the schema and cannot be
  silently defaulted.
- **No production behaviour changed**, because the runtime parser was already
  correct and is unchanged.

## Known limitations

1. **No automated type-level guard against this class of defect.** The parser
   reads values from a `Record<string, unknown>`, so the compiler cannot catch a
   mismatch between a schema's output type and how a field is consumed. This is
   why the defect was reachable and why the regression tests are behavioural
   rather than type-based. A future task could tighten this by typing each parser
   output against the inferred schema type.
2. The audit covers the two parsers in this package. The FND-007 database
   package has its own explicit validators and was not in scope.
3. GitHub Actions was not observable from this environment.
4. The pre-existing Biome deprecation and the deferred FND-008 follow-ups
   (local tooling migration, database wiring, build-target alignment) remain open
   and are unaffected by this fix.

## Git verification

Recorded in the completion report: exactly the three authorized paths staged, no
`bun.lock` or manifest change, no credentials, no protected-path change, and both
remote heads verified after push.

## Independent review status

AWAITING_INDEPENDENT_REVIEW

This task is **not** independently approved. Per D-071 and
`agent/workflow/AGENT_REVIEW_GATE.md`, the implementation agent's own report is
not evidence. The reviewer should confirm the correction and re-run the
commands, including the deliberate revert check that proves the regression test
detects the defect.
