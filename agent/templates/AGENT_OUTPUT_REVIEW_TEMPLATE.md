# Agent Output Review — <TASK-ID>

## Review Inputs
- Diff/commit/PR:
- Test logs:
- Screenshots/E2E evidence:

## Scope
- [ ] No silent scope creep
- [ ] Only expected files changed

## Architecture / Domain
- [ ] Domain ownership correct
- [ ] Boundaries/contracts respected

## Data / Migration
- [ ] Safe migration
- [ ] Tenant/business scoping
- [ ] Constraints/indexes

## Security
- [ ] AuthN/AuthZ
- [ ] Tenant isolation
- [ ] Validation/abuse cases
- [ ] No secret/PII leakage

## Performance
- [ ] Bounded queries
- [ ] N+1/overfetch checked
- [ ] async/timeout/retry appropriate

## Reliability
- [ ] transactions/idempotency/retries
- [ ] partial failure behavior

## UX
- [ ] loading/empty/error/success
- [ ] RTL/accessibility/responsive

## Tests
- [ ] Required suites executed
- [ ] Negative tests meaningful
- [ ] Regression covered

## Observability
- [ ] logs/errors/metrics/audit appropriate

## Findings
### Blocking
### Non-blocking

## Verdict
APPROVED | APPROVED_WITH_NON_BLOCKING_NOTES | CHANGES_REQUIRED | REJECTED_SCOPE_OR_ARCHITECTURE

## Required Fixes
1.
