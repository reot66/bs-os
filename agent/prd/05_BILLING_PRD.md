# PRD — Billing, Entitlements & Usage

## Foundation
BillingAccount، Product، Price، Plan، Subscription، Add-on، Entitlement، Grant/Override، Usage Metric/Event.

## Basic Candidate
- Product/Plan/Price registry
- Subscription state
- module/limit entitlements
- add-ons
- manual payment/status support
- usage event collection
- effective entitlement resolver/snapshot

## Advanced Candidate
Basic + aggregation, invoice engine, automated gateway collection, overage/tiered pricing, discounts/trials, agency consolidated/wholesale billing, taxes, credit/refund, dedicated/standalone licensing automation.

## Rule
Modules know usage/entitlement keys, not commercial plan names/prices.

## Capability Level Gate
**Level هنوز انتخاب نشده است مگر Owner صریحاً انتخاب کند.** قبل از implementation Agent باید Basic و Advanced را با scope دقیق ارائه کند.

## Engineering Baseline
در هر Level تمام Foundation Rules مربوط به Security, tenancy, tests, observability, data ownership, migrations, contracts و audit رعایت می‌شوند.
