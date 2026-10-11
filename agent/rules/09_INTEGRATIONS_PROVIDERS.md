# Integration & Provider Abstraction

## Principle
Business Module هیچ Provider خارجی را مستقیم نمی‌شناسد.

```text
Module → Provider Interface → Adapter → External Provider
```

Provider categories: payment, SMS, email, shipping, maps, social, storage, accounting, identity, future AI.

## Integration Connection
- tenant/business scoped
- provider id/version
- capabilities
- config
- secret reference
- status/health
- platform-managed یا business-managed credentials

## Inbound
Webhook → signature verification → webhook inbox → idempotency → adapter → canonical event → domain.

## Outbound
Domain transaction → transactional outbox → worker → adapter/provider.

## Canonicalization
Provider payload/error/money/time/phone به internal canonical contracts map شود.

## Reliability
Timeout, retry classification, exponential backoff, circuit breaker/failover where appropriate.

## Extensibility
Integration Manifest + Registry. First-party adapters ابتدا؛ SDK/marketplace later.
