# OSS / Product Benchmark Protocol

قبل از طراحی Capabilityهای مهم، نمونه‌های mature بررسی می‌شوند تا edge case، UX، data model، operational behavior و failure modes از صفر اختراع نشوند.

## 1. هدف

الگوبرداری مفهومی و مهندسی؛ نه کپی کورکورانه کد.

## 2. منابع اولویت‌دار

1. Official documentation / architecture docs
2. Mature open-source products
3. Their issues/roadmaps for known edge cases
4. Standards/RFCs where relevant
5. Provider official docs for integrations

## 3. خروجی تحقیق اجباری

برای هر reference:

```text
Reference:
Category:
Why relevant:
Patterns worth adopting:
Patterns NOT to adopt:
Edge cases discovered:
Operational lessons:
License:
Dependency risk:
Decision for our platform:
```

## 4. License gate

قبل از reuse مستقیم کد:

- license type
- notice/attribution requirements
- copyleft/network-copyleft impact
- compatibility with our distribution/deployment modes

باید بررسی شود.

بدون License review، فقط pattern/behavior/API idea مجاز است و implementation مستقل نوشته می‌شود.

## 5. Dependency gate

OSS product کامل به dependency حیاتی Business Domain تبدیل نمی‌شود مگر Decision صریح.

کتابخانه/infra dependency باید از نظر:

- maintenance activity
- release cadence
- security history
- ecosystem adoption
- exit strategy
- migration cost
- performance
- license

بررسی شود.

## 6. Reference matrix پیشنهادی بر اساس Domain

این‌ها نقطه شروع تحقیق‌اند، نه تصمیم قطعی برای dependency:

- CRM: Twenty و نمونه‌های comparable
- Booking/Scheduling: Cal.com و comparable systems
- Commerce: Medusa / Saleor و comparable systems
- Support/Inbox: Chatwoot و comparable systems
- Project Management: Plane و comparable systems
- Product Analytics / Flags: PostHog / Unleash و comparable systems
- CMS/Content: mature headless CMS/editor systems based on feature needs

هر Feature باید research تازه و feature-specific داشته باشد؛ این لیست جایگزین تحقیق نیست.

## 7. Future-proofing questions

قبل از finalize design:

- اگر 10x tenant/data/traffic شود چه می‌شکند؟
- اگر dedicated/standalone deployment فعال شود چه می‌شود؟
- اگر provider عوض شود چقدر coupling داریم؟
- اگر Module خاموش/حذف شود data/contracts چه می‌شوند؟
- اگر API/mobile/AI client اضافه شود آیا business logic reusable است؟
- اگر چند Branch/Business/Agency اضافه شود scope model سالم می‌ماند؟
- اگر permission/entitlement پیچیده‌تر شود rewrite لازم می‌شود؟
