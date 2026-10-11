# Repository & Module Standard

## Monorepo
```text
business-platform/
├── apps/
│   ├── platform/
│   ├── dashboard/
│   ├── storefront/
│   ├── api/
│   └── worker/
├── packages/
│   ├── core/
│   ├── modules/
│   ├── database/
│   ├── contracts/
│   ├── auth/
│   ├── tenancy/
│   ├── permissions/
│   ├── entitlements/
│   ├── billing/
│   ├── usage/
│   ├── events/
│   ├── integrations/
│   ├── storage/
│   ├── configuration/
│   ├── feature-flags/
│   ├── observability/
│   ├── ui/
│   └── design-system/
├── deployments/
├── docs/
├── tooling/
└── tests/
```

## Standard Module
```text
packages/modules/<module>/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── policies/
│   │   └── errors/
│   ├── application/
│   │   ├── commands/
│   │   ├── queries/
│   │   ├── services/
│   │   └── ports/
│   ├── events/
│   ├── permissions/
│   ├── usage/
│   ├── contracts/
│   ├── ui/
│   ├── manifest.ts
│   └── index.ts
└── tests/
```

## Rules
- Domain layer به React/Next/Hono/ORM وابسته نیست.
- Repository interface در domain/application، implementation در data adapter.
- `apps/api` transport layer است، نه محل business logic.
- worker برای async/background work.
- Dashboard navigation از module registry ساخته می‌شود.
