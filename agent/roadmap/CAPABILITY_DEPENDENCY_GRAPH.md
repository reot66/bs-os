# Capability Dependency Graph

```text
Engineering Foundation
        │
        ▼
Identity/Auth ── Tenancy ── Business/Branch ── RBAC
        │              │             │
        └──────────────┼─────────────┘
                       ▼
                 Customer Core
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
       Events       Config/Flags   Entitlements/Usage
          │            │             │
          └────────────┼─────────────┘
                       ▼
              Module Runtime/Registry
                       │
       ┌───────────────┼───────────────────────────────┐
       ▼               ▼               ▼               ▼
    Website           CRM           Commerce         Booking
       │               │               │               │
       ├───────────────┼───────────────┼───────────────┤
       ▼               ▼               ▼               ▼
    Social       Project Mgmt       Support      Marketing/Loyalty
       └───────────────┬───────────────┘
                       ▼
                   Analytics
                       ▼
                 Automation/AI
```

## Cross-cutting prerequisites
تمام Moduleها به اندازه نیاز از اینها استفاده می‌کنند:
- permissions
- events
- usage
- config
- integrations
- storage
- audit/observability
- data lifecycle

## Important
این graph dependency است، نه ترتیب زمانی اجباری.
