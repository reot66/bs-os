# PRD — Platform Core & Tenancy

## Purpose
هسته‌ای که تمام Businessها و Moduleها روی آن ساخته می‌شوند. این Domain قابلیت optional معمولی نیست؛ Foundation است.

## Scope
- User/Identity abstraction
- Tenant/Organization
- Agency/Partner representation
- Business
- Branch
- Membership
- Full Scoped RBAC
- Customer Core
- Activity/Event Core
- Module Registry/Activation
- Configuration/Feature Flags foundation
- Entitlement/Usage foundations
- Audit hooks

## Critical Rules
- Core کوچک و stable بماند.
- Core Moduleهای business را import نمی‌کند.
- Canonical Customer/Business/Branch identity فقط اینجاست.
- Shared SaaS RLS/tenant isolation mandatory.

## Out of Scope
CRM pipeline, products/orders, booking calendar, social publishing و هر capability تخصصی.

## Acceptance
- User چند Business داشته باشد.
- Agency چند Business را scope-aware مدیریت کند.
- Branch permission isolation کار کند.
- Module activation از registry کنترل شود.
- cross-tenant regression suite pass شود.
