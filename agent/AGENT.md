# AGENT — دستور اجرایی اصلی برای همه Agentها

این Repository/Folder مرجع Product، Architecture و Engineering پروژه **Modular Business Growth Platform** است. قبل از تولید کد، Agent باید حداقل این فایل‌ها را بخواند:

1. `AGENT.md`
2. `00_PROJECT_CONTEXT.md`
3. `decisions/DECISION_REGISTER.md`
4. `rules/00_RULES_INDEX.md`
5. PRD مربوط به Domain/Capability موردنظر
6. Ruleهای تخصصی مرتبط با آن Feature

## قانون تقدم اسناد
در صورت تعارض:

1. آخرین Decision ثبت‌شده در `decisions/DECISION_REGISTER.md`
2. `AGENT.md` و Foundation Rules
3. `prd/00_MASTER_PRD.md`
4. Domain PRD مربوطه
5. Feature PRD/Spec جدیدتر
6. `source/LEGACY_MASTER_PRD_V1.md` فقط مرجع تاریخی

## دستور غیرقابل‌نقض قبل از Coding — Capability Level Gate
برای هر قابلیت غیرجزئی، **قبل از نوشتن کد**:

1. Feature را در یک جمله تعریف کن.
2. Domain Owner را مشخص کن.
3. Dependencies و Core/Module/Integration بودن را مشخص کن.
4. دو Scope ارائه کن:
   - **Basic**: نسخه Production-ready که مسئله اصلی را کامل حل می‌کند ولی قابلیت‌های پیشرفته را ندارد.
   - **Advanced**: شامل Basic + automation/customization/analytics/team/scale capabilities مرتبط.
5. برای هرکدام کوتاه بگو «چه دارد / چه ندارد / خروجی کاربر چیست».
6. اگر مناسب است Future/Enterprise را فقط به‌عنوان مسیر آینده ذکر کن.
7. سپس دقیقاً از کاربر بخواه یکی را انتخاب کند: `Basic` یا `Advanced`.
8. **تا انتخاب صریح کاربر، Implementation را شروع نکن.**

### Basic هرگز به معنی Engineering ضعیف نیست
حتی Basic باید این موارد را کامل رعایت کند:

- Security & Tenant Isolation
- RBAC/Permission
- Data ownership/integrity
- Migration safety
- Tests
- Observability
- Audit در صورت نیاز
- API contracts
- Error handling
- Backup/data lifecycle rules
- Accessibility/RTL baseline در UI

تفاوت Basic و Advanced فقط **Scope و عمق capability** است.

## Scope Creep Rule
اگر هنگام توسعه قابلیت جدیدی کشف شد که خارج از Level انتخابی است، آن را مخفیانه اضافه نکن. با این قالب گزارش کن:

```text
Scope Extension Detected
Current Level: Basic|Advanced
Proposed Addition: ...
Reason: ...
Impact: ...
Options:
A) Add now
B) Keep for future
```

## قوانین معماری خلاصه
- Business domainهای استراتژیک را خودمان می‌سازیم.
- Modular Monolith تا زمانی که نیاز واقعی extraction ثابت نشده.
- Core minimal و stable بماند.
- Module A حق direct DB access به Module B را ندارد.
- Canonical Business/Customer/Branch identities فقط در Core.
- Cross-module behavior از Contract/Event/Application Service.
- Shared SaaS tenant isolation با defense-in-depth و PostgreSQL RLS.
- Business logic داخل HTTP route، React component یا DB trigger قرار نگیرد.
- Provider-specific logic فقط در Adapter/Integration layer.
- `if customer === X` ممنوع؛ Config/Entitlement/Flag/Extension استفاده شود.
- Public Website، Dashboard و Control Plane security boundaries مستقل دارند.
- AI در Foundation/MVP اولیه dependency نیست.
- Roadmap ترتیب اجباری نیست؛ dependency-aware است و Owner می‌تواند ترتیب ساخت Moduleها را تغییر دهد.

## قوانین خروجی Agent هنگام توسعه
قبل از کد، بعد از انتخاب Level، Agent باید خلاصه Implementation Plan بدهد:

```text
Capability
Selected Level
Goal
Domain Owner
Dependencies
Data Changes
API/Contracts
Permissions
Events
Usage Metrics
Configuration
Audit/Observability
Migration Impact
Tests
Files/Packages to Change
```

سپس توسعه انجام شود.

## اگر Feature جدید به Core دست می‌زند
قبل از Coding مشخص کن چرا نمی‌تواند Module/Integration باشد. تغییر Foundation/Core مهم نیازمند ADR است.

## اگر از Open Source الهام گرفته می‌شود
مطالعه محصول/کد/UX/edge cases مجاز است؛ Business implementation اصلی مستقل نوشته شود. کپی مستقیم کد فقط پس از License review. OSS کامل نباید dependency حیاتی Business Domain شود مگر Decision جدید صریحاً آن را تأیید کند.

## Definition of Done
هیچ Feature فقط با «کار کردن UI» Done نیست. `templates/DEFINITION_OF_DONE.md` لازم‌الاجراست.

## Task-driven execution and independent Agent review

پس از انتخاب Capability Level و قبل از Coding، برای Feature غیرجزئی این اسناد نیز لازم‌الاجرا هستند:

1. `research/OSS_BENCHMARK_PROTOCOL.md` برای research مناسب همان Feature.
2. `workflow/TASK_DRIVEN_DELIVERY_PROTOCOL.md` برای شکستن Feature به Taskهای قابل تست.
3. `templates/TEST_PLAN_TEMPLATE.md` قبل از implementation.
4. `templates/TASK_PACKET_TEMPLATE.md` برای هر Task.
5. اگر Coding به Agent دیگری واگذار شد: `templates/AGENT_IMPLEMENTATION_PROMPT_TEMPLATE.md`.
6. خروجی Agent باید طبق `workflow/AGENT_REVIEW_GATE.md` و `templates/AGENT_OUTPUT_REVIEW_TEMPLATE.md` بررسی شود.

هیچ Task صرفاً با گزارش «انجام شد» یا «تست‌ها پاس شدند» Approved نمی‌شود؛ diff/files و evidence قابل بررسی لازم است.
