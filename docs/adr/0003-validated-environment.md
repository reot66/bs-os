# ADR-0003 — Validated Environment Foundation

Status: Accepted for FND-008

## Context

Business OS is building a shared platform foundation that every later industry
solution must reuse: e-commerce, clinics, and restaurants will all need
applications, workers, background jobs, payment integrations, and domain
modules. Each of those will need configuration, and today there is no single
definition of which environment variables exist or how they are validated.

Without a central definition, each package tends to parse raw environment
strings itself. That produces duplicated parsing, inconsistent defaults, and —
most seriously — unsafe handling of credentials, because a developer who
reinvents a parser rarely adds secret redaction or fail-fast validation.

Rule 11 already requires a typed registry in which every configuration entry
declares `key`, `type`, `default`, `scopes`, `validation`, `visibility`,
`dynamic/restart-required`, and `version`, and it requires unknown keys to be
rejected. D-060 requires Configuration, Feature Flag, Entitlement, Secret, and
Environment to remain separate concerns. Rule 05 requires centralized secret and
PII redaction. Rule 13 requires stable error codes.

ADR-0001 selected Bun as the runtime and package manager. ADR-0002 confirmed Bun
as the current development and production runtime, selected Drizzle ORM with
`pg`, and committed to portable shared code without an active Node.js migration.

The owner explicitly approved the **Advanced** capability level for the
environment foundation.

## Decision

### Validation library

Use **Zod 4** as the validation library, as an exact runtime dependency of
`@business-os/configuration`.

Types for validated output are inferred from the Zod schemas wherever
practical, so the runtime shape and the declared type cannot drift apart.

Zod 4 is the current stable major line. No second configuration library, no
`dotenv`, no schema validator alternative is permitted alongside it.

### Source of truth

`@business-os/configuration` is the single authoritative definition of every
supported `BUSINESS_OS_*` variable. Each variable has exactly one definition
containing its validation schema and its metadata. There is no parallel
registry, and no enum is defined twice.

### Why the existing package is extended rather than replaced

`@business-os/configuration` already owns runtime environment bootstrap
validation and already exports the canonical runtime environment and log level
lists. Creating a second configuration package would split one responsibility
across two competing sources of truth, which rule 11 and D-060 both discourage.
Extending the existing package preserves a single entry point and keeps the
previously approved public contract intact.

### Separation of concerns

Environment remains distinct from Configuration, Feature Flag, Entitlement, and
Secret. This package defines and validates **environment variables only**. It
does not implement hierarchical tenant or business configuration, a flag
service, an entitlement system, or a secrets vault.

A variable may be *classified* as sensitive without this package becoming a
secret-management service: classification drives redaction, not storage.

### Registry metadata and secret classification

Every definition carries: variable name, Zod schema, category, owning subsystem,
parser scope, parser group, required/optional, default value, sensitivity,
display-safety, restart-required status, and a short description.

Secret classification is declared once, on the registry entry. Redaction in
diagnostic summaries is derived from that metadata rather than from a second
hand-maintained list of secret keys, so the two cannot drift apart.

### Explicit injection at application boundaries

The library accepts an explicitly supplied object of environment values. It never
reads `process.env`, `Bun.env`, or `.env`, and it never mutates global state.
Automatic `.env` loading remains a concern of the application entry point and of
developer tooling, not of the shared library.

This keeps the library pure, testable, and portable, and it keeps a secret from
being captured implicitly in an import.

### Fail-fast validation

Parsing fails fast and rejects invalid input rather than repairing it. Notably,
permissive coercion is deliberately avoided:

- Database ports are converted from a decimal integer string and rejected for
  zero, negatives, fractions, non-numeric text, `Infinity`, `NaN`, empty, and
  whitespace-only values. `z.coerce.number()` is not used because it silently
  turns `""` and `"   "` into `0`.
- Booleans accept only the exact strings `true` and `false`. `Boolean("false")`
  evaluates to `true`, so it is never used.

Validation errors are sanitized. A failure exposes a stable error code and the
variable name only. It never exposes the rejected value, the environment object,
a connection string, or a raw Zod issue, and no unsanitized Zod error is attached
as a public `cause`.

### Production TLS policy

TLS must be an explicit decision, never an implied default. A `production` runtime
configuration may not be produced with TLS disabled; that combination is rejected.
Local PostgreSQL is loopback-bound and may explicitly use `ssl: false`, which is
a deliberate local exception rather than a default.

### Template drift detection

`.env.example` is treated as documentation that must agree with the registry. A
root-level test compares the committed template against the registry and fails on
missing variables, unknown variables, duplicates, or a credential that is not a
placeholder. The test reads only `.env.example` and never the developer's real
`.env`, so it is safe to run anywhere, including CI.

### Boundary validation is retained

`@business-os/database` keeps its own package-boundary validation of connection
configuration. Central environment definitions do not replace per-package input
validation: every package still validates what is handed to it, because a future
caller may supply configuration from a source other than environment variables.

FND-008 introduces no dependency from `@business-os/database` to
`@business-os/configuration`, so no cyclic workspace dependency is created. The
runtime configuration shape is deliberately compatible with the database
package's input contract, so wiring remains a later, separately reviewed task.

### Runtime

Bun remains the development and production runtime, package manager, and test
runner. No Node.js deployment, no Node.js CI, and no runtime migration is
authorized.

Shared configuration code uses standard JavaScript and standard TypeScript. The
package performs no `console` or `stdout`/`stderr` writes, which keeps it usable
from any runtime and keeps diagnostics under the caller's control.

### Consumed later by

Future application entry points will parse runtime environment once and pass the
validated result inward. Local developer tooling will use the local
administration parser. `@business-os/logger` will consume the registry's
redaction metadata rather than maintaining its own list of secret keys. None of
those consumers are implemented here.

## Alternatives considered

### A new, separate environment package

Rejected. Two packages owning environment definitions would recreate exactly the
duplication this decision removes, and would split the approved bootstrap
contract across two entry points.

### Keeping hand-written validators

Rejected. Hand-written validation tends to omit secret redaction, coerce
incorrectly, and diverge between call sites. Zod provides one schema that is both
the validator and the source of the inferred output type.

### `z.coerce.*` for ports and booleans

Rejected. Permissive coercion silently accepts `""`, whitespace, and `"false"` as
truthy or zero, which is exactly the class of bug that leaks configuration
errors into production.

### Reading `process.env` inside the library

Rejected. Implicit global reads make the library untestable without global state,
capture secrets at import time, and couple shared code to a specific runtime
loading strategy.

### Exposing raw Zod errors

Rejected. Zod issues can carry input values, and one of the inputs is a
credential. The public error contract is therefore sanitized by construction.

### Implementing flags, entitlements, or a secrets vault here

Rejected. Rule 11 and D-060 require these to stay separate, and each needs its
own approved task and design.
