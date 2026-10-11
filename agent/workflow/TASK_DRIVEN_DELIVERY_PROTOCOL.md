# Task-Driven Delivery Protocol

این سند شیوه اجرایی توسعه را از درخواست Owner تا Release تعریف می‌کند. هدف این است که هیچ Capability با یک Prompt مبهم یا یک تغییر بزرگ و غیرقابل‌بررسی ساخته نشود.

## 1. اصل پایه

هر Feature غیرجزئی باید به مجموعه‌ای از Taskهای کوچک، قابل تست و قابل بازبینی شکسته شود. هر Task باید خروجی قابل اثبات داشته باشد.

## 2. جریان اجباری

```text
Owner Request
  -> Context/Repository Read
  -> Problem & Outcome Definition
  -> Domain/Dependency Check
  -> Basic vs Advanced Gate
  -> Owner Level Decision
  -> OSS/Product Pattern Research
  -> Feature Spec / Acceptance Criteria
  -> Architecture & Threat/Performance Review
  -> Test Plan BEFORE implementation
  -> Task Breakdown
  -> Implement one Task/Slice
  -> Run Tests & Static Checks
  -> Agent Output Review Gate
  -> Fix / Re-test
  -> Integrate next Task
  -> Full Regression / Release Gate
```

## 3. قبل از هر Task

Agent باید دقیقاً مشخص کند:

- Task ID و عنوان
- هدف کاربر/سیستم
- Preconditions
- فایل‌ها/فولدرهای مجاز برای تغییر
- فایل‌هایی که نباید تغییر کنند
- Data/API/Event/Permission impact
- Security risks
- Performance risks
- Acceptance criteria
- Tests that must pass
- Rollback/revert note در صورت نیاز

## 4. Test-first Planning

قبل از نوشتن implementation، تست مورد انتظار باید تعریف شود. منظور الزام TDD در تمام خطوط کد نیست؛ منظور این است که Success/Failure قبل از Coding قابل اندازه‌گیری باشد.

حداقل دسته‌های تست در صورت کاربرد:

1. Happy path
2. Validation/invalid input
3. Authentication/authorization
4. Cross-tenant negative isolation
5. Entitlement/config/flag behavior
6. Concurrency/idempotency/retry
7. Database constraint/migration
8. API/event/provider contract
9. Security abuse cases
10. Performance/bounds/pagination
11. UX loading/empty/error/success states
12. RTL/accessibility
13. Observability/audit
14. Regression of affected behavior

## 5. Task sizing

Task مناسب باید:

- یک outcome روشن داشته باشد؛
- ترجیحاً مستقل review شود؛
- blast radius محدود داشته باشد؛
- در صورت شکست به‌سادگی قابل revert باشد؛
- تست مستقیم داشته باشد.

Task بزرگ باید قبل از Coding به Sliceهای کوچک‌تر شکسته شود.

## 6. File-by-file implementation contract

برای هر تغییر باید گفته شود:

```text
File: path/to/file
Action: create | modify | delete
Reason: ...
Changes:
- ...
Tests covering it:
- ...
```

اگر Agent نیاز به فایل دیگری پیدا کرد که در Plan نبود، باید Scope Extension یا Plan Amendment گزارش کند و مخفیانه آن را تغییر ندهد.

## 7. Commands & reproducibility

هر Task باید commandهای دقیق قابل اجرا داشته باشد:

- install/bootstrap if needed
- migration
- lint
- typecheck
- unit/integration tests
- targeted E2E
- build
- optional security/performance checks

هیچ «works on my machine» بدون command و evidence پذیرفته نیست.

## 8. اجرای توسط انسان یا Agent

همان Task Packet باید برای هر دو قابل استفاده باشد. اگر Owner گفت «Prompt بده»، Agent Prompt باید به‌اندازه کافی صریح باشد که یک Coding Agent ضعیف نیز scope، فایل‌ها، ممنوعیت‌ها، تست‌ها و output format را اشتباه نگیرد.

## 9. Merge/Release gate

Task زمانی Approved است که:

- acceptance criteria satisfy شده باشد؛
- tests واقعاً اجرا و evidence ارائه شده باشد؛
- diff با scope سازگار باشد؛
- security/performance/data ownership review پاس شود؛
- docs/manifest/migration در صورت نیاز update شده باشد؛
- هیچ silent scope creep وجود نداشته باشد.

Feature زمانی Done است که تمام Taskها + Definition of Done کامل باشند.
