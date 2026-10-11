# ADR-0001 — Bun.js Development Toolchain

Status: Accepted for FND-002

## Context

Business OS requires a reproducible, maintainable monorepo supporting a modular
platform and multiple business industries.

The repository is governed by D-052 (Monorepo) and the Repository & Module
Standard, which prescribe a `packages/` layout including `packages/contracts/`.
The platform is TypeScript-first and requires strict type checking, typed
contracts, a native test tier, and deterministic dependency installation
(D-063, D-066). No decision in the Decision Register prescribes a specific
JavaScript runtime or package manager, so this choice does not override an
existing approved decision.

## Decision

Use Bun.js as the JavaScript/TypeScript runtime and package manager.

Use Bun workspaces, native test runner, native bundler, and the text-based
`bun.lock`.

Keep TypeScript strict checking and declaration generation available.

## Reasons

- Integrated runtime, package manager, test runner, and bundler.
- Reduced initial toolchain complexity.
- Native TypeScript execution.
- Monorepo workspace support.
- Reproducible dependency installation.
- Suitable foundation for later modular application development.

## Trade-offs

- Runtime compatibility must be tested for future dependencies.
- Some tools may require additional compatibility verification.
- Future production deployment must explicitly support Bun.

## Consequences

- All future JavaScript/TypeScript applications must follow this Bun-first
  architecture unless the owner approves a separate exception.
- The backend framework and frontend framework remain undecided.

## Version evidence

Exact Bun version used during FND-002:

```
bun --version
1.3.14
```

Exact TypeScript version pinned in the root `package.json` devDependencies and
resolved in `bun.lock`:

```
5.9.3
```

`bun.lock` is the text-based JSONC lockfile format (`lockfileVersion: 1`,
`configVersion: 1`). The binary `bun.lockb` format is not used and is not
committed.