# ADR-0005 — Structured Logging

Status: Accepted for FND-010

## Context

Business OS will run API services, background workers, scheduled jobs, database
operations, authentication and authorization flows, external integrations, and
platform administration, each of them serving several industries. Rule 05
requires structured JSON logs, correlation and request identifiers, and
centralized secret and PII redaction. D-054 commits the platform to structured,
auditable, supportable behaviour.

Without a shared foundation, every module invents its own logging. That produces
inconsistent formats that cannot be aggregated, duplicated parsing, and —
most seriously — inconsistent leakage, where one service logs an authorization
header or a raw database error and another does not.

Two prior decisions make this possible. FND-008 established an authoritative
environment-variable registry with secret classification. FND-009 established
stable error codes, categories, retryability, and a safe public error boundary
whose identity guard was hardened in FND-009-FIX1 and FND-009-FIX2.

ADR-0001 and ADR-0002 confirmed Bun as the current development and production
runtime, with portable shared code and no active Node.js migration.

## Decision

Adopt `@business-os/logger` as the shared logging foundation, using **Pino**
10.4.0 as the internal engine.

### Dependency direction

```
@business-os/logger ──> @business-os/configuration
                   ├──> @business-os/errors
                   └──> pino
```

The logger depends on configuration and errors. Neither depends on the logger,
so there is no cycle. Pino is pinned to an exact version and is the only
third-party dependency; there is no development dependency.

### Public interface

Business modules see only `createLogger`, the `BusinessOsLogger` interface
(`debug`, `info`, `warn`, `error`, `child`, `logError`), and types. The raw Pino
instance is never exposed, and there is no `raw()` method, so a module cannot
disable redaction, change the destination, or reach an unfiltered serializer.
Replacing the engine later would not require domain-code changes.

### Output format

Every record carries `level`, `time` in epoch milliseconds, `service`, and
`msg`. `module`, `correlationId`, and `requestId` appear when known. Caller
metadata is nested under `context` rather than spread into top-level fields, so
`level`, `time`, `msg`, `service`, and `error` cannot be overridden by metadata
keys. Process identity (`pid`, `hostname`) is deliberately not logged.

### Redaction

Redaction is a centralized structured sanitizer used for arbitrary metadata, not
a set of hand-written path strings. Key recognition has two sources:

1. The environment-variable registry exported by `@business-os/configuration`.
   Any variable that registry marks as sensitive is recognized automatically,
   so a newly registered secret needs no change to the logger.
2. A generic credential-like key list covering `password`, `token`,
   `authorization`, `cookie`, `apiKey`, and similar names, matched with
   normalized casing and separators so `userPassword`, `db_password`, and
   `access-token` are all recognized.

Pino's own path-based redaction is configured with a small **static** list as
defense in depth for predictable top-level fields. No redaction path is ever
constructed from caller input. Pino's default path semantics are case-sensitive
with bounded wildcards and are not relied upon for arbitrary-depth keys.

The sanitizer walks descriptors rather than properties, so accessors are never
executed; it never calls `toString` or `toJSON`; and it bounds depth, keys per
object, array length, string length, and total visited nodes. Circular
structures, hostile proxies, and revoked proxies resolve to a placeholder rather
than being inspected or throwing.

**Known limitation, stated explicitly:** key-based redaction cannot detect a
secret placed in an ordinary field with an innocuous name, nor a secret embedded
in a free-form log message. This protects keys, not values. Callers must not put
secrets into message strings, and must prefer structured metadata.

### Errors

`logError` converts any thrown value through the shared errors package, so the
strict genuine-error identity guard from FND-009-FIX2 is the boundary. The
emitted summary contains only `code`, `category`, `retryable`, and the catalog
message. Causes, stacks, internal diagnostic messages, and private context are
never included, and an untrusted value can never select its own error code.

The summary is emitted under an `error` key rather than Pino's reserved `err`
key. That is deliberate: Pino applies its standard error serializer to `err`,
which mutates the value it receives, and a frozen safe summary would break it.
Keeping our summary off `err` also keeps the raw-error serializer away from our
data by construction.

### Context

Context is a small closed set: `service`, `module`, `correlationId`,
`requestId`. Only these are promoted to trusted top-level fields; any other key
is ignored, so a caller cannot place an arbitrary value into a trusted field.
Correlation and request identifiers are bounded to 64 characters and restricted
to letters, digits, and hyphens — the shape of UUID, ULID, hex trace IDs, and
short request IDs. Authored names such as service and module allow a wider
character set. The logger never generates identifiers; the request boundary or
job coordinator supplies them. No tenant or business identifier is accepted, and
no tenant authorization is implemented.

### Transport independence

No HTTP middleware, request handling, status mapping, or transport plugin exists
in this package. The same logger serves CLI tools, workers, jobs, services, and
future API handlers. HTTP-specific concerns belong to a future adapter.

### Runtime

Bun remains the development and production runtime. The package uses only
standard JavaScript APIs plus Pino's Node-compatible surface: no `bun:` import,
no `Bun.*` global, no environment read, no filesystem or network access, no
background worker, and no import-time side effects. The build emits portable
Node-targeted ESM with every dependency external.

## Alternatives considered

### Console logging

Rejected. Console output is unstructured, unfilterable, inconsistently
formatted, and trivially bypasses redaction.

### Winston

Rejected. Comparable capability to Pino but with more transitive weight and no
advantage for this platform. One engine is enough.

### A custom JSON logger

Rejected. Reimplementing levels, serialization, and destinations would duplicate
a mature, security-reviewed library and would still need our redaction layer.

### Pino used directly in every domain module

Rejected. It would let any module bypass redaction, reach the reserved `err`
serializer with raw errors, or reconfigure the destination, and it would couple
every domain to Pino's types.

### Logging to an external service immediately

Rejected. Transport, buffering, shipping, and vendor SDKs are deferred. The
destination is injectable so aggregation can be added later without changing
domain code.

## Consequences

### Benefits

- One consistent, aggregatable record format across every module and industry.
- Secrets from the central registry are redacted automatically, with no second
  list to maintain.
- A structural security boundary: metadata is sanitized before it reaches Pino,
  so there is no way for a caller to reach the raw serializer.
- Errors are summarized through the approved contracts, so a database driver
  error cannot leak SQL, a host, or a connection string into logs.
- The engine can be replaced later without touching domain code.

### Costs and obligations

- Central sanitization costs work per record; bounded limits trade completeness
  for predictable cost, and truncation markers make that visible.
- An innocently named field can still carry a secret. The boundary is
  cooperative and documented, not absolute.
- `logError` deliberately loses the original message and stack in the log. That
  is the price of not leaking; correlation identifiers and separate audit or
  diagnostic channels must carry investigations.
- Children are created by binding onto a new Pino instance, so very large
  numbers of distinct children would cost memory.

### Future work

HTTP request context, `AsyncLocalStorage` propagation if justified, central log
aggregation, distributed tracing, metrics, a separate business audit log, and
error integration for the existing database and configuration packages. None of
these are implemented here.
