# Agent Output Review Gate

هدف: خروجی Coding Agent هرگز صرفاً بر اساس ادعای خود Agent تأیید نشود.

## 1. ورودی بازبینی

حداقل یکی از این‌ها لازم است:

- Git diff / commit / PR
- فایل‌های تغییرکرده
- repository snapshot

و در کنار آن:

- commands executed
- test output
- migration output اگر applicable
- screenshots/video برای UI critical flows در صورت نیاز

## 2. ترتیب Review

### A. Scope review
- آیا فقط Task خواسته‌شده انجام شده؟
- فایل خارج از scope تغییر کرده؟
- تغییر غیرضروری dependency/config وجود دارد؟

### B. Architecture/domain review
- Domain ownership رعایت شده؟
- business logic داخل route/UI/trigger نرفته؟
- cross-module DB access ایجاد نشده؟
- provider-specific logic در adapter است؟

### C. Data/migration review
- schema/data ownership صحیح است؟
- tenant/business scoping صحیح است؟
- migration backward-safe است؟
- uniqueness/index/constraints صحیح‌اند؟
- rollback/forward-fix path مشخص است؟

### D. Security review
- authentication و server-side authorization
- tenant isolation
- input validation/output encoding
- CSRF/XSS/SQLi/SSRF/file upload/resource exhaustion where relevant
- secret/PII leakage
- rate/usage limits where relevant

### E. Performance review
- unbounded query/list ممنوع
- N+1 و overfetch بررسی
- indexes based on query pattern
- heavy work async where appropriate
- cache only with invalidation strategy
- external calls timeout/retry

### F. Reliability review
- transaction boundary
- idempotency
- retry classification
- outbox/inbox where needed
- partial failure handling

### G. UX review
- loading/empty/error/success
- responsive
- RTL/LTR baseline
- accessibility
- destructive action confirmation

### H. Test review
- تست‌ها meaningful هستند یا فقط happy path؟
- negative tenant/permission tests وجود دارد؟
- regression case پوشش داده شده؟
- test output با code version فعلی منطبق است؟

### I. Observability review
- structured errors/logs
- correlation context
- metrics/audit where required
- no secrets/PII in logs

## 3. نتیجه Review

فقط یکی از وضعیت‌های زیر صادر شود:

- `APPROVED` — همه معیارهای لازم پاس شده.
- `APPROVED_WITH_NON_BLOCKING_NOTES` — release-safe، نکات بهبود غیرمسدودکننده.
- `CHANGES_REQUIRED` — مشکل مشخص + فایل/رفتار + معیار اصلاح.
- `REJECTED_SCOPE_OR_ARCHITECTURE` — رویکرد نیازمند redesign است.

## 4. ممنوعیت تأیید صوری

جملاتی مثل «Agent گفته تست‌ها پاس شدند» evidence محسوب نمی‌شوند. Reviewer باید output قابل بررسی یا اجرای مستقل داشته باشد.
