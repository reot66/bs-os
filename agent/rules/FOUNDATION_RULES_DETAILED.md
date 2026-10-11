# Foundation Rules — Detailed Approved Baseline (D-051 تا D-069)

## D-051 — Feature & Module Governance

- Core minimal باقی می‌ماند.
- Feature جدید قبل از coding Problem و Domain Owner دارد.
- هر feature به Core / Module / Integration طبقه‌بندی می‌شود.
- Data ownership صریح است.
- cross-module communication از contracts/events است.
- permission و scoped authorization تعریف می‌شود.
- scalable/billable feature usage metric تعریف می‌کند.
- Module Manifest اجباری است.
- Vertical Pack لزوماً Module نیست.
- backward-compatible contracts/migrations لازم‌اند.
- feature جدید mini-PRD/spec دارد.
- foundation/core change در صورت اساسی بودن ADR می‌خواهد.

## D-052 — Repository & Module Standard

- Monorepo رسمی است.
- Apps از Domain packages جدا هستند.
- Core و Module boundaries صریح‌اند.
- هر Module ساختار domain/application/events/permissions/usage/contracts/tests/manifest دارد.
- Domain به framework/ORM/UI وابسته نیست.
- Repository port داخل domain/application و implementation در data layer است.
- Integrationها adapter pattern دارند.
- Dashboard navigation از registry/module state ساخته می‌شود.
- Definition of Done مشترک است.

## D-053 — Versioning & Upgrade

- Platform و Moduleها version مستقل دارند.
- Semantic Versioning مبناست.
- Module compatibility requirement قابل اعلام است.
- DB migrations versioned هستند.
- Production migration از Expand → Migrate → Contract استفاده می‌کند.
- API/Event contracts backward-compatible evolve می‌شوند.
- Templateها versioned و customer override مستقل است.
- artifacts immutable هستند.
- Deployment Registry نسخه هر instance را می‌داند.
- shared/dedicated/standalone upgrade policy جداست.
- feature flags برای progressive rollout هستند.
- entitlement و flag دو مفهوم جدا هستند.
- health check/rollback plan برای upgrade لازم است.
- dependencies pin می‌شوند و major technology upgrades review/ADR می‌خواهند.
- architecture برای LTS آینده باز است.

## D-054 — Observability, Audit & Supportability

- structured logs از ابتدا.
- request/correlation ID در chain.
- tenant/business/module/deployment/version context در telemetry.
- metrics/tracing با OpenTelemetry-ready approach.
- error contract و error code registry مرکزی.
- Audit Log مستقل از technical logs.
- عملیات حساس audit می‌شوند و audit immutable-ish است.
- Support از Control Plane انجام می‌شود نه DB editing عادی.
- impersonation آینده controlled/audited/expiring است.
- liveness/readiness/dependency/business/integration health تفکیک می‌شوند.
- alert severity/SLO داخلی وجود دارد.
- secret/PII redaction سراسری است.
- incident/runbook فرآیند رسمی دارند.

## D-055 — Security & Tenant Isolation

- Authentication و Authorization جدا هستند.
- Tenant security/billing boundary و Business operational entity است.
- Request Security Context شامل actor/tenant/business/branch/scope است.
- payload client authority نیست.
- data Global یا Tenant-scoped classification دارد.
- Defense-in-depth: RBAC + application/repository scope + PostgreSQL RLS در shared SaaS.
- default deny برای cross-tenant.
- cache/storage/queue/events/webhooks tenant-aware.
- DB runtime user least-privileged است.
- API keys/integrations scoped هستند.
- secrets از normal data جدا.
- support/break-glass controlled/audited.
- dedicated same codebase با isolation بیشتر است.
- PII/security classification داریم.
- rate limit/abuse controls tenant-aware.
- tenant-isolation negative tests mandatory.
- MFA/session revocation/kill switch architecture آماده است.

## D-056 — Backup, DR & Data Lifecycle

- Backup != Disaster Recovery.
- RPO/RTO per deployment/tier تعریف می‌شود.
- PostgreSQL scheduled backups + PITR.
- Object storage versioning/backup.
- backup بدون restore test معتبر نیست.
- config/infra/secrets recovery strategy دارند.
- logical recovery از full DB restore جداست.
- soft delete/archive/hard delete/immutable domain-specific.
- recycle bin where valuable.
- retention registry.
- controlled tenant deletion workflow.
- tenant-level recovery در shared SaaS logical tooling لازم دارد.
- Dedicated/Standalone backup policy جدا.
- backup health registry/control plane.
- protected/immutable critical backups.
- sensitive migration requires healthy backup/PITR.
- DR drills/runbooks.
- reliable single region + off-site backup قبل از premature multi-region.
- jobs/webhooks idempotent.

## D-057 — Performance & Scalability

- Application layer stateless where possible.
- API, Storefront, Workers independent scaling.
- PostgreSQL remains OLTP source until evidence demands otherwise.
- connection pooling.
- tenant-aware indexes.
- list pagination/limits.
- heavy tasks async.
- queues isolated by workload and scalable independently.
- retry/backoff/DLQ/idempotency standard.
- cache only with explicit invalidation strategy.
- public websites publish immutable-ish versions and use CDN/cache.
- files served from object storage/CDN.
- Postgres search first; search provider abstractable.
- analytics evolves from OLTP queries to aggregates/warehouse as needed.
- high-volume telemetry separated from transactional events.
- quotas/rate limits prevent noisy neighbor.
- large import/export chunked async.
- partition/read replicas/sharding only when measured need exists.
- architecture keeps path to tenant placement/multiple DB clusters.
- Dedicated is scale/isolation valve.
- module extraction to service requires operational reason.
- performance/load/capacity/cost metrics matter.

## D-058 — Integration & Provider Abstraction

- Business Module external provider را مستقیم نمی‌شناسد.
- Provider Interface + Adapter.
- Module و Integration مستقل‌اند.
- Provider registry/manifest/capabilities.
- connection scoped to tenant/business/agency as applicable.
- credential config separated from secrets.
- platform-managed/business-managed credentials possible.
- canonical model maps provider payloads.
- inbound webhooks use signature verification + inbox + idempotency.
- important outbound domain events use transactional outbox.
- retry/backoff/failover capability-specific.
- health/status model formal.
- region/country/currency/locale declared.
- Money/time/phone canonical internally.
- provider errors mapped to internal categories.
- test/live/mock/sandbox support.
- adapter version/deprecation lifecycle.
- usage/cost metered.
- agency credential inheritance/override future-ready.
- first-party adapters first; SDK/marketplace later.

## D-059 — Billing, Entitlements & Usage

- Billing != Payment.
- BillingAccount جدا از operational Business.
- Product Catalog شامل plan/add-on/setup/service/usage products.
- Product != Price؛ price versioned.
- application plan name را hardcode نمی‌کند.
- Entitlement Engine دسترسی تجاری را resolve می‌کند.
- entitlement boolean/limit/policy-based.
- effective entitlements از defaults + plan + add-ons + contracts + overrides + grants.
- Feature Flag جدا.
- Module WHAT was used را می‌داند؛ Billing WHAT IT COSTS را.
- usage raw idempotent events سپس aggregate.
- meter types مثل counter/gauge/peak/storage پشتیبانی می‌شوند.
- hard/soft/metered enforcement.
- Subscription state machine با grace/restricted.
- data customer به‌خاطر non-payment نابود/گروگان نمی‌شود.
- Setup/Service/Software subscription جدا.
- manual و automated payments.
- Agency/Dedicated/Standalone مدل تجاری متفاوت ولی entitlement engine مشترک.
- effective entitlement snapshot/cache on request path.

## D-060 — Configuration, Flags & Environment

- Config, Flag, Entitlement, Secret, Environment جدا.
- env vars فقط bootstrap/infrastructure؛ business settings نه.
- hierarchy: Platform → Deployment → Tenant/Agency → Business → Branch/Module.
- typed registry با type/default/scope/validation/visibility.
- Module settings را اعلام می‌کند؛ central engine resolve می‌کند.
- dynamic vs restart-required config مشخص.
- config schema/migrations versioned.
- unknown keys rejected.
- feature flags برای rollout/experiment/kill switch.
- flag owner/lifecycle/review date و cleanup.
- effective config snapshot/cache.
- important config changes audited.
- secrets وارد config store عادی نمی‌شوند.
- customer-specific condition ممنوع.
- special needs via config/entitlement/flag/module/integration/extension.
- infra config-as-code؛ business config runtime-managed.
- environment secret isolation و staging parity.
- inheritance overridable/locked.
- UI effective state از permission + entitlement + flag + config + integration state.

## D-061 — Deep Data Architecture

- هر entity یک domain owner.
- canonical entities unique.
- UUIDv7 proposed internal IDs.
- human readable ids جدا.
- module -> core reference مجاز، core -> module ممنوع.
- direct cross-module data dependency ممنوع.
- strong consistency inside domain؛ eventual across modules when suitable.
- transactions within domain boundary.
- transactional outbox + consumer inbox.
- business-meaningful events.
- standardized event envelope with scope/version/correlation.
- repository around aggregate/domain, not table CRUD only.
- commands/queries conceptually separated.
- optimistic concurrency where useful.
- UTC time, typed money/decimal.
- JSONB not schema escape hatch.
- custom fields future path.
- external IDs separate.
- tenant-aware uniqueness.
- deletion policy explicit.
- expand/backfill/contract for large migration.
- analytics separates from OLTP when justified.
- schema ownership strict; migrations cannot mutate other module schema.
- business logic not hidden in DB triggers by default.
- production data access limited/audited.

## D-062 — API & Contracts

- Internal and Public API contract levels separated.
- REST-first; domain transport agnostic.
- routes no business logic.
- middleware pipeline auth/context/permission/validation/rate limit/application.
- typed/schema-driven contracts.
- shape vs domain validation separate.
- error format/code registry shared.
- standard resource/HTTP semantics.
- pagination/filter/sort/search conventions.
- idempotency for sensitive commands.
- optimistic concurrency where appropriate.
- async Job model for long operations.
- internal backward-compatible evolution; Public API formal versions/deprecation.
- OpenAPI generated.
- permission/scope reused for API keys.
- User and Machine actors auditable.
- realtime transport separate from domain events.
- Storefront public API separated/minimal.
- direct-to-object-storage upload flow.
- public webhooks independent/versioned.
- control plane cannot bypass domain rules.
- API lint/contract checks possible in CI.

## D-063 — Testing & Quality

- test pyramid.
- business logic unit tests.
- real infra integration tests.
- tenant isolation mandatory.
- permission/scope/entitlement regression.
- API/event/provider contract tests.
- migration tests previous->new.
- critical customer E2E.
- visual regression for key design/template areas.
- failure/retry/idempotency/outbox/inbox tested.
- security/audit tested.
- fake providers in normal CI + sandbox separately.
- flaky tests unacceptable.
- fast/PR/release test tiers.
- main deployable.
- incomplete features behind flags.
- bugs/incidents create regression tests when appropriate.
- shared test kits/module compliance suite.
- no production PII test copies as normal practice.
- coverage is not sole quality metric.

## D-064 — Frontend, Design System & UX

- multiple apps, one design language.
- design system foundation.
- primitives vs product components.
- design tokens, not hardcoded branding.
- RTL/LTR/localization from start.
- calendar/number/currency presentation separated from data.
- frontend module boundaries mirror backend.
- navigation/routes from module registry.
- route guards permission/entitlement/flag aware.
- shared table/filter/form/error/empty/loading patterns.
- no permission vs no subscription vs needs setup differentiated.
- effective UI state formalized.
- Website Builder unique interaction but shared design language.
- white-label via tokens/theme, not fork.
- component versioning/deprecation.
- component lab + visual regression.
- documented UX/content language.
- code splitting/lazy modules.
- shared API client/data fetching/cache.
- frontend telemetry integrated.
- server remains authority.

## D-065 — CI/CD & Release Engineering

- main always deployable.
- trunk-based, short-lived branches.
- PR + automated checks.
- small reviewable PRs.
- large features incremental + flag.
- CI gates lint/typecheck/tests/contracts/tenant/migration/build.
- broader regression for core change.
- build once, deploy many.
- immutable versioned artifacts.
- preview/staging/production promotion.
- staging production-like.
- preflight + health gates.
- expand-migrate-contract.
- canary/progressive rollout scale-ready.
- Deploy != Release.
- application rollback separate from data recovery.
- manual server edits prohibited normal workflow.
- IaC/GitOps-ready.
- production secrets out of builds/logs.
- workers/jobs version/idempotency/locks.
- same artifacts shared/dedicated/standalone.
- smoke/synthetic validation.
- deployment permission/audit.
- frequent small releases preferred.
- initial continuous delivery.
- release manifest registry.

## D-066 — Dependency, Supply Chain & Application Security

- dependency addition reviewed.
- critical dependencies owner/maintenance/license/security review.
- lockfile/deterministic install.
- major upgrades controlled.
- dependency vulnerability/license scans.
- transitive dependency risk.
- security exception expiry/owner/mitigation.
- build/CI isolated from production credentials.
- versioned immutable artifacts/containers; signing later.
- minimal/non-root containers when possible.
- secret scanning/rotation.
- no custom cryptography.
- auth/session/token security baseline.
- XSS/CSRF/injection/SSRF/file upload/resource abuse threat modeled.
- unrestricted custom JS not MVP.
- external calls timeout/retry.
- storefront/dashboard/control plane boundaries.
- security-sensitive PR review.
- threat model high-risk features.
- scanning complements review/tests.
- incident response/vulnerability reporting.
- dependency abandonment strategy; fork last resort.
- secure-by-default internal framework.
- SBOM/provenance future enterprise readiness.

## D-067 — Privacy, Compliance & Data Governance

- Business Data vs Platform Operational Data.
- Data Classification Registry.
- PII/Sensitive Registry.
- minimization/purpose limitation.
- consent history record, not boolean; preference separate.
- export/correction/delete/anonymize workflows.
- canonical Customer enables customer-centric discovery.
- delete/anonymize/archive/retain separate.
- per-category retention.
- backup lifecycle vs live deletion distinct.
- legal hold/override future-ready.
- residency metadata.
- cross-border/provider policy configuration-driven.
- minimum data sent to providers.
- analytics/test minimize real PII.
- support masking/permission/audit.
- module Data Governance Contract.
- short-lived protected exports.
- data portability.
- derived/AI data governed.
- privacy-by-design checklist.
- compliance profiles future-ready, not country if-statements.
- policies versioned and attributable.

## D-068 — Documentation, ADR & Engineering Governance

- docs source-controlled close to code.
- architecture docs / engineering handbook / runbooks separated.
- important architecture decisions ADR.
- ADRs superseded, not erased.
- rules enforceable by automation should be automated.
- standard module docs.
- API/event/permission/config docs generated where possible.
- operational runbooks.
- incident postmortems.
- technical debt registry distinct from feature backlog.
- Decision Register D-001+ maintained.
- governance proportional to impact.
- core/new module/security/public API changes architecture review.
- new feature/module checklist.
- documentation part of DoD.
- domain ownership/CODEOWNERS future.
- engineering standard versioned.
- freeze = baseline, not immutable forever.
- exceptions documented/scoped/reviewed.
- fitness tests future.
- product/architecture/engineering/roadmap docs distinct.
- roadmap dependency-aware and Owner-controlled.

## D-069 — Feature Capability Level Gate

Before non-trivial implementation:

1. Feature/problem identified.
2. Domain placement + dependencies.
3. Agent presents Basic.
4. Agent presents Advanced.
5. Agent may list Future/Enterprise for awareness.
6. Owner explicitly selects Basic or Advanced.
7. Only then PRD/spec implementation scope is finalized and coding starts.

Basic = production-ready core outcome, not low-quality engineering.

Advanced = Basic + professional depth, automation, customization, collaboration, analytics/scale as appropriate.

During implementation, newly discovered scope must be surfaced as `Scope Extension Detected`; Agent cannot silently enlarge scope.
