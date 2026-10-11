# PRD — Booking

## Basic Candidate
- Service
- Staff/resource
- Availability
- Slot generation
- Appointment
- Cancellation/reschedule policy
- Customer linkage
- Reminder hooks
- Branch/timezone awareness

## Advanced Candidate
Basic + deposits/payments, resource combinations, classes/group booking, waitlist, recurring appointments, approval, capacity rules, packages/memberships, advanced schedules, analytics/automation.

## Critical
Timezone/overlap/concurrency correctness و branch scope mandatory.

## Capability Level Gate
**Level هنوز انتخاب نشده است مگر Owner صریحاً انتخاب کند.** قبل از implementation Agent باید Basic و Advanced را با scope دقیق ارائه کند.

## Engineering Baseline
در هر Level تمام Foundation Rules مربوط به Security, tenancy, tests, observability, data ownership, migrations, contracts و audit رعایت می‌شوند.
