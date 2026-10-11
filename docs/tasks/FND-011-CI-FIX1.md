# FND-011-CI-FIX1 — Resolve Drizzle Kit Transitive esbuild Advisory

## Task identity

- Task: FND-011-CI-FIX1
- Parent task: FND-011
- Type: Focused security and CI correction
- Capability level: **ADVANCED** (authorized focused amendment)
- Starting commit: `edf6f6400a6e79ac339dee85f83d78e73ec50cbd`
- Runtime: Bun 1.3.14

## Status

COMPLETED — awaiting independent source review

## Context

The independent reviewer confirmed that GitHub Actions run
`38169545182` failed **only** at `bun audit`; every preceding step passed.
FND-011 had already reported `bun audit` exiting 1 and had raised this as
Plan Amendment 1. The root `package.json` was protected under FND-011's
scope; this task explicitly authorizes changing it.

## Root cause

```text
@business-os/database
└── drizzle-kit@0.31.11
    └── @esbuild-kit/esm-loader@2.6.5
        └── @esbuild-kit/core-utils@3.3.2
            └── esbuild@0.18.20   ← vulnerable
```

`@esbuild-kit/core-utils@3.3.2` declares `"esbuild": "~0.18.20"`. A tilde
range on a `0.x` version pins the minor exactly, so the range **cannot**
resolve to a patched release. Advisory GHSA-67mh-4wv8-2f99 affects
`<=0.24.2`. The fix therefore requires explicit resolution control.

Resolved esbuild versions before: `0.18.20`, `0.25.12`, `0.28.2`.
`0.25.12` belongs to drizzle-kit directly; `0.28.2` belongs to `tsx`.

## Override selection — Bun 1.3.14 does not support scoped overrides

The preferred syntax in the authorization was a nested override:

```json
"overrides": { "@esbuild-kit/core-utils>esbuild": "0.25.12" }
```

**This was tested and it does not work on Bun 1.3.14.** It is accepted
without error, reported as "no changes", and leaves `esbuild@0.18.20`
resolved and the audit still failing. A silent no-op would have produced a
green-looking change that fixed nothing, which is exactly why the installed
graph was verified rather than the declaration.

Syntax matrix tested in an isolated copy (lockfile inspected each time):

| Form | esbuild 0.18.20 | audit |
| --- | --- | --- |
| `overrides` `"@esbuild-kit/core-utils>esbuild"` | present | 1 |
| `overrides` `"@esbuild-kit/core-utils/esbuild"` | present | 1 |
| `overrides` `"@esbuild-kit/core-utils>esbuild": "^0.25.12"` | present | 1 |
| `overrides` `"esbuild@~0.18.20"` | present | 1 |
| `overrides` `"esbuild@0.18.20"` | present | 1 |
| `resolutions` nested | present | 1 |
| **`overrides` `"esbuild"` (global)** | **eliminated** | **0** |
| `resolutions` `"esbuild"` (global) | eliminated | 0 |

Bun 1.3.14 honours only a **global, package-name-level** override. Both the
`overrides` and `resolutions` fields behave identically.

### Configuration actually applied

```json
"overrides": {
  "esbuild": "0.25.12"
}
```

Scoped by **version choice**, not by dependency path: `0.25.12` is exactly
the version already resolved for drizzle-kit's own `^0.25.4` requirement, so
the vulnerable branch is lifted to a version already trusted in this tree.

### Consequence, stated plainly

A global override is not path-scoped, so `tsx`'s `~0.28.0` is also normalised
from `0.28.2` to `0.25.12`. The authorization asked that unrelated esbuild
versions remain unchanged **whenever possible**; on Bun 1.3.14 it is not
possible, because the scoped forms are silently ignored. The single resolved
version `0.25.12` satisfies drizzle-kit's own declared range directly, and
compatibility was therefore tested rather than assumed.

No direct production dependency on `esbuild` was added. Drizzle ORM was not
upgraded. Drizzle Kit remains `0.31.11`.

## Dependency graph

Before: `esbuild@0.18.20` (vulnerable), `esbuild@0.25.12`, `esbuild@0.28.2`.

After: `esbuild@0.25.12` only — in the lockfile and on disk. Verified by
`bun why esbuild`, by lockfile inspection, and by enumerating every installed
`esbuild/package.json`.

Unrelated pins unchanged: drizzle-orm `0.45.4`, drizzle-kit `0.31.11`,
pg `8.23.1`, zod `4.6.5`, pino `10.4.0`, TypeScript
`5.9.3`, Biome `2.5.15`. `packages/database/package.json` is untouched.

## Compatibility

Verified in an isolated copy with a clean install:

- `drizzle-kit --version` reports `drizzle-kit: v0.31.11`, `drizzle-orm: v0.45.4`.
- The CLI help and `export` command load normally; the committed
  `drizzle.config.ts` is read without error.
- Migration tooling typechecks; `bun run typecheck` exits 0.
- The runtime database package builds; `bun run build` exits 0.
- All unit and integration tests pass unchanged.

### A pre-existing defect found, and deliberately not fixed

`drizzle-kit generate` emits a spurious `0001_*.sql` containing
`CREATE SCHEMA "core";` **with or without this override**. A control run from
a pristine checkout of the starting commit, with no override at all, produces
the same migration. The cause is that the committed `0000_snapshot.json`
records `"schemas": {}` — the `--custom` baseline captured no tables, so the
empty `core` schema is absent from the snapshot and is rediscovered as a diff
on the next generation.

This is an FND-011 artifact, unrelated to the advisory, and fixing it would
require editing `migrations/core/meta/0000_snapshot.json`, which this task
does not authorize. It is reported for a separate task. It does not affect
applying migrations, which never regenerates.

## Migration integrity

`git status packages/database/migrations/` is empty. No migration SQL, journal
entry, or snapshot was created, modified, or deleted.

```text
0000_baseline_core_schema.sql  sha256 26da2228e519c5e3be983d125436bc9857cce9dce77b2f27b73be8e0d5443733
meta/_journal.json             sha256 c078beca09b603d49745330d8d44844538697738253c11ff26a2a3b1804b876e
```

Both hashes match the values recorded during FND-011. All generation testing
was performed in disposable directories under `/tmp`; the working tree
contains no stray migrations.

## Verification results

| Command | Exit |
| --- | --- |
| `bun install --frozen-lockfile --ignore-scripts` | 0 |
| `bun run lint` | 0 |
| `bun run format:check` | 0 |
| `bun run typecheck` | 0 |
| `bun run build` | 0 |
| `bun run test` | 0 |
| `bun audit` | **0 — no vulnerabilities** |

- Ordinary root testing: **441 pass, 26 skip, 0 fail**, 1,490 assertions, 16 files.
- With PostgreSQL integration enabled: **465 pass, 0 fail**, 1,555 assertions.
- Integration suite alone: **24 pass, 0 fail** against a disposable
  PostgreSQL 18.6 container.
- FND-011 baselines preserved exactly. Zero failures.

No forbidden command was used: no `bun audit --production`, no
`bun audit --ignore`, no `bun update`, no `bun update --latest`. The advisory
was not suppressed, the threshold was not lowered, and the CI audit step was
not removed or modified.

## Database safety

Integration tests used a disposable container with `--tmpfs` and removed only
their own container. Verified afterwards: developer container healthy,
volume `business-os-local_business_os_postgres_data` intact, 0 tables, 0
`business_os_migrator` roles, 0 stray `fnd011-it-*` containers. No production
or staging database was contacted.

## Clean checkout

An isolated checkout with no `node_modules` and no `dist`, built only from
committed files, passed every command above including `bun audit` = 0. The
Bun install cache was deleted and `bun audit` re-run from the lockfile alone:
still 0 vulnerabilities. Resolved esbuild on disk: `0.25.12` only.

## Lockfile

- SHA-256 before: `26b77a441ea641accc65aef4aa58f1d7334a6202f06123615d387fd789b2ffa7`
- SHA-256 after: `ed107f9948285179f0ef1f4dc61bee04d8a9a1284fbce6eb119212c07f375f1d`
- Regenerated solely by `bun install`; never hand-edited.
- `bun install --frozen-lockfile --ignore-scripts` succeeds both immediately
  and on repetition, and the hash is unchanged by the second install, so the
  lockfile is deterministic.
- Lockfile format unchanged (text `bun.lock`, workspace format v1); read
  correctly by Bun 1.3.14, which satisfies the repository's `engines` field
  `>=1.2.0 <2`.
- No unexpected duplicate vulnerable versions: `esbuild@0.18.20` appears zero
  times.

## Files

Modified: `package.json` (adds the `overrides` block only), `bun.lock`.
Created: this document.
Total: exactly three authorized files.

No change to `agent/`, `AGENTS.md`, `.github/`, `packages/`, `deployments/`,
`.env.example`, `README.md`, `biome.json`, `tsconfig.base.json`, migration
SQL, database roles, configuration parsers, or any FND-011 implementation
file.

## Known limitations

1. Bun 1.3.14 cannot express a dependency-scoped esbuild override, so `tsx`'s
   esbuild is normalised from `0.28.2` to `0.25.12` rather than left alone.
   Compatibility was tested; the authorization's "whenever possible"
   condition cannot be satisfied on this Bun version.
2. A root-level override constrains every workspace in the monorepo. A future
   dependency that genuinely requires `~0.28` would be silently redirected.
   This should be revisited if esbuild is ever needed elsewhere.
3. `drizzle-kit generate` emits a spurious `0001_stale_violations.sql`. This
   is pre-existing and override-independent; see above.
4. GitHub Actions status is not observable from this environment.
5. The `originn` public push requires credentials not present here.
6. The integration suite is still opt-in and therefore absent from CI, which
   this task does not change.

## Independent review status

AWAITING_INDEPENDENT_REVIEW

Not self-approved, and FND-011 is **not** independently approved by this task.
The reviewer should specifically confirm the Bun override-syntax finding, the
`tsx` esbuild normalisation, and that no unrelated package was upgraded.
