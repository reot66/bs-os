# Product Decisions — تفصیلی

این سند Context تصمیم‌های محصول و کسب‌وکار D-001 تا D-050 را برای Agent حفظ می‌کند.

## 1. مدل کسب‌وکار و Positioning — D-001 تا D-006

Platform از روز اول **Hybrid Services + Platform** است. هدف این نیست که صرفاً SaaS self-service یا agency پروژه‌ای باشیم. در شروع، تیم خودمان برای مشتری تحلیل، setup و اجرا انجام می‌دهد و سپس رابطه ماهانه حفظ می‌شود.

Positioning اصلی «رشد و مدیریت هوشمند کسب‌وکار» است؛ Website و Commerce ابزارهای مهم‌اند ولی هویت محصول نیستند. وعده اولیه باید قابل فهم باشد: ابتدا Digital Business Setup، سپس Growth Partnership.

بازار شروع به یک صنعت قفل نمی‌شود. Retail، Service Business و Small Company/B2B با Core مشترک و Template/Preset متفاوت وارد می‌شوند. این تصمیم باعث می‌شود Verticalها Core را fork نکنند.

## 2. مدل رابطه، اجرا و AI — D-003 تا D-005 / D-016

مشتری Partner بلندمدت است نه project handoff. اجرای اولیه Human-led است: Founder/consultant نیاز را می‌فهمد و تیم اجرا می‌کند. AI در بلندمدت intake، تحلیل، recommendation و بعضی actions کنترل‌شده را تقویت می‌کند؛ اما MVP به AI وابسته نیست.

Commercial offer از Setup/Launch + Subscription/Monthly partnership تشکیل می‌شود و Service Package نیز لایه جدا دارد.

## 3. Business-centric Product Model — D-007 تا D-010

Business موجودیت عملیاتی اصلی است. User می‌تواند چند Business داشته باشد. Platform از ابتدا برای Team/Roles/Permissions آماده است و نهایتاً Full RBAC تصمیم قطعی شد.

Module strategy: ابتدا First-party moduleها؛ public plugin ecosystem بعداً. هدف این است که Core ثابت بماند و Capabilityها به آن متصل شوند.

## 4. MVP و Customer Experience — D-011 تا D-019

MVP باید ابتدا Foundation + Website + Customer Core + templates را به نتیجه قابل فروش تبدیل کند. Website Builder کنترل‌شده است: template و section/block editing، نه free-form pixel editor.

Deployment پیش‌فرض managed/hosted است و Standalone برای مشتری خاص پشتیبانی می‌شود. ورود مشتری Hybrid است: self-service برای ساده‌ها و consultant-assisted برای پیچیده‌ها. Customer dashboard محصول اصلی کاربر است؛ consultant dashboard برای عملیات تیم نیز وجود دارد.

Onboarding دو مسیر دارد: quick path و assessment path. Advanced Commerce/Loyalty/Booking/Marketing/AI/Marketplace الزام MVP اولیه نیستند مگر Owner ترتیب را تغییر دهد.

## 5. Architecture Direction — D-020 تا D-024

شروع با Modular Monolith است؛ Microservices زودهنگام ممنوع. Multi-tenancy hybrid است: shared برای SaaS و dedicated برای موارد خاص. Business -> Branch از ابتدا مدل می‌شود و data می‌تواند business-level یا branch-level باشد.

Pricing architecture از همان ابتدا subscription + modules + usage را می‌شناسد. Advanced invoicing/pricing می‌تواند بعداً بیاید ولی Usage events/metering foundation باید زود طراحی شود.

## 6. Agency, White-label, Catalog — D-025 تا D-027

Agency/Partner از ابتدا concept رسمی است و می‌تواند چند client business را مدیریت کند. White-label باید architecturally possible باشد اما activation می‌تواند بعداً انجام شود. Internal module catalog قبل از public marketplace ساخته می‌شود.

## 7. Customer/Website/Templates — D-028 تا D-032

Customer Core canonical است؛ CRM Advanced Module است. Website یک Core-level Module است: جدا و modular، ولی معمولاً در entry offer فعال است.

MVP ممکن است یک Website در هر Business داشته باشد ولی model باید 1:N را مسدود نکند. Templateها ابتدا توسط تیم داخلی ساخته می‌شوند و future template marketplace ممکن است. Editor Section/Block based است.

## 8. Module Data/Event/API Boundaries — D-033 تا D-035

Core entities مشترک‌اند و specialized data متعلق به Module. Moduleها Customer/Business identity را duplicate نمی‌کنند.

Activity/Event Core برای timeline و cross-cutting behavior وجود دارد. API-first برای Core است تا dashboard/mobile/plugins/AI آینده بتوانند استفاده کنند. Moduleها contract خود را دارند و direct DB coupling ممنوع است.

## 9. Frontend/Storage/Auth — D-036 تا D-041

Monorepo شامل appهای جدا ولی packages مشترک است. Public websites برای SEO/cache از SSR/SSG و dashboard برای interaction طراحی می‌شود.

Media/blobs از Object Storage می‌آیند. Identity architecture provider-abstracted است؛ membership/authorization از authentication جداست. Full RBAC + scoped RBAC تصمیم قطعی است: Platform → Agency → Business → Branch → Module/resource.

## 10. Deployment/Cloud/Database — D-042 تا D-044

Container-first، Kubernetes-ready؛ Kubernetes فقط وقتی scale واقعی لازم کند. Cloud-agnostic با PostgreSQL، S3-compatible storage، containers و adapterها.

Database در ابتدا shared PostgreSQL با Core Schema و Module Schemas است. جداکردن schema به معنی آزادبودن cross-schema coupling نیست؛ ownership و contract rules همچنان اجباری‌اند.

## 11. GTM و Commercial Packaging — D-045 تا D-048

ورود بازار broad ولی با template محدود است. GTM: Direct first، سپس Partner scale. Revenue layers همزمان ممکن‌اند: setup، subscription و service package؛ module/usage نیز به commercial engine متصل‌اند.

Entry message ابتدا Digital Business Setup است و با ایجاد اعتماد/داده به Growth Partnership ارتقا پیدا می‌کند.

## 12. Documentation Strategy — D-049

یک سند غول‌پیکر کافی نیست. ساختار مطلوب:

- Master PRD: vision/product/system baseline
- Domain/Module PRD: تعریف capability domain
- Feature PRD/Spec: scope دقیق یک feature
- ADR: تصمیم معماری
- Engineering rules/runbooks: نحوه ساخت و عملیات

## 13. Build Ownership / Open Source — D-050

Business Capabilityها را خودمان می‌سازیم. OSS و competitorها برای research، UX patterns، architecture patterns، edge cases و infrastructure/library استفاده می‌شوند.

هدف جلوگیری از دو خطر است:

1. Runtime product becoming a collection of foreign apps and fragmented identities/data.
2. Re-inventing infrastructure/protocol/library problems unnecessarily.

اصل عملی: **Own the domain; learn from the ecosystem.**
