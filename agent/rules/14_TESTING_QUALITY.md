# Testing & Quality Engineering

## Pyramid
Unit > Integration > Contract > limited critical E2E.

## Mandatory
- Domain/business unit tests
- Real PostgreSQL integration tests (RLS/schema behavior)
- Tenant isolation negative tests
- Permission/scope/entitlement/config/flag tests
- API/event/provider contract tests
- Migration-from-previous-version tests
- Critical E2E journeys
- Retry/idempotency/outbox/inbox failure tests
- Audit/observability security behavior tests

## UI
Visual regression برای Design System/Website templates در نقاط پرریسک؛ accessibility baseline.

## CI tiers
- Fast local
- PR gate
- Release suite/load/security/migration broader tests

## Rules
- Flaky test = broken test؛ fix یا quarantine با owner/deadline.
- Production PII برای test ممنوع؛ synthetic/anonymized data.
- Bug/incident مهم regression test تولید کند.
- Module Compliance Suite برای manifests/permissions/events/metrics/isolation/migrations.
- Coverage تنها KPI کیفیت نیست.
