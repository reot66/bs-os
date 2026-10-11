# Canonical Domain Model

## Hierarchy
```text
Platform
└── Tenant / Organization (security/billing boundary)
    ├── Memberships
    ├── Billing Account(s)
    └── Business(es)
        ├── Branch(es)
        ├── Website(s)
        ├── Customers
        └── Activated Modules
```

## Actors
- Platform Operator
- Agency/Partner
- Business Owner
- Business Manager
- Branch Manager
- Staff
- Consultant
- External API/Machine Actor
- End Customer (در تجربه‌های storefront/booking/commerce)

## Canonical Core Entities
- User
- Tenant/Organization
- Membership
- Business
- Branch
- Customer / Contact Identity
- Role / Permission / Scope
- Module Definition / Activation
- Event / Activity
- Billing Account / Subscription foundation
- Configuration / Feature Flag references

## Module-owned Entities — examples
- Website: Website, Page, Section, Theme, PublishVersion
- CRM: Deal, Pipeline, Stage, Sales Activity
- Commerce: Product, Variant, Inventory, Cart, Order
- Booking: Service, Resource/Staff, Slot, Appointment
- Social: SocialAccount, Content, Publication
- Project Management: Project, Task, Milestone

## Dependency Rule
```text
Module → Core        allowed
Core → Module        forbidden
Module A → Module B DB forbidden
Module A → Module B via contracts/events allowed
```
