# PRD — Social Management

## Strategy
First-party implementation با مطالعه reference products مثل Postiz/Buffer/Hootsuite؛ dependency runtime اصلی به آن‌ها ایجاد نمی‌شود.

## Basic Candidate
- Social account connection via provider adapters
- Composer
- Media
- Schedule
- Publish
- Calendar
- Publication status/history
- Retry/error states
- Basic permissions/usage metrics

## Advanced Candidate
Basic + approval workflows, teams, bulk scheduling, campaigns, content library, advanced analytics, inbox/comments/messages where provider APIs permit, advanced automation, collaboration, best-time suggestions later.

## Boundary
Provider APIs در adapters؛ Social Domain provider-specific payload را نمی‌شناسد.

## Capability Level Gate
**Level هنوز انتخاب نشده است مگر Owner صریحاً انتخاب کند.** قبل از implementation Agent باید Basic و Advanced را با scope دقیق ارائه کند.

## Engineering Baseline
در هر Level تمام Foundation Rules مربوط به Security, tenancy, tests, observability, data ownership, migrations, contracts و audit رعایت می‌شوند.
