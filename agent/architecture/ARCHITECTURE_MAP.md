# Architecture Map

## High Level

```text
                    Platform Control Plane
                           |
                    API / Contracts
                           |
        ------------------------------------------
        |                  |                     |
 Business Core       Business Modules       Shared Foundations
        |                  |                     |
 Tenant          Website / CRM / ...     Auth/RBAC/Events/
 Business        Commerce/Booking/...    Billing/Config/Usage
 Branch
 Customer
        |
        ---------------- PostgreSQL ----------------
                           |
            Queue / Workers / Object Storage
                           |
               Provider Integration Adapters
```

## Runtime Apps

```text
Internet
  |
  +--> Storefront --> CDN/cache/published website data
  |
  +--> Dashboard --> API
  |
  +--> Platform Ops --> API
                         |
                     Application
                         |
                   Domain Modules
                         |
             PostgreSQL / Queue / Storage
```

## Deployment Modes

```text
Same Codebase / Same Domain
├── Shared SaaS
├── Dedicated Managed
└── Standalone
```

Dedicated/Standalone نباید product fork شوند.

## Security Boundary

```text
Authentication
 -> Request Security Context
 -> Scoped Permission
 -> Entitlement/Config/Flag
 -> Application Policy
 -> Scoped Repository
 -> RLS
 -> Data
```

## Event Reliability

```text
Domain Transaction
  -> DB state + Outbox
  -> Worker publishes
  -> Consumer Inbox/idempotency
  -> Consumer domain action
```

## Integration

```text
Business Module
 -> Provider Interface
 -> Adapter
 -> External Provider
```
