# Business Model & Commercial Architecture

## Revenue Streams
- One-time Setup / Launch
- Monthly/Annual Subscription
- Recurring Service/Growth Package
- Module Add-ons
- Usage-based charges
- Dedicated infrastructure/support fees
- Standalone license/support
- Future Partner/Agency wholesale

## Commercial Principles
- Plan name هرگز داخل Business Logic hardcode نمی‌شود.
- Product، Price و Entitlement جدا هستند.
- Payer می‌تواند با Business متفاوت باشد (Agency یا Billing Account).
- Grandfathered prices و Enterprise overrides باید بدون fork plan قابل پشتیبانی باشند.
- Data مشتری در زمان عدم پرداخت گروگان گرفته نمی‌شود؛ Grace/Restricted/Suspended state machine استفاده می‌شود.

## Customer Journey
```text
Discovery
→ Assessment / Quick Setup
→ Digital Business Setup
→ Platform Activation
→ Subscription
→ Growth Partnership
→ Additional Modules
→ Dedicated / Enterprise / Partner expansion
```
