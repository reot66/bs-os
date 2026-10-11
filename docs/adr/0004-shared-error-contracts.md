# ADR-0004 — Shared Error Contracts

Status: Accepted for FND-009

## Context

Business OS will contain shared platform modules, an advanced e-commerce
solution, clinic services, restaurant services, background jobs, external
integrations, database operations, and eventually API servers and
event-processing systems. Every one of those will fail in ways callers must
handle.

Rule 05 requires a standard error contract and a central error-code registry,
with centralized secret and PII redaction. Rule 13 requires stable error codes
and forbids clients from parsing error text. D-054 commits the platform to a
structured, auditable, supportable error surface.

Without a shared foundation, each application would invent its own error
format. That produces inconsistent contracts, duplicated catalogs, unstable
error text that clients end up parsing, and — most seriously — inconsistent
leakage, where one service returns a raw PostgreSQL or Zod message and another
returns a safe one.

The reverse failure is also a risk: a shared package so rigid that a domain
cannot express its own errors. Industry modules will need product inventory,
payment settlement, clinic appointment, and restaurant reservation failures.
Those codes must be addable by later approved domain packages without editing
every infrastructure package.

ADR-0002 confirmed Bun as the current development and production runtime, with
portable shared code and no active Node.js migration.

## Decision

Adopt `@business-os/errors` as the common error foundation.

### Error catalog

One centralized catalog of stable codes is the single source of truth. Each code
declares a category, a safe default public message, and an explicit
retryability flag. No other module may duplicate the list, the classifications,
or the messages. Codes are typed, so an unknown code is a compile error, and the
catalog is frozen at runtime so neither it nor a nested entry can be mutated.

Initial platform codes:

| Code | Category | Retryable |
| --- | --- | --- |
| `VALIDATION_ERROR` | validation | no |
| `UNAUTHENTICATED` | authentication | no |
| `FORBIDDEN` | authorization | no |
| `NOT_FOUND` | authorization | no |
| `CONFLICT` | domain | no |
| `PRECONDITION_FAILED` | domain | no |
| `BUSINESS_RULE_VIOLATION` | domain | no |
| `RATE_LIMITED` | infrastructure | yes |
| `DEPENDENCY_UNAVAILABLE` | infrastructure | yes |
| `OPERATION_TIMEOUT` | infrastructure | yes |
| `INTERNAL_ERROR` | internal | no |

Industry-specific codes are deliberately **not** included. Product inventory,
payment settlement, clinic appointment, restaurant reservation, and tenant
billing errors belong to future domain packages under separately approved
contracts. The catalog is a foundation, not a speculative backlog.

### Retryability semantics

`retryable` means only that retrying the same operation **may** be appropriate.
It never triggers a retry. Retry safety depends on idempotency, transaction
state, rate limits, and caller policy. A timeout on a non-idempotent write is
still unsafe to retry even though the code is retryable.

### Internal versus public errors

Internal diagnostics and public responses are strictly separated.

An internal message, an original `cause`, and private diagnostic context are
preserved for trusted debugging, but they are never serialized. `internalMessage`
and `context` are non-enumerable, `cause` is non-enumerable native cause
behaviour, and `JSON.stringify` is routed through `toJSON()` so the result
contains exactly `code`, `message`, and `retryable`.

Public messages are generic and stable. They never contain SQL, connection
strings, credentials, tokens, stack traces, file paths, driver messages, private
user information, medical information, or payment data. A caller cannot override
the catalog message, so an internal exception message can never leak through the
public field.

Raw `Error` objects and internal diagnostic messages are **not** automatically
safe to log. A later logger task will define the redaction policy; this record
does not provide one.

### Transport independence

The package contains no HTTP status codes, response builders, or middleware.
Mapping an error onto a transport belongs to a future API adapter, so the same
definitions serve HTTP APIs, workers, scheduled jobs, domain services, event
handlers, and CLI applications.

The package also does not decide whether an API should reveal that a tenant
resource exists. That authorization decision belongs to the application and
security boundary, not to the error layer.

### Runtime portability

Bun remains the development and production runtime. The package uses only
standard JavaScript `Error` capabilities and has no third-party dependencies,
no Bun-specific API, and no import from any other Business OS package. The build
emits portable Node-targeted ESM as an output choice, not as a runtime change.

### Existing packages

`BootstrapConfigError`, `EnvironmentConfigError`, `DatabaseConfigError`, and
`DatabaseConnectionError` remain unchanged. They are not made to extend
`BusinessOsError`, their codes, constructors, and tests are untouched, and no
existing package gains a dependency on this package in FND-009.

Their mapping onto the catalog (for example invalid environment →
`VALIDATION_ERROR`, database unavailable → `DEPENDENCY_UNAVAILABLE`) requires
deliberate review in a separate migration task. Database exceptions must not be
classified as transient automatically, and Zod errors must not be converted
mechanically into public validation responses. Domain validation and external
input validation remain distinct.

## Alternatives considered

### `throw new Error()` everywhere

Rejected. Unstructured errors force callers to match on message text, which is
exactly what rule 13 forbids, and they carry no stable classification, no
retryability, and no safe public message.

### Leaking raw framework and driver exceptions

Rejected. A raw PostgreSQL error can disclose schema details and query values; a
raw Zod error can contain the submitted input, including passwords and tokens.
Returning either publicly is an information-disclosure defect, not a shortcut.

### A large third-party error framework

Rejected. An error library would add a runtime dependency to the most
infrastructure-sensitive package in the repository, and the required surface is
small: a catalog, one class, and a safe conversion. Standard JavaScript `Error`
covers the rest.

### Duplicated catalogs per application

Rejected. Duplication is how contracts drift apart and how one application ends
up exposing sensitive detail while another does not. A single catalog is the
point of this decision.

### A retry engine

Rejected. Retry policy needs idempotency keys, transaction state, and backoff
policy that this package has no basis to decide. The catalog carries advisory
metadata only.

### An exception-handling dependency-injection container

Rejected. Unnecessary complexity for a layer that needs a class and a converter.

## Consequences

### Benefits

- One consistent contract across every industry and every service type.
- Stable codes that clients can branch on instead of parsing text.
- A privacy boundary that holds by construction rather than by convention:
  internal diagnostics cannot reach a serialized payload.
- Retryability metadata available to callers without a retry engine.
- Domain codes can be added later by domain packages without editing this one.

### Costs and obligations

- Existing packages must be migrated deliberately in a separate task; until then
  the codebase has two error styles.
- The catalog must be maintained: adding a code means choosing a category, a
  safe message, and a retryability value.
- Retryability can be misread as permission to retry; the documentation must
  keep restating that it is advisory.
- Future domain packages must extend the contract deliberately rather than
  inventing parallel catalogs.
- Future logging must define its own redaction policy, because raw internal
  errors remain unsafe to log by design.

### Limitations

Protecting a public payload is not the same as making internal errors safe to
log. A trusted diagnostic system can still inspect the cause, the internal
message, and the private context, and nothing here redacts them. That is
intentional: trusted debugging needs the detail, and the privacy boundary is
enforced at the serialization edge.
