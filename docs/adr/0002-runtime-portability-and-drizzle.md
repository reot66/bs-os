# ADR-0002 — Runtime Portability and Drizzle ORM

Status: Accepted for FND-007

## Context

FND-006 established a local PostgreSQL 18.6 development service. FND-007 needs a
shared data-access layer so that future applications and modules can reach the
database consistently.

Two questions must be settled before any schema exists:

1. Which ORM and driver provide database access?
2. How tightly should shared code bind to the Bun runtime?

The repository is governed by D-043 (cloud-agnostic strategy with
Docker/PostgreSQL) and D-044 (PostgreSQL with independently owned Core and Module
schemas). D-063 requires real PostgreSQL integration tests. Rule 06 requires
defense in depth down to PostgreSQL row-level security and states that the
runtime database user is not a superuser. Rule 11 keeps environment variables
limited to bootstrap and infrastructure.

ADR-0001 selected Bun as the JavaScript runtime and package manager. No approved
decision prescribed an ORM, a driver, or a production JavaScript runtime, so
these choices do not override an existing approved decision.

The historical `LEGACY_MASTER_PRD_V1.md` already lists Drizzle ORM as the
data-access choice with Drizzle-dependent repository code placed in
`packages/database`, which is consistent with this record. Its pinned version
numbers are historical and are not adopted here.

## Decision

### Current runtime

Bun is the development runtime **and** the production runtime. Bun is also the
package manager, workspace manager, test runner, and bundler. Bun `1.3.14` is
the approved version. There is no Node.js deployment.

### Database technology

- PostgreSQL 18.6 is the database engine.
- Drizzle ORM is the selected ORM.
- `pg` (node-postgres) is the selected PostgreSQL driver.
- TypeScript is the implementation language.

Drizzle is used through its supported PostgreSQL integration:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
```

`pg` provides the connection pool.

### Runtime portability

Bun may be replaced as the production runtime in the future, but no migration is
authorized or planned. Accordingly:

- Shared business and database code prefers standard TypeScript and standard
  JavaScript APIs.
- Shared code prefers portable interfaces over runtime-specific globals.
- Bun-only APIs are confined to Bun-specific tools and adapters.
- Infrastructure dependencies stay behind defined boundaries so individual
  components can be replaced without rewriting business domains.
- Shared database code is built as Node-compatible ESM with
  `bun build --target node --format esm --packages external`.

The Node build target is a portability-oriented output setting. It does **not**
change the production runtime, and it does not make runtime migration
zero-effort.

### Database architecture

- Connections are created explicitly through a shared factory; the caller owns
  the lifecycle.
- No module creates a connection at import time.
- No global database singleton exists.
- Configuration is passed explicitly. The shared package never reads
  `process.env`, `Bun.env`, or `.env` files.
- TLS behaviour is explicit and required, never implied by a default.
- Runtime connections use a dedicated least-privilege application role.
- Schema migration privileges are separate and out of scope for FND-007.
- Tenant-scoped authorization and row-level security belong to future approved
  components, not to this layer.
- No automatic migration or schema change runs at service startup.

## Alternatives considered

### Bun's native SQL client

Rejected for the shared package. `bun:sql` is Bun-specific and would make the
shared data-access layer impossible to run on any other runtime, directly
conflicting with the portability requirement. It also cannot express the typed
schema-based query building the platform standard is moving toward. Bun's SQL
APIs remain available inside Bun-specific tools and adapters where that is
justified.

### Prisma

Rejected. Prisma carries its own engine and schema pipeline, a heavier runtime
footprint, and additional generated-client machinery. The platform standard is
SQL-first with explicit, reviewed migration files and independent module schema
ownership, which aligns better with Drizzle's SQL-shaped model. Prisma is not
introduced anywhere in this repository.

### Direct `pg` queries alone

Rejected as the primary data-access approach. Raw driver queries give no schema
types, no compositional query builder, and no consistent error shape. `pg`
remains the driver, but Drizzle provides the typed layer above it.

### A custom ORM or generic repository framework

Rejected. Drizzle already supplies typed schema definitions, query building, and
migrations support. Building an equivalent abstraction would duplicate a mature
library, add maintenance burden, and conflict with D-068's documentation and
maintenance discipline. Repositories will be introduced later only where a
concrete domain requirement exists, and they will depend on database access
boundaries rather than on Drizzle directly.

### Hoisted dependency installation

Rejected in FND-005-FIX1 and unchanged here. Isolated installation is retained
so packages cannot silently use dependencies they did not declare.

## Consequences

### Benefits

- Shared data access is portable across JavaScript runtimes by construction,
  because it depends on standard APIs only.
- Drizzle provides typed, parameterized SQL with explicit control, keeping the
  database recognizable rather than hidden behind a generated abstraction.
- Swapping the ORM later affects the shared infrastructure package, not business
  domains.
- Schema ownership stays aligned with D-044 because Drizzle models schemas per
  module.
- Portable ESM output is produced today without a second build tool.

### Performance

Drizzle adds a thin query-building layer over `pg`, with negligible overhead
relative to network and database time. Bounded pools and explicit timeouts keep
resource usage predictable. Query-level performance tuning is deferred until
real workloads exist.

### Driver dependency

`pg` becomes a direct runtime dependency. It must be declared explicitly by
consumers through workspace dependencies, per FND-005-FIX1.

### Migration responsibilities

FND-007 introduces no migrations and does not install `drizzle-kit`. The
intended future direction is Drizzle Kit with schema-first development,
versioned SQL migration files, a separate migration role, and explicit
migration execution. Those are architectural intentions for later approved
tasks, not current commitments.

### Security requirements

- Runtime database connections must use a non-superuser application role.
- Migration privileges must not be granted to the runtime role.
- TLS must be explicit; certificate validation must not be globally disabled.
- Passwords must never appear in URLs, logs, or error messages.
- Validation errors must identify the offending key without exposing values.
- Tenant isolation is not provided by this layer and must be implemented and
  tested separately, including row-level security.

### Future compatibility testing

Portability is a design goal, not a guarantee. If a runtime migration is ever
approved, compatibility of the built output, `pg` driver behaviour, TLS handling,
and the test tier must be evaluated and tested under that runtime before any
migration. This record does not claim that switching runtimes would be automatic
or would require zero changes.

### Alternatives remain open

Choosing Drizzle does not foreclose reconsideration later. A replacement would
be handled through a new decision record with explicit migration planning.