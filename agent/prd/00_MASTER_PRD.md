# MASTER PRD v2.0 — Modular Business Growth Platform

**Status:** Current Product Baseline  
**Audience:** Product Owner, Development Agent, Architecture/Engineering  
**Market Entry:** Iran / Persian-first / RTL  
**Deployment:** SaaS Multi-Tenant + Dedicated + Standalone  
**Architecture:** Monorepo + Modular Monolith

> این سند Baseline فعلی محصول است و تصمیم‌های D-001 تا D-069 را منعکس می‌کند. سند اولیه در `source/` برای تاریخچه نگهداری شده است.

---

## 1. Executive Summary

هدف ساخت یک پلتفرم ماژولار برای **دیجیتال‌سازی، مدیریت و رشد کسب‌وکار** است. Businessها از یک هسته مشترک استفاده می‌کنند و فقط Moduleهای موردنیاز خود را فعال می‌کنند.

مزیت اصلی محصول در طول زمان:

- Unified Business Core
- Unified Customer identity
- Modular capabilities
- Iran-first integrations/localization
- Managed delivery + long-term growth partnership
- Shared data foundation برای Analytics/Automation/AI آینده

محصول نباید مجموعه‌ای از نرم‌افزارهای مستقل چسبانده‌شده باشد.

---

## 2. Product Vision

> هر کسب‌وکار بتواند بدون پراکندگی میان چند ابزار، حضور دیجیتال، مشتریان، عملیات، فروش، ارتباطات و رشد خود را از یک پلتفرم مشترک مدیریت کند.

### Vision بلندمدت

```text
Business Platform
├── Website
├── CRM
├── Commerce
├── Booking
├── Loyalty
├── Marketing
├── Social
├── Project Management
├── Support
├── Analytics
├── Automation
└── AI Business Operator
```

---

## 3. Product Positioning

Positioning اصلی:

**Growth & Smart Business Management Platform**

پیام ورود بازار:

1. Digital Business Setup
2. سپس Growth Partnership

Website یکی از مهم‌ترین Entry Capabilityهاست، ولی هویت محصول نیست.

---

## 4. Business Model

Commercial engine باید این مدل‌ها را پشتیبانی کند:

- One-time setup package
- Monthly / annual subscription
- Recurring service package
- Module add-on
- Usage-based billing
- Dedicated deployment fee
- Standalone/license/support model
- Agency/partner wholesale/custom model آینده

Product Modules نباید pricing logic را hardcode کنند. Entitlement و Usage engine واسط میان Product و Commercial model است.

---

## 5. Go-To-Market

### Phase A — Direct first

تیم خود Platform مشتری واقعی می‌گیرد، نیازها را کشف می‌کند و playbook می‌سازد.

### Phase B — Partner scale

بعد از استاندارد شدن فرایند، Agency/Partnerها می‌توانند چند Business را مدیریت کنند.

Platform از ابتدا Agency-ready و White-label-ready است ولی Public marketplace/partner ecosystem می‌تواند بعداً فعال شود.

---

## 6. Target Customer Entry

Core عمومی است ولی Template/Preset اولیه محدود است:

- Retail
- Service
- Small Company / B2B

Verticalهای بعدی Bundle/Pack هستند مگر اینکه domain data مستقل واقعی نیاز داشته باشند.

---

## 7. Conceptual Model

### Tenant / Organization

Security, billing و contractual boundary.

### Business

Operational entity اصلی Product.

### Branch

Operational location/unit زیر Business.

### User + Membership

Identity مستقل است؛ Membership تعیین می‌کند User در کدام Scope عضو است.

### Customer

Canonical customer identity مشترک Moduleها.

### Module

Capability مستقل و قابل فعال/غیرفعال شدن.

### Vertical Pack

Bundle از Template + Module defaults + onboarding/configuration؛ به‌صورت پیش‌فرض Module جدید نیست.

---

## 8. Access & Authorization

Full Scoped RBAC:

```text
Platform
  -> Agency/Tenant
     -> Business
        -> Branch
           -> Module/Resource
```

Permission naming نمونه:

```text
crm.customer.view
crm.customer.update
website.publish
social.post.publish
```

از `if role === admin` به‌عنوان معماری permission استفاده نمی‌شود.

---

## 9. Product Applications

```text
apps/
├── platform/    # Control Plane / Platform Ops
├── dashboard/   # Business / Agency / Consultant management UI
├── storefront/  # Public websites
├── api/         # Transport/API adapter
└── worker/      # Async processing
```

- Public storefront: SSR/SSG/cache/CDN friendly
- Dashboard: highly interactive app experience
- Platform Control Plane: internal operational product

---

## 10. MVP Product Baseline

MVP به معنی Foundation ناقص نیست. MVP feature scope محدود است ولی architecture/security full quality است.

Foundation/Core:

- Identity abstraction
- Tenant / Organization
- Business
- Branch
- Membership
- Scoped RBAC
- Customer Core
- Module Registry
- Entitlements
- Configuration
- Feature Flag foundation
- Usage Event foundation
- Audit/observability baseline
- Billing foundation

Customer Product:

- Business Dashboard
- Website Module
- Template System
- Section/Block Editor
- Public Website Publishing
- Basic customer/lead management

Consultant/Ops:

- Client overview
- Business assessment foundation
- Basic task/progress tracking

Infrastructure:

- PostgreSQL
- Object Storage
- Async worker/queue
- Docker/containerized deployment
- CI/CD
- Backup/restore baseline
- health/metrics/logging/tracing baseline

خارج از MVP اولیه مگر Owner انتخاب کند:

- AI autonomous features
- Full marketplace
- Advanced CRM
- Full Commerce suite
- Loyalty Advanced
- Booking Advanced
- Advanced Marketing Automation
- Public Plugin ecosystem

Owner می‌تواند ترتیب Moduleها را تغییر دهد اگر Dependencies آماده باشند.

---

## 11. Capability Level Model

هر قابلیت مهم قبل از Implementation دو انتخاب دارد:

### Basic

کوچک‌ترین نسخه production-ready که مشکل اصلی را کامل حل می‌کند.

### Advanced

Basic + سناریوهای حرفه‌ای، customization، automation، collaboration، reporting یا scale بیشتر.

### Future/Enterprise

قابلیت‌هایی که برای Architecture awareness ثبت می‌شوند ولی داخل Scope انتخاب‌شده نیستند.

Basic هیچ‌گاه Security/Testing/Tenancy/Observability را کاهش نمی‌دهد.

---

## 12. Website Module

### Foundation

- Website entity
- Page
- Section/Block instances
- Theme/design tokens
- Draft
- Published version
- Domain mapping
- SEO metadata

### Basic example

- choose template
- edit content/images/colors
- enable/disable/reorder sections
- core pages
- responsive preview
- publish/version
- domain/SSL integration

### Advanced example

- more flexible layout controls
- advanced content/blog/forms
- template upgrade tooling
- reusable sections
- collaboration/version comparison
- advanced SEO/performance tooling

No unrestricted custom JS in MVP.

---

## 13. Customer Core & CRM

### Customer Core

- canonical customer id
- identity/contact
- source
- tags
- basic activity timeline
- merge-ready architecture

### CRM Basic example

- leads
- deals
- pipeline/stages
- assignments
- notes/activity
- filters
- simple dashboard

### CRM Advanced example

- multiple pipelines
- custom fields
- lead scoring
- advanced segmentation
- sequences/automation
- forecast/reports
- territory/SLA/custom workflow

---

## 14. Commerce Module

Commerce باید Module باشد، نه Core.

Domainهای ممکن:

- Catalog
- Product/Variant
- Inventory
- Cart
- Pricing
- Checkout
- Order
- Payment orchestration
- Shipping orchestration

Customer identity از Customer Core می‌آید.

Payment/Shipping providerها Integration Adapter هستند، نه Commerce domain implementation.

---

## 15. Booking Module

Domainهای ممکن:

- Service
- Staff/resource
- Availability
- Slot
- Appointment
- Cancellation policy
- Reminder/deposit integrations

Basic/Advanced قبل از ساخت توسط Owner انتخاب می‌شود.

---

## 16. Social Module

خودمان Domain Social را می‌سازیم و Postiz/Buffer/Hootsuite و پروژه‌های مشابه صرفاً reference research هستند.

Foundation ممکن:

- SocialAccount
- Connection
- Content/Post
- Publication
- Scheduler
- Provider adapter
- Media reference
- Publishing events

Basic نمونه:

- connect account
- compose
- media
- schedule
- publish
- calendar
- status/retry

Advanced نمونه:

- approval workflow
- team collaboration
- campaigns
- bulk/recurring scheduling
- advanced analytics
- inbox
- automation

---

## 17. Project Management / Support / Loyalty / Marketing / Analytics

همگی Module مستقل هستند و باید همان Module Standard را رعایت کنند.

هیچ‌کدام حق ندارند مدل User/Business/Customer مستقل موازی ایجاد کنند مگر domain requirement واقعی و تایید معماری داشته باشد.

---

## 18. AI Future Layer

AI روی Foundation ساخته می‌شود، نه به‌جای Foundation.

Capabilities آینده:

- Business Q&A
- recommendations
- growth analysis
- assistant/intake
- controlled actions
- automation assistance
- content assistance

AI actionها Permission/Entitlement/Audit/Policy را bypass نمی‌کنند.

---

## 19. Architecture

### Style

- Monorepo
- Modular Monolith
- Module isolation
- API-first
- Event-aware

### Deployment

- Shared SaaS
- Dedicated managed
- Standalone

همه از یک codebase و artifacts اصلی.

### Scale strategy

- Container first
- Stateless apps where possible
- independent worker scaling
- PostgreSQL first
- cache/queue as needed
- Kubernetes when real scale justifies it
- selective service extraction only when operational reason exists

---

## 20. Data Architecture

- PostgreSQL source of truth
- Core schema + Module schemas
- canonical entities در Core
- Module-owned specialized data
- UUIDv7 proposed internal IDs
- UTC timestamps
- typed Money representation
- JSONB فقط برای موارد مناسب
- no direct cross-module DB access
- strong consistency inside domain
- eventual consistency across modules when appropriate
- Outbox/Inbox for reliable important events

---

## 21. API & Contracts

- REST-first
- typed/schema-driven contracts
- business logic outside routes
- shared error model
- cursor pagination for large datasets
- idempotency for sensitive commands
- async Job pattern for long operations
- Public API versioned separately
- OpenAPI generated from actual contracts

---

## 22. Events

Standard event envelope:

```text
event_id
event_type
schema_version
tenant_id
business_id
aggregate_type
aggregate_id
occurred_at
correlation_id
causation_id
payload
```

Events convey business meaning, not raw row-change semantics.

---

## 23. Integrations

Provider interfaces + adapters for:

- Payment
- SMS
- Email
- Shipping
- Maps
- Social providers
- Accounting
- Storage
- Identity
- AI future

Module Business Logic نباید provider خاص را hardcode کند.

---

## 24. Billing & Entitlements

Core concepts:

- BillingAccount
- Product
- Price + Price version
- Plan
- Subscription
- Add-on
- Entitlement
- Entitlement Grant/Override
- Usage Meter
- Usage Event
- Invoice/Payment later

Application هرگز `plan === pro` را business gate اصلی قرار نمی‌دهد؛ Effective Entitlements ملاک است.

---

## 25. Configuration & Feature Flags

این مفاهیم مستقل هستند:

- Configuration
- Feature Flag
- Entitlement
- Secret
- Environment

Config hierarchy:

```text
Platform -> Deployment -> Tenant/Agency -> Business -> Branch/Module
```

Customer-specific hardcoded logic ممنوع.

---

## 26. Security

Defense in depth:

```text
Authentication
-> Security Context
-> Scoped RBAC
-> Application policy
-> Scoped repository
-> PostgreSQL RLS (Shared SaaS)
-> Data
```

همچنین:

- tenant-aware cache/storage/queue/events
- least privilege
- secrets isolation
- secure support access
- audit
- rate limits/abuse protection
- MFA-ready
- break-glass controlled access

---

## 27. Reliability & Recovery

- PITR + scheduled backups
- Object storage backup/versioning
- restore testing
- data lifecycle policies
- logical recovery / recycle bin where appropriate
- DR runbooks
- idempotent workers/webhooks

---

## 28. Performance & Scalability

- stateless API where possible
- connection pooling
- tenant-aware indexes
- pagination
- async heavy work
- separate queues/worker pools
- CDN/published website version for storefront
- quotas/rate limits against noisy neighbor
- dedicated deployment as scale/isolation valve
- no premature sharding/microservices

---

## 29. Frontend & UX

- One design language across apps
- shared design system/tokens
- RTL/LTR first-class
- shared table/filter/form/error/empty/loading patterns
- module-driven navigation
- permission/entitlement/config/integration aware UI state
- website builder specialized interaction but shared design language
- lazy/code-split modules

---

## 30. Testing & Quality

Required classes:

- Unit
- Integration with real PostgreSQL
- Contract
- Tenant isolation
- Permission/scope/entitlement
- Migration
- Critical E2E
- Security regression
- Failure/idempotency/outbox/inbox
- Visual regression for key design/template components

Main branch should remain deployable.

---

## 31. CI/CD

- trunk-based development
- short-lived branches
- PR gates
- build once, deploy many
- immutable artifacts
- preview/staging/production
- preflight/health gates
- feature-flagged releases
- Expand-Migrate-Contract DB changes
- same artifacts for shared/dedicated/standalone

---

## 32. Privacy & Data Governance

- Data classification
- PII registry
- purpose/minimization
- consent history
- export/delete/anonymize/retention workflows
- residency metadata
- module data governance contracts
- protected export files
- AI-derived data under same governance

---

## 33. Open Source Strategy

### استفاده مجاز/ترجیحی

- frameworks
- libraries
- databases
- queues
- infra tooling
- reference implementations for learning

### Business Applications

CRM/Social/PM/Support softwareهای OSS به‌صورت پیش‌فرض Runtime اصلی Platform نمی‌شوند.

اصل:

> Build the domain, learn from the ecosystem.

---

## 34. Documentation & Governance

- Decision Register
- ADRs
- Engineering Handbook
- Module docs
- Event/permission/config catalogs
- Runbooks
- Incident postmortems
- Technical Debt register
- Architecture fitness tests future

Foundation Freeze baseline قابل تغییر است، ولی فقط با تصمیم آگاهانه و ثبت‌شده.

---

## 35. Roadmap Principle

Roadmap ترتیب اجباری Moduleها نیست.

Foundation dependencyها ابتدا ساخته می‌شوند. پس از آن Product Owner می‌تواند Module موردنظر را انتخاب کند.

هر Module/Capability باید Dependency Graph داشته باشد.

---

## 36. Definition of Done for a Capability

حداقل:

- selected Basic/Advanced scope
- domain owner
- architecture placement
- data model/migration
- permissions/scopes
- entitlement/usage impact
- API/contracts
- events
- config/flags if needed
- integrations if needed
- audit/observability
- privacy/delete/export behavior
- unit/integration/security tests
- migration/rollback compatibility
- docs updated

---

## 37. Non-goals / Anti-patterns

- Microservices from day one
- Customer-specific code branches
- direct cross-module database access
- plan-name checks scattered in product logic
- unrestricted custom JS in website MVP
- business logic inside routes/database triggers
- direct production edits as normal workflow
- adoption of whole OSS business apps just for short-term speed
- collecting data without purpose

---

## 38. Success Definition

Platform موفق است اگر بتوانیم Capabilityهای جدید را در طول سال‌ها اضافه کنیم، بدون اینکه:

- Core بازنویسی شود؛
- Tenant isolation ضعیف شود؛
- Customer identity تکه‌تکه شود؛
- هر Module UX و architecture مستقل اختراع کند؛
- Pricing به Product code قفل شود؛
- Providerها ما را vendor-lock کنند؛
- deployment modeها fork شوند.
