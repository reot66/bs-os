# PRD — Customer Core & CRM

## Separation
Customer Core Foundation است؛ CRM Module روی آن sales/customer workflow می‌سازد.

## Customer Core
Canonical Customer ID، contact identities، tags/basic source، shared activity timeline hooks.

## CRM Basic Candidate
- Leads/Customers view
- Deals
- Single pipeline + stages
- Assignments
- Notes/tasks/basic activities
- Search/filter
- Basic dashboard

## CRM Advanced Candidate
Basic + multiple pipelines, custom fields, lead scoring, segmentation, sequences, automation, sales forecast, SLA, territories, advanced reports, advanced permissions.

## Rules
CRM Customer duplicate ایجاد نمی‌کند؛ `core.customer_id` reference canonical است.

## Capability Level Gate
**Level هنوز انتخاب نشده است مگر Owner صریحاً انتخاب کند.** قبل از implementation Agent باید Basic و Advanced را با scope دقیق ارائه کند.

## Engineering Baseline
در هر Level تمام Foundation Rules مربوط به Security, tenancy, tests, observability, data ownership, migrations, contracts و audit رعایت می‌شوند.
