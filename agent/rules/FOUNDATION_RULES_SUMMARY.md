# Foundation Rules v1.0 — خلاصه قوانین غیرقابل‌نقض

این سند Index قوانین Foundation است. جزئیات در `rules/` قرار دارد.

## A. Product & Domain

- Core کوچک بماند.
- هر Feature Domain Owner داشته باشد.
- Feature قبل از Coding به Core / Module / Integration طبقه‌بندی شود.
- Vertical به‌صورت پیش‌فرض Pack است، نه Module.
- Customer identity canonical است.
- Business domain apps خودمان ساخته می‌شوند؛ whole OSS apps به‌صورت پیش‌فرض runtime core نیستند.
- هر قابلیت non-trivial از Capability Level Gate عبور می‌کند.

## B. Modularity

- Module -> Core مجاز.
- Core -> Module ممنوع.
- Direct cross-module DB access ممنوع.
- Cross-module communication از Contract/Event/Service interface.
- هر Module Manifest دارد.
- permissions/events/usage/config/data governance ownership باید explicit باشد.

## C. Tenancy & Security

- Tenant security/billing boundary است.
- Business operational entity است.
- Branch day-one entity است.
- Full Scoped RBAC.
- Request Security Context رسمی.
- Tenant/business IDs از client blindly trusted نمی‌شوند.
- Shared SaaS: Application scope + Repository scope + PostgreSQL RLS.
- cache/storage/queue/event/webhook هم tenant-aware.

## D. Data

- PostgreSQL source of truth.
- Core schema + module schemas.
- canonical IDs و ownership.
- UUIDv7 پیشنهادی برای IDs داخلی.
- UTC timestamps.
- Money typed/canonical.
- JSONB جای schema design نیست.
- transaction داخل domain boundary؛ eventual consistency بین moduleها در صورت مناسب.
- reliable flows: Outbox/Inbox.

## E. APIs

- REST-first.
- Typed/schema-driven contracts.
- Business logic داخل route ممنوع.
- shared error model.
- pagination برای lists بزرگ.
- idempotency برای commands حساس.
- long-running work async job.
- public API versioned و deprecated safely.

## F. Integrations

- Provider Interface + Adapter.
- Business Module provider-specific code را hardcode نکند.
- credentials در Secret Store.
- Webhook Inbox + signature + idempotency.
- provider errors به canonical errors map شوند.

## G. Billing

- Billing != Payment.
- Product != Price.
- Product code plan name را hardcode نمی‌کند.
- Effective Entitlements access را تعیین می‌کند.
- Module usage metric را تعریف می‌کند، Billing قیمت را.
- Price/version/history immutable-ish.

## H. Config & Flags

- Config != Flag != Entitlement != Secret != Environment.
- business settings داخل env vars نباشند.
- typed config registry.
- no customer-specific branches in code.
- flags دارای lifecycle/owner/review هستند.

## I. Reliability

- backups + PITR + restore tests.
- object storage durability.
- DR runbooks.
- jobs/webhooks idempotent.
- Expand-Migrate-Contract برای تغییرات DB حساس.

## J. Scale

- stateless apps where possible.
- API/storefront/workers independent scaling.
- async heavy tasks.
- queue workload isolation.
- CDN/published versions for public site.
- no premature sharding/microservices/Kubernetes dependency.
- extract service only with operational reason.

## K. Observability & Support

- structured logging.
- correlation/request IDs.
- metrics/tracing/health.
- technical logs != audit logs.
- support via audited control plane, not normal DB surgery.
- error code registry.

## L. Testing

- unit + integration + contract + tenant isolation + migration + critical E2E.
- real PostgreSQL integration tests.
- flaky tests are broken tests.
- critical bug -> regression test where possible.
- main remains deployable.

## M. Frontend

- one design language.
- design tokens and shared components.
- RTL/LTR from start.
- module registry drives nav/routes.
- frontend permission checks are UX only; server authoritative.
- lazy module loading.

## N. CI/CD

- trunk-based + short branches.
- PR gates.
- immutable artifacts.
- build once/deploy many.
- staging production-like.
- deploy != release.
- feature flags for rollout.
- no normal manual production edits.

## O. Supply Chain

- dependency additions reviewed.
- lockfile/deterministic installs.
- vulnerability/license/secret scanning.
- critical deps owned.
- containers minimal/non-root where possible.
- no custom cryptography.

## P. Privacy

- data classification + PII registry.
- collect minimum necessary.
- retention/export/delete/anonymize policies.
- support masking.
- privacy-sensitive operations audited.
- AI-derived data under governance.

## Q. Governance

- architectural decisions recorded as ADR.
- decisions not silently changed.
- generated docs for contracts/catalogs where possible.
- technical debt recorded.
- exceptions scoped/owned/reviewed.
