# Project Context — تصویر کامل پروژه

## محصول چیست؟

یک **Modular Business Growth & Smart Management Platform** برای دیجیتال‌سازی، مدیریت و رشد کسب‌وکارها؛ با تمرکز اولیه بر بازار ایران و Persian-first/RTL، ولی با معماری قابل استفاده در بازارهای دیگر.

این محصول فروشگاه‌ساز صرف، سایت‌ساز صرف یا CRM صرف نیست. هسته آن یک Business Platform است که Business می‌تواند Capabilityهای موردنیاز خود را به‌صورت Module فعال کند.

## مدل ورود به بازار

فاز تجاری اولیه:

1. **Digital Business Setup** — مشتری را دیجیتال می‌کنیم: Website، Customer Core، فرایندها و Dashboard.
2. سپس **Growth Partnership** — همکاری بلندمدت برای بهبود، Moduleهای بیشتر، Analytics و رشد.

مدل فروش اولیه:

- Direct Sales توسط تیم خودمان
- سپس Partner/Agency Scale

رابطه با مشتری بلندمدت است، نه صرفاً تحویل پروژه یک‌باره.

## مدل درآمد

Platform باید همزمان آماده این مدل‌ها باشد:

- Setup Fee
- Subscription
- Service Packages
- Module Add-ons
- Usage-based charges
- Dedicated managed pricing
- Standalone/license/support contracts
- Partner/agency pricing در آینده

## بازار اولیه

Platform از نظر Core صنعت‌محور نیست. ورود اولیه با Template/Preset محدود برای این گروه‌هاست:

- Retail / Store
- Service Business
- Small Company / B2B

Verticalهای آینده می‌توانند شامل Education، Healthcare، Restaurant، Beauty، Real Estate و غیره باشند.

Vertical لزوماً Module نیست؛ اغلب Bundle/Preset از Capabilityهاست. فقط وقتی domain مستقل واقعی دارد Module اختصاصی ساخته می‌شود.

## کاربران اصلی

- Platform Operator / Owner
- Internal Consultant / Support
- Agency / Partner
- Business Owner
- Business Manager
- Branch Manager
- Staff
- Customer/End user بسته به Module
- Machine/API identities در آینده

## تجربه ورود مشتری

Hybrid:

- Self-service برای نیاز ساده
- Consultant-assisted برای مشتری پیچیده

Customer Dashboard اولویت تجربه دارد، ولی Consultant/Operations Dashboard نیز بخشی از Product است.

## مدل سازمانی

```text
Platform
  └── Tenant / Organization
       └── Business (1..N)
            └── Branch (1..N)
```

یک User می‌تواند در چند Tenant/Business عضو باشد. Agency نیز می‌تواند چند Business را مدیریت کند.

## هسته مشترک

- User / Identity abstraction
- Tenant / Organization
- Business
- Branch
- Membership
- Scoped RBAC
- Customer Core
- Event / Activity Core
- Module Catalog / Entitlements
- Billing Foundation
- Usage Metering Foundation
- Configuration
- Feature Flags
- Audit / Observability

## Moduleهای محصول

هدف بلندمدت شامل این Moduleهاست و ترتیب ساخت آن‌ها توسط Product Owner تعیین می‌شود:

- Website / CMS
- CRM
- Commerce
- Booking
- Loyalty
- Marketing
- Social
- Project Management
- Support / Helpdesk
- Analytics
- Automation
- AI / Business Operator (آینده)

Moduleهای جدید می‌توانند اضافه شوند بدون تغییر Foundation، به شرط رعایت Module Standard.

## Website

Website یک Core-level Module است: modular و جدا از Core domain logic، ولی معمولاً اولین Capability فعال برای Business.

MVP تجربه Website:

- Template انتخاب می‌شود.
- Section/Block editor کنترل‌شده.
- متن، تصویر، رنگ، enable/disable/reorder sectionها.
- No arbitrary HTML/JS در MVP.
- معماری برای چند Website در هر Business آماده، ولی MVP می‌تواند یک Website داشته باشد.

## Customer Core و CRM

Customer identity باید canonical باشد و Moduleها Customer جداگانه نسازند.

Customer Core شامل identity/contact/source/tags/basic activity است.

CRM Advanced شامل pipeline، deal، follow-up، segmentation، automation، reports و قابلیت‌های فروش است.

## AI

AI جزء الزامی MVP نیست. Foundation باید AI-ready باشد، اما Business Data، API، Events، permissions و audit باید اول درست ساخته شوند.

چشم‌انداز AI آینده:

- Intake/assistant
- Business analysis
- Recommendations
- Controlled actions
- Data Q&A
- Site/bootstrap assistance

Human oversight در عملیات مهم حفظ می‌شود.

## فلسفه توسعه

Owner می‌خواهد همه Capabilityها در طول زمان ساخته شوند و زمان محدودکننده اصلی نیست؛ اما ترتیب ساخت را خودش انتخاب می‌کند.

پس اسناد باید:

- dependency-aware باشند؛
- هر Capability را مستقل تعریف کنند؛
- Basic/Advanced/Future scope داشته باشند؛
- ارتقای Basic به Advanced را بدون rewrite foundation ممکن کنند.
