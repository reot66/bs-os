# Capability Roadmap — Dependency-aware, Owner-controlled

## اصل اصلی

این Roadmap **ترتیب زمانی اجباری نیست**. Product Owner انتخاب می‌کند بعد از Foundation کدام Capability ساخته شود.

Agent فقط باید Dependencyها را بررسی کند و بگوید آیا مسیر انتخابی آماده است یا چه Foundationی کم دارد.

## Layer 0 — Repository & Engineering Foundation

- monorepo bootstrap
- lint/typecheck/build
- design tokens/UI foundation
- config/environment foundation
- CI
- Docker/local environment

## Layer 1 — Platform Foundation

- Identity abstraction
- Tenant/Organization
- Business
- Branch
- Membership
- Scoped RBAC
- Database schemas/RLS
- Event foundation
- Audit/observability
- Module registry
- Entitlements
- Usage event registry
- Config/Feature Flag foundations
- Object Storage abstraction
- Worker/Queue foundation

## Layer 2 — First Sellable Digital Setup

Candidate capabilities:

- Website Basic
- Customer Core
- Business Dashboard
- Template System
- Publish/domain foundation
- Consultant client overview

## Layer 3+ — Owner-selectable Modules

بعد از آماده بودن Dependencyهای هر Module، Owner می‌تواند هرکدام را انتخاب کند:

- CRM
- Commerce
- Booking
- Social
- Loyalty
- Marketing
- Project Management
- Support
- Analytics
- Automation
- Vertical domains

## Ecosystem / Scale Capabilities

- Partner Portal
- Agency billing
- White-label activation
- Public API maturity
- Public webhooks
- Plugin/Integration SDK
- Dedicated provisioning automation
- Standalone upgrade tooling

## Intelligence Layer

- AI assistant
- business Q&A
- recommendations
- automation assistant
- controlled AI actions
- site/business bootstrap

## Dependency Graph Rule

هر Capability PRD/Spec باید این بخش را داشته باشد:

```text
Requires:
- Core X
- Module Y (if truly required)
- Integration Z
- Entitlement/Usage foundation

Optional:
- Analytics
- Automation
- AI
```

Cross-module dependency باید حداقل و Contract-based باشد.

## Basic/Advanced Roadmap Tracking

نمونه:

```text
Website
  Basic: READY/IN_PROGRESS/DONE
  Advanced: BACKLOG

CRM
  Basic: BACKLOG
  Advanced: BACKLOG

Social
  Basic: BACKLOG
  Advanced: BACKLOG
```

Owner در هر زمان می‌تواند Level موردنظر را انتخاب کند.
