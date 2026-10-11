# Observability, Audit & Supportability

## Observability
- Structured JSON logs.
- Correlation/request ID در API → service → event → worker → integration.
- Context در حد لازم: tenant, business, branch, module, deployment, version.
- Metrics، tracing و health OpenTelemetry-ready و vendor-neutral.
- Standard error contract + error code registry.
- Secret/PII redaction مرکزی.

## Health
- Liveness
- Readiness
- Dependency health
- Business/integration health states

## Audit
Audit از technical log جداست و برای actions حساس:
- permission/role change
- billing/entitlement overrides
- data export/delete
- website publish
- integration connect/credential change
- support impersonation

Audit immutable-ish و retention مستقل دارد.

## Support
- Support Console در Control Plane.
- direct DB edits ممنوع.
- Controlled impersonation با reason، expiry و full audit.
- Incident record و runbooks برای failureهای مهم.
