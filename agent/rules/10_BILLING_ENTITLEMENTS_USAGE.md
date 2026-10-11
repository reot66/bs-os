# Billing, Entitlements & Usage

## Separation
Billing ≠ Payment.
Plan name نباید در product code check شود.

## Concepts
- BillingAccount
- Product
- Price (versioned)
- Plan
- Subscription state machine
- Add-on
- Service/Setup product
- Entitlement definition/grant/override
- Usage meter/event/aggregation
- Invoice/Payment later

## Effective Entitlements
Platform default → base plan → add-ons → contract/agency override → manual/temporary grant → effective snapshot.

Types:
- boolean capability
- numeric limit
- policy/enforcement: hard/soft/metered/informational

## Usage
Module فقط می‌گوید چه چیزی مصرف شد؛ Billing می‌گوید قیمت آن چیست.
Usage event idempotent و بعد aggregate می‌شود.

## Commercial behavior
- Product و Price جدا.
- Historical invoice/price snapshot immutable-ish.
- Grandfathering supported.
- Subscription: trialing/active/past_due/grace/restricted/suspended/cancelled/expired.
- Data در non-payment نابود یا گروگان نمی‌شود.
- Agency/Dedicated/Standalone مدل تجاری متفاوت ولی entitlement engine مشترک.
