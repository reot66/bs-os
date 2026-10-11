# Engineering Handbook — Daily Rules

## Before Coding

- Read AGENT.md.
- Find relevant module/domain.
- Run Basic/Advanced gate for non-trivial feature.
- Check Decision Register.
- Check whether Foundation Rule change is implied.

## Code

- business logic outside routes/controllers/UI.
- no cross-module DB access.
- no customer-specific conditions.
- no provider-specific business logic.
- no secrets in code/config DB/logs.
- no giant unbounded queries.

## Database

- migrations mandatory.
- tenant/business scoped uniqueness.
- use transaction boundaries within domain.
- large migrations use expand/backfill/contract.
- direct production SQL is exception, audited/tracked.

## API

- typed contracts.
- shared errors.
- permission enforcement server-side.
- pagination/limits.
- idempotency for sensitive creates/actions.

## Async

- heavy work to worker.
- jobs idempotent.
- retry classified.
- DLQ for terminal failures.

## Testing

At minimum as applicable:

- unit business logic
- integration repository/DB
- tenant isolation
- permission/entitlement
- contract
- migration
- critical E2E

## Observability

Every meaningful error should be traceable with request/correlation/module/business context without leaking secrets.

## PR

Explain:

- what/why
- module/domain
- migration
- contract/event
- permission/entitlement
- flag/config
- tests
- rollout/rollback

## Done

A feature is not Done فقط because UI works. Definition of Done from Master PRD applies.
