# FND-010-CI-FIX1 — Resolve Clean CI Workspace Typecheck

## Task identity

- Task: FND-010-CI-FIX1
- Type: Shared Platform Foundation — CI build fix
- Parent task: FND-010
- Starting commit: `b8aca9287a1b3af07447919c937a24fccd803336`
- Runtime: Bun 1.3.14, unchanged as development and production runtime

## Status

APPROVED

## Root cause

Verified by reproduction, not inference.

### Reproduction in an isolated clean checkout

A real `git clone --no-hardlinks` of the starting commit was made into
`/tmp/opencode/ci-clean-before`. It contained no `dist/` and no `node_modules/`.

```
$ bun install --frozen-lockfile --ignore-scripts      -> exit 0
$ bun run typecheck
@business-os/contracts typecheck:      Exited with code 0
@business-os/errors typecheck:         Exited with code 0
@business-os/database typecheck:       Exited with code 0
@business-os/configuration typecheck:  Exited with code 0
@business-os/logger typecheck: src/logger.ts(10,28): error TS2307:
  Cannot find module '@business-os/configuration' or its corresponding type declarations.
@business-os/logger typecheck: src/logger.ts(11,72): error TS2307:
  Cannot find module '@business-os/errors' or its corresponding type declarations.
@business-os/logger typecheck: src/redaction.ts(19,49): error TS2307:
  Cannot find module '@business-os/configuration' or its corresponding type declarations.
@business-os/logger typecheck: Exited with code 2
(exit 2)
```

This matches the reported GitHub Actions failure exactly, including the three
reported locations.

### Cause

`@business-os/logger` is the first workspace package that imports another
workspace package at type level. Resolution follows this chain:

1. `packages/logger/tsconfig.json` extends `../../tsconfig.base.json`, which sets
   `"moduleResolution": "Bundler"` and inherits full strictness.
2. `packages/configuration/package.json` and `packages/errors/package.json` both
   declare `"types": "./dist/index.d.ts"` and
   `"exports": { ".": { "types": "./dist/index.d.ts", ... } }`.
3. `.gitignore` line 12 ignores `dist/`, so no `dist/index.d.ts` exists in a
   clean checkout.
4. `bun run typecheck` ran only `tsc --noEmit` per workspace. It never produced
   the declarations the other workspaces' manifests point at.

TypeScript therefore resolved the bare specifiers to a non-existent file and
reported TS2307.

Why the other four workspaces passed: `contracts`, `configuration`, `errors`,
and `database` have no workspace package among their own imports, so none of
them needs a sibling's `dist/index.d.ts`. `logger` is the first package where
declaration output from a dependency is required.

Why it passed locally: the developer working tree already contained `dist/`
from earlier builds. The failure was therefore masked by cached build
artifacts, exactly as suspected.

### Confirming the cause

After running `bun run build` in the same clean checkout, `bun run typecheck`
returned exit 0 for all five workspaces, and `bun run build` itself returned
exit 0 on a clean checkout, producing `dist/` for all five packages. Bun's
`--filter` already runs workspaces in topological (declared-dependency) order,
so the build ordering was never the problem — the missing build *before*
typecheck was.

## Correction applied

Exactly one line changed, in the root `package.json`:

```diff
-    "typecheck": "bun run --filter '@business-os/*' typecheck",
+    "typecheck": "bun run build && bun run --filter '@business-os/*' typecheck",
```

Rationale for this shape:

- It makes the **direct root command** correct on a clean checkout, which was
  the explicit requirement. Reordering CI steps alone was rejected because it
  would leave `bun run typecheck` broken for developers.
- It is **self-maintaining**. Any future workspace that imports another
  workspace is covered automatically, because the whole graph is built first.
  A hand-maintained list of prerequisite packages would silently rot.
- It adds **no** new tooling, config, alias, or suppression.

### Alternatives evaluated and rejected

- **Dependency-inclusive Bun filters.** Tested empirically on Bun 1.3.14:
  `--filter '@business-os/logger...'`, `'...@business-os/logger'`, `'*...'`,
  and `'@business-os/*...'` all exited 1 and built nothing. `bun run --help`
  documents `--filter` only as "Run a script in all workspace packages matching
  the pattern". No dependency-inclusion syntax exists here.
- **Enumerating prerequisites in the script**, e.g. building only
  configuration and errors. Works today, but must be updated by hand whenever a
  new cross-package dependency is introduced.
- **TypeScript `paths` aliases to source.** Not authorized, and it would blur the
  real package boundaries the module standard requires.
- **A `pretypecheck` hook.** Equivalent effect but less explicit for a reader
  reviewing CI, and easy to overlook.

### What was deliberately NOT changed

- `.github/workflows/ci.yml` — **unchanged**. Because the root `typecheck`
  command is now self-sufficient, the workflow's existing order
  (install → lint → format → typecheck → build → test → audit) works as
  written. Modifying it would have masked a broken root command.
- `bun.lock` — **unchanged**, verified byte-identical.
- `packages/logger/src/*` — **unchanged** (0 files). Investigation proved the
  logger implementation was correct; the defect was in build ordering.
- `packages/configuration`, `packages/errors`, `tsconfig.base.json`,
  `biome.json`, `.gitignore`, `agent/`, and every other protected path.
- No `skipLibCheck` change (it was already `true` and untouched), no
  `@ts-ignore`, no `@ts-expect-error`, and no `any` introduced.

## Clean-checkout verification

A second clean clone (`/tmp/opencode/ci-clean-after`) was made and given only
the corrected root `package.json`. Starting state: no `dist/`, no
`node_modules/`.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile --ignore-scripts` | 0 | 70 packages installed |
| `bun run typecheck` | 0 | all five workspaces code 0 |
| `bun run build` | 0 | all five workspaces |
| `bun run test` | 0 | **362 pass, 0 fail**, 1288 expect() calls, 14 files |
| `bun run lint` | 0 | 44 files, 0 errors, 1 pre-existing info |
| `bun run format:check` | 0 | 44 files |
| `bun audit` | 0 | No vulnerabilities found |

All 362 previously passing tests still pass.

### Proof the unchanged CI workflow now succeeds end to end

A third clean clone ran the workflow's **exact existing step order** with the
workflow file untouched:

| CI step | Exit |
| --- | --- |
| Verify Bun runtime | 0 |
| Install locked dependencies | 0 |
| Lint source | 0 |
| Check formatting | 0 |
| TypeScript typecheck | 0 |
| Build workspaces | 0 |
| Run automated tests | 0 |
| Audit dependencies | 0 |

### Proof the fix does not depend on cached artifacts

Every verification above started from a clone with `dist/` and `node_modules/`
both absent, and `bun install --frozen-lockfile` regenerated `node_modules` from
the committed lockfile. No developer working-tree file was deleted or modified
to simulate CI; all reproduction and verification used separate clones under
`/tmp/opencode`.

The corrected root command was also re-run repeatedly after wiping
`packages/*/dist`, and still returned exit 0.

## Files changed

- `package.json` — one line, the root `typecheck` script.
- `docs/tasks/FND-010-CI-FIX1.md` — this record.

No other tracked file was modified. `bun.lock` was not modified and did not need
to be.

## Security and architecture review

- No new dependencies, scripts, or tooling were introduced.
- Strict TypeScript is unchanged: `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`,
  `verbatimModuleSyntax`, and `noEmitOnError` all remain in force.
- No suppression was used. The failure was fixed at its source rather than
  hidden.
- Module boundaries and explicit `workspace:*` dependency declarations are
  untouched; the fix relies on those declarations rather than replacing them.
- Bun remains both the development and production runtime. No Node.js
  deployment or CI was introduced.
- `dist/` remains gitignored and is not committed.

## Known limitations and trade-offs

1. **`bun run typecheck` now emits build artifacts** into the gitignored `dist/`
   directories. This is the accepted cost of making the root command correct on
   a clean checkout. It does not alter committed files.
2. **A redundant build in CI.** The workflow runs typecheck (which builds) and
   then build again. Each workspace build is fast and idempotent, so this costs
   seconds. It was preferred over changing CI, which must remain untouched.
3. **Build-before-typecheck does not guarantee correctness of dependency
   declarations**, only that they exist. Declaration contents are still checked
   when the dependent workspace typechecks against them.
4. **Typecheck now depends on the build step succeeding.** A genuine build
   failure will surface at the typecheck step in CI. That is desirable — it
   fails earlier — but it changes which step reports such a failure.
5. The behavior was verified on Bun 1.3.14 only. The dependency-ordering
   behavior of `bun run --filter` is a Bun implementation detail, as it was for
   the original build script.
6. **GitHub Actions was not observable** from this environment.

## Independent review status

APPROVED

GitHub CI is **PASS**, confirmed by the repository owner.

This outcome was supplied by the independent reviewer and confirmed by
the repository owner. It is not generated by the coding agent.

The reviewer approved this task without non-blocking notes.

The reviewer instruction issued before this verdict was to independently confirm
the root cause, reproduce the TS2307 failure from a clean checkout of the parent
commit, and confirm that the one-line root script change resolves it without the
CI workflow being modified.
