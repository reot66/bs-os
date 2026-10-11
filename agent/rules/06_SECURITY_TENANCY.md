# Security & Tenant Isolation

## Security Context
هر request پس از authentication context رسمی دارد:
- actorUserId / machine actor
- tenantId
- businessId
- branchId optional
- permissions/scopes
- requestId

Client-provided tenant/business IDs هرگز بدون authorization trusted نیستند.

## Defense in Depth
```text
Authentication
→ Scoped RBAC
→ Application policy
→ Tenant-aware repository
→ PostgreSQL RLS
→ Data
```

## Scope hierarchy
Platform → Agency → Business → Branch → Module

## Isolation beyond DB
- Cache keys tenant/business-aware
- Object storage prefixes/scopes
- Queue jobs carry tenant/business context
- Events carry tenant/business + schema version
- Webhooks resolve/verify scope
- API keys scoped and auditable

## Secrets
Secrets در secret store/abstraction؛ plaintext DB/config/log ممنوع.
Runtime DB user superuser نیست.

## Support/Admin
Support access permissioned, reasoned, expiring and audited. Break-glass جدا و monitored.

## Mandatory Tests
Read/Update/Delete/Search/Export cross-tenant negative tests برای تمام Moduleها.
