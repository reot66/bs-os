# PRD — Commerce

## Goal
Product businesses بتوانند catalog تا order lifecycle را روی همان Customer/Business Core مدیریت کنند.

## Basic Candidate
- Product/category/variant
- Basic inventory
- Cart
- Checkout
- Order
- Payment provider adapter integration
- Basic shipping options
- Customer linkage
- Order dashboard

## Advanced Candidate
Basic + warehouses, multi-branch inventory, promotions/coupons/rules, returns/refunds, advanced tax/invoice, bundles, subscriptions, B2B pricing, marketplaces, purchase/supply workflows, advanced reports.

## Data Ownership
Commerce owns Product/Variant/Inventory/Cart/Order; Customer belongs to Core.

## Capability Level Gate
**Level هنوز انتخاب نشده است مگر Owner صریحاً انتخاب کند.** قبل از implementation Agent باید Basic و Advanced را با scope دقیق ارائه کند.

## Engineering Baseline
در هر Level تمام Foundation Rules مربوط به Security, tenancy, tests, observability, data ownership, migrations, contracts و audit رعایت می‌شوند.
