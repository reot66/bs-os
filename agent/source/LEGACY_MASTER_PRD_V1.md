# Legacy Master PRD v1.0 — Source Conversion

> وضعیت: **مرجع تاریخی**. این فایل تبدیل Markdown سند مادر قبلی است. اگر هر بخش آن با `prd/00_MASTER_PRD.md`، `decisions/DECISION_REGISTER.md` یا Ruleهای جدید تعارض داشت، **Baseline جدید مقدم است**.

MASTER PRD

پلتفرم ماژولار ساخت، مدیریت و رشد کسب‌وکار

Modular Business Growth Platform

Website • Commerce • CRM • Booking • Restaurant • Marketing • Social • Automation • AI

| مورد | مقدار |
| --- | --- |
| نسخه سند | 1.0 — Master Baseline |
| تاریخ | ۱۸ شهریور ۱۴۰۵ / 9 September 2026 |
| وضعیت | Product + Architecture Master PRD |
| بازار اولیه | ایران — Persian-first / RTL |
| مدل محصول | SaaS Multi-Tenant + Dedicated + Standalone |
| نام برند | TBD — در این سند «Platform» نامیده می‌شود |

| هدف این سند این سند مرجع مادر پروژه است و Vision، مدل محصول، Scope، معماری، تکنولوژی، ماژول‌ها، ارتباط بخش‌ها، امنیت، مقیاس‌پذیری، استقرار، بازار ایران، Roadmap و Feature Backlog را یک‌جا ثبت می‌کند. هر ماژول در ادامه می‌تواند PRD تخصصی مستقل خود را داشته باشد. |
| --- |

## فهرست مطالب

### 1. کنترل سند و تصمیم‌های پایه

### 2. خلاصه اجرایی

### 3. مسئله بازار، Vision و Positioning

### 4. کاربران و سناریوهای اصلی

### 5. مدل مفهومی Platform: Tenant / Business / Branch / Module / Vertical Pack

### 6. مدل تجاری، Plan و Entitlement

### 7. Scope و فازبندی محصول

### 8. قابلیت‌های تفصیلی ماژول‌ها

### 9. تجربه‌های کاربری و Applicationها

### 10. معماری نرم‌افزار و ارتباط اجزا

### 11. Monorepo و Folder Tree واقعی

### 12. معماری داده و Multi-Tenancy

### 13. API، Contracts، Events و Automation

### 14. امنیت، حریم خصوصی و Audit

### 15. Performance، Scalability و Reliability

### 16. Infrastructure، Deployment و نسخه Standalone

### 17. Technology Stack و Version Baseline

### 18. تست، CI/CD و Observability

### 19. الزامات مخصوص بازار ایران

### 20. Roadmap اجرایی از قدم اول تا مقیاس

### 21. KPI، SLO و معیارهای پذیرش

### 22. ریسک‌ها و راهکارها

### 23. تصمیم‌های باز و ADRها

ضمیمه A. Feature Backlog جامع

ضمیمه B. Competitive Landscape

ضمیمه C. واژه‌نامه و منابع

## 1. کنترل سند و تصمیم‌های پایه

این PRD نسخه مادر پروژه است. تصمیم‌هایی که با برچسب «قطعی» مشخص شده‌اند باید مبنای توسعه باشند و تغییر آنها نیازمند Architecture Decision Record (ADR) است. موارد «پیشنهادی» در اولین Spike فنی تأیید یا اصلاح می‌شوند و موارد «آینده» فقط Boundary و مسیر توسعه را مشخص می‌کنند.

| تصمیم | وضعیت | Baseline |
| --- | --- | --- |
| Monorepo | قطعی | Bun Workspaces؛ Turborepo فقط در صورت نیاز CI/build |
| Architectural Style | قطعی | Modular Monolith؛ Microservice در شروع ممنوع |
| Control Plane / Business Plane | قطعی | Platform Ops از Dashboard کسب‌وکار جدا |
| Multi-Tenancy | قطعی | Shared DB/Schema با tenant-aware access + PostgreSQL RLS |
| Deployment Modes | قطعی | Shared SaaS، Dedicated Managed، Standalone/Freelance |
| Frontend | قطعی | Next.js App Router + React + Tailwind + shadcn/ui |
| Backend | قطعی | Hono روی Bun؛ API-first و business logic خارج از route |
| Data Layer | قطعی | PostgreSQL + Drizzle ORM + migrations |
| Validation/Contracts | قطعی | Zod shared contracts |
| Website Builder | قطعی | Puck به‌صورت Controlled Composer؛ بدون HTML/JS آزاد برای Merchant |
| Auth | پیشنهادی | Better Auth پشت abstraction داخلی packages/auth |
| Cache | پیشنهادی قوی | Valkey به‌جای Redis برای BSD/open-source simplicity |
| Queue | پیشنهادی قوی | BullMQ + Valkey + apps/worker |
| Search | آینده | PostgreSQL ابتدا؛ Meilisearch/Typesense/OpenSearch در مقیاس |
| AI Provider | باز | Provider abstraction؛ مدل/فروشنده در زمان اجرا قابل تعویض |

## 2. خلاصه اجرایی

محصول یک «فروشگاه‌ساز» صرف نیست. هدف، ساخت یک Business Growth Platform برای کسب‌وکار ایرانی است که یک Business بتواند فقط ماژول‌های موردنیاز خود را فعال کند و تمام داده‌ها، مشتریان، عملیات و کانال‌هایش را از یک هسته مشترک مدیریت کند.

| Positioning پیشنهادی «پلتفرم ساخت، مدیریت و رشد کسب‌وکار»؛ Commerce اولین Module بزرگ است، نه هویت نهایی محصول. |
| --- |

محصول باید همزمان سه مدل فروش را پشتیبانی کند: SaaS چندمستاجری برای بازار انبوه، نسخه Dedicated برای مشتریان بزرگ و نسخه Standalone برای پروژه‌های سفارشی/فریلنسری. هر سه باید از یک codebase و یک Domain Core استفاده کنند تا توسعه و نگهداری fork نشود.

شکل 1 — معماری کلان پیشنهادی: Applicationها از طریق API به Platform Core و Moduleها متصل می‌شوند و Data/Integration/Async Processing لایه‌های جدا دارند.

## 3. مسئله بازار، Vision و Positioning

### 3.1 مسئله اصلی

کسب‌وکار ایرانی برای وب‌سایت، فروشگاه، CRM، پیامک، نوبت‌دهی، شبکه اجتماعی، پرداخت، ارسال و گزارش معمولاً به چند ابزار مستقل نیاز دارد.

داده مشتری بین ابزارها شکسته می‌شود؛ یک فرد ممکن است در فروشگاه، اینستاگرام، رزرو و CRM چهار هویت جدا داشته باشد.

راهکارهای عمومی خارجی با پرداخت، پیامک، تقویم، راست‌چین، زیرساخت و محدودیت‌های بازار ایران اصطکاک دارند.

راهکارهای تخصصی ایرانی عموماً یک Vertical را خوب پوشش می‌دهند اما Business را مجبور به کنارهم‌چیدن چند سیستم می‌کنند.

### 3.2 فرصت بازار

گزارش تجارت الکترونیکی ایران سال ۱۴۰۳ ارزش معاملات را حدود ۵٬۵۰۰ هزار میلیارد تومان، تعداد تراکنش‌ها را حدود ۴.۷ میلیارد و تعداد اینمادهای فعال را بیش از ۳۰۶ هزار اعلام کرده است. این اعداد صرفاً بخش Ecommerce را نشان می‌دهند و دامنه‌ی هدف این Platform بزرگ‌تر و شامل کسب‌وکارهای خدماتی، رستوران، شرکت و Verticalهای دیگر است.

### 3.3 Vision

| Vision هر کسب‌وکار بتواند با یک حساب، یک Customer Core و یک Dashboard، حضور آنلاین، فروش، رزرو، ارتباط با مشتری، بازاریابی و عملیات خود را ماژول‌به‌ماژول فعال کند؛ و Platform همراه با رشد کسب‌وکار توسعه پیدا کند. |
| --- |

### 3.4 Product Principles

| اصل | معنا |
| --- | --- |
| Modular by default | Featureها Capability هستند؛ Verticalها Bundle از Capabilityها. |
| Iran-first, not Iran-locked | UX فارسی/RTL و Integrations ایرانی؛ Core تا حد ممکن generic. |
| One customer identity | Commerce، Booking، Restaurant و Social به Customer واحد متصل می‌شوند. |
| Controlled customization | Merchant آزادی برند/چیدمان دارد اما اجرای arbitrary code ندارد. |
| Own the domain | Frameworkها ابزار هستند؛ Business Logic متعلق به Platform است. |
| One codebase, many deployments | SaaS، Dedicated و Standalone بدون fork دائمی. |
| Progressive complexity | Microservice، Search Engine مستقل و Enterprise infra فقط هنگام نیاز واقعی. |

## 4. کاربران و سناریوهای اصلی

| Persona | نمونه | نیاز اصلی |
| --- | --- | --- |
| Platform Owner / Ops | تیم خود Platform | Tenant، Plan، Billing، Deployment، Support، Feature Flag و Health را مدیریت می‌کند. |
| Business Owner | مالک کسب‌وکار | ماژول‌ها را انتخاب، تیم را مدیریت و KPIهای کل Business را می‌بیند. |
| Business Admin | مدیر اجرایی | محصول/رزرو/سفارش/مشتری/کمپین را طبق Permission مدیریت می‌کند. |
| Staff | کارمند/فروشنده/پذیرش | فقط عملیات مربوط به نقش و شعبه خود را انجام می‌دهد. |
| Customer | مشتری نهایی | از Storefront خرید، رزرو، پرداخت، پیگیری و تعامل می‌کند. |
| Developer / Integration Partner | توسعه‌دهنده داخلی/شریک | API، Webhook، Integration App و Extension می‌سازد. |
| Freelance / Agency Operator | خود تیم یا نماینده | از Core و Moduleها برای ساخت پروژه اختصاصی مشتری استفاده می‌کند. |

## 5. مدل مفهومی Platform

شکل 2 — Tenant برای مالکیت/صورتحساب/امنیت است؛ Business واحد واقعی عملیات است؛ Branch مکان عملیاتی و Moduleها قابلیت‌های فعال Business هستند.

| مفهوم | تعریف |
| --- | --- |
| Tenant | Account سازمانی و مرز Billing/Security. می‌تواند یک یا چند Business داشته باشد. |
| Business | برند/کسب‌وکار واقعی با Customer Base، تنظیمات، Moduleها و Channels. |
| Branch | شعبه فیزیکی یا عملیاتی؛ برای موجودی، کارکنان، نوبت و رستوران مهم است. |
| Module | Capability قابل فعال‌سازی مانند Commerce، Booking، CRM، Social. |
| Vertical Pack | Preset محصولی برای صنعت؛ مثل Beauty Pack = Website + Booking + CRM + SMS. |
| Channel | نقطه تماس/فروش: Website، Shop، Social، POS/API و آینده Marketplace. |
| Customer | هویت واحد مشتری در سطح Business؛ Interactionهای همه Moduleها به آن وصل می‌شود. |

### 5.1 Module vs Vertical Pack

Restaurant، Beauty، Clinic و Retail را به‌عنوان «Vertical» می‌بینیم، نه Module هم‌سطح. Vertical Pack مجموعه‌ای از Moduleها، Templateها، Defaults و Integrations مناسب آن صنعت است.

| Vertical Pack | Moduleهای پیشنهادی |
| --- | --- |
| Retail / Ecommerce | Website + Commerce + CRM + Inventory + Marketing + Shipping |
| Beauty / Salon | Website + Booking + Staff + CRM + Loyalty + SMS |
| Clinic / Services | Website + Booking + CRM + Forms + Payments + Reminders |
| Restaurant / Cafe | Website + Menu + Ordering + Reservation + CRM + Loyalty |
| Corporate | Website + CRM + Forms + Blog + Analytics |
| Education | Website + Booking/Events + CRM + Payments + Content (future) |

## 6. مدل تجاری، Plan و Entitlement

Plan نباید در code با شرط‌هایی مثل plan === "pro" hardcode شود. Plan فقط یک مجموعه Entitlement است؛ Entitlement مشخص می‌کند چه Module/Feature/Limit فعال است.

entitlement.can(businessId, "commerce.enabled")
entitlement.limit(businessId, "commerce.products.max")
entitlement.limit(businessId, "admin.users.max")

### 6.1 مدل درآمدی پیشنهادی

| مدل | شرح |
| --- | --- |
| Base Subscription | دسترسی به Platform Core، Website پایه، User/Role و Dashboard. |
| Module Add-ons | Commerce، Booking، Restaurant، CRM Advanced، Social، Automation، AI. |
| Usage-based | SMS، AI tokens/operations، Storage، Email، API volume یا بعضی Integrationها. |
| Vertical Packs | Bundle آماده با قیمت/Onboarding مشخص برای صنعت. |
| Dedicated Managed | هزینه بالاتر برای DB/Cache/API/Support اختصاصی. |
| Standalone/Freelance | Setup/License/Support قراردادی؛ همان Core بدون fork. |

### 6.2 نمونه Entitlement

| Key | نمونه مقدار | معنا |
| --- | --- | --- |
| website.pages.max | 20 | تعداد Page |
| commerce.enabled | true | فعال بودن ماژول |
| commerce.products.max | 5,000 | حد محصول |
| booking.staff.max | 5 | تعداد کارمند قابل رزرو |
| crm.contacts.max | 10,000 | تعداد Contact |
| social.accounts.max | 3 | تعداد کانال Social |
| automation.runs.monthly | 2,000 | اجرای Workflow |

## 7. Scope و فازبندی محصول

| فاز | خروجی |
| --- | --- |
| P0 — Foundation | معماری، Monorepo، Auth، Tenant/Business، Entitlements، Database، API، CI، Security baseline. |
| P1 — Commerce MVP | Website Builder + Commerce + Customer Core + Order/Payment/Shipping پایه + Platform control. |
| P2 — Growth Core | CRM، Marketing/SMS Automation، Loyalty، SEO/Analytics پیشرفته، Integrations بیشتر. |
| P3 — Service Vertical | Booking + Beauty/Clinic packs + Branch/Staff scheduling. |
| P4 — Restaurant Vertical | Menu، QR، Ordering، Table/Reservation، Kitchen/ops پایه. |
| P5 — Social Growth OS | Unified Inbox، Publishing، Social CRM، Automation cross-channel. |
| P6 — AI & Ecosystem | AI Business Operator، AI site setup، Partner API/App ecosystem، advanced analytics. |

| قاعده Scope در هر فاز فقط Featureهایی وارد Delivery می‌شوند که یا برای Loop اصلی آن فاز ضروری‌اند یا به‌شکل مستقیم Activation/Retention/Revenue را بالا می‌برند. Vision بزرگ می‌ماند، اما Implementation مرحله‌ای است. |
| --- |

## 8. قابلیت‌های تفصیلی ماژول‌ها

### 8.1 Platform Core

| قابلیت | شرح کوتاه |
| --- | --- |
| Tenant & Business | ایجاد Tenant، Business، Brand Profile و Status. |
| Branches | چند شعبه با Address، Timezone، ساعات کاری و تنظیمات عملیاتی. |
| Users & Membership | عضویت افراد در Tenant/Business/Branch. |
| Roles & Permissions | RBAC با Permissionهای granular و آماده‌سازی برای ABAC. |
| Unified Customer | یک Customer ID برای خرید، رزرو، پیام، Loyalty و تعامل. |
| Media Library | مدیریت فایل/تصویر مشترک بین Website و Moduleها. |
| Notifications | Notification center و preference مشتری/کارمند. |
| Audit Trail | ثبت عملیات حساس، تغییرات تنظیمات و دسترسی Support. |

### 8.2 Website / CMS Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Controlled Page Builder | Puck فقط Componentهای ثبت‌شده توسط Platform را نمایش می‌دهد. |
| Templates | Templateهای Corporate، Ecommerce، Beauty، Restaurant و Verticalهای آینده. |
| Responsive Preview | Desktop/Tablet/Mobile preview و design tokens. |
| Brand Tokens | Color، font، radius، spacing، container و button style بدون CSS آزاد. |
| Pages | صفحه اصلی، درباره، تماس، قوانین، Landing و صفحات سفارشی. |
| Blog / Content | Blog، Category، Article، author، SEO metadata. |
| Forms | Contact/lead/custom forms با اتصال به CRM. |
| Domain & SSL | Custom domain، subdomain، SSL automation و domain verification. |
| SEO Technical | Sitemap، robots، canonical، redirects، structured data و metadata. |
| Tracking | Google Analytics/GTM/Clarity یا Provider abstraction. |
| PWA | قابلیت Future/plan-based در صورت ارزش واقعی. |
| AI Site Bootstrap | آینده: ساخت structure/template/content اولیه از prompt. |

### 8.3 Commerce Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Catalog | Physical، Digital، Service/Quote-ready product types. |
| Variants & Options | Color/size/custom options، SKU و price/stock per variant. |
| Categories / Collections / Brands | ساختار Catalog و merchandising. |
| Attributes & Specs | جدول مشخصات، فیلتر و ویژگی‌های قابل جستجو. |
| Media | چند تصویر، ویدیو و alt metadata. |
| Bulk Import/Export | Excel/CSV import، export و bulk update. |
| Inventory | Stock، low-stock alert، reservation و multi-branch/warehouse evolution. |
| Pricing | Base/sale price، scheduled price، price lists و آینده dynamic FX/gold pricing. |
| Search & Filters | PostgreSQL ابتدا؛ engine مستقل در مقیاس. |
| Cart | Persistent cart، min order، coupon، estimates و recovery. |
| Checkout | Address، delivery، payment، custom fields، taxes/fees. |
| Orders | Status workflow، edit، notes، fulfillment، history و returns/refunds evolution. |
| Payments | Direct gateway، payment aggregator، card-to-card، COD و BNPL adapters. |
| Shipping | Manual، pickup، weight/rule based، free shipping threshold و providers. |
| Discounts | Fixed/percent، product/category rules، first purchase، next purchase، scheduled promotions. |
| Customer Wallet | Wallet، cashback، transaction history و credit expiry. |
| Reviews | Product reviews، moderation و structured data. |
| Related Products | Cross-sell/up-sell/recommendation rules. |
| Channels | Torob/Emalls feed، Digikala import، Instagram import و future marketplaces. |
| Digital Delivery | Secure file delivery و download limits. |
| No-price / Quote | محصول بدون قیمت یا درخواست استعلام برای B2B. |

### 8.4 CRM / Customer Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Customer 360 | پروفایل مرکزی با خرید، رزرو، پیام، wallet و campaign history. |
| Contacts / Leads | Lead و Customer lifecycle. |
| Tags & Segments | Segmentation دستی و rule-based. |
| Notes & Activities | یادداشت، تماس، task و timeline. |
| Pipeline | آینده: pipeline فروش برای شرکت‌های خدماتی/B2B. |
| Consent & Preferences | ترجیحات ارتباطی SMS/Email/Social. |
| Import/Export | ورود/خروج Contact و merge duplicate. |
| Customer Value | Top customers، frequency، recency و LTV indicators. |

### 8.5 Booking Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Services | خدمت، مدت، قیمت، deposit و buffer time. |
| Staff | کارمند، مهارت، شعبه و تقویم کاری. |
| Availability | ظرفیت، زمان آزاد، تعطیلات و exceptionها. |
| Appointments | Create/reschedule/cancel/status. |
| Customer Booking | Self-service booking widget/page. |
| Payments | پرداخت کامل یا بیعانه. |
| Reminders | SMS/notification قبل و بعد از appointment. |
| Waitlist | آینده: لیست انتظار و پرکردن slot لغوشده. |
| Resources | آینده: اتاق/تجهیزات/صندلی به‌عنوان resource. |
| Recurring | آینده: جلسات دوره‌ای. |

### 8.6 Restaurant Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Digital Menu | Menu، category، item، modifier، availability. |
| QR Menu | QR per table/branch. |
| Ordering | Dine-in، takeaway، delivery. |
| Tables | Table map/status در فاز پیشرفته. |
| Reservations | رزرو میز با capacity/time rules. |
| Kitchen Flow | Ticket/status ساده و آینده KDS. |
| Restaurant Hours | ساعات سرویس و item availability. |
| Inventory Link | اتصال آیتم به inventory؛ recipe/COGS در آینده. |
| Loyalty | Customer profile، repeat visit و rewards. |

### 8.7 Marketing Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Transactional SMS | Order، payment، booking و system notifications. |
| Campaigns | SMS/Email campaign با segment. |
| Welcome Flow | پیام خوش‌آمدگویی. |
| Abandoned Cart | شناسایی و recovery automation. |
| Win-back | مشتری غیرفعال و reactivation. |
| Post-purchase | پیام/offer بعد از خرید. |
| Birthday / Occasion | Campaign مناسبتی. |
| Review Request | درخواست نظر بعد از fulfilment. |
| Coupon Delivery | ساخت و ارسال offer هدفمند. |
| Attribution | source/campaign attribution در حد قابل اتکا. |

### 8.8 Loyalty Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Wallet | اعتبار قابل خرج با ledger. |
| Cashback | برگشت درصد/مبلغ بعد از رویداد مشخص. |
| Points | امتیاز کسب/مصرف. |
| Tiers | Silver/Gold/VIP یا Tier قابل تعریف. |
| Referral | آینده: referral code و reward دوطرفه. |
| Gift Cards | آینده: کارت هدیه. |
| Expiry | انقضای اعتبار و reminder. |

### 8.9 Social Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Unified Inbox | آینده: گفتگوهای چند کانال در یک Inbox. |
| Identity Linking | اتصال social contact به Customer Core. |
| Comments / DMs | مدیریت interaction و automation. |
| Publishing | تقویم محتوا، draft، approval و scheduling. |
| Social Lead Capture | ساخت Lead از conversation/comment. |
| Social Commerce | ارسال محصول/لینک خرید و تبدیل conversation به order/booking. |
| Team Assignment | assign conversation و SLA. |

### 8.10 Automation Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Triggers | Domain event، schedule، webhook یا data change. |
| Conditions | Ruleهای شرطی و segment checks. |
| Actions | SMS، email، coupon، tag، task، webhook، social action. |
| Delay / Wait | تأخیر زمانی و زمان‌بندی. |
| Branches | if/else و multi-step flow. |
| Templates | Workflowهای آماده per vertical. |
| Execution Log | History، retry، error و manual re-run. |
| Safety | Rate limit و guard برای جلوگیری از spam/loop. |

### 8.11 Analytics Module

| قابلیت | شرح کوتاه |
| --- | --- |
| Business Overview | Revenue/orders/bookings/leads/customers. |
| Sales Analytics | AOV، conversion، product/category performance. |
| Customer Analytics | New/repeat، cohorts، RFM/LTV evolution. |
| Traffic Sources | source/referrer/campaign. |
| Inventory Analytics | low stock، sell-through و dead stock. |
| Booking Analytics | utilization، no-show، staff/service performance. |
| Restaurant Analytics | item sales، peak hours، repeat customer. |
| Marketing ROI | campaign delivery/click/conversion where measurable. |
| Exports | CSV/Excel و scheduled report future. |

### 8.12 AI Layer

| قابلیت | شرح کوتاه |
| --- | --- |
| Content Assistant | Product/page/blog/SEO copy به فارسی. |
| Image Assistant | آینده: background removal/resize/optimization. |
| AI Site Setup | ساخت structure و content اولیه از توضیح Business. |
| Business Q&A | سؤال طبیعی روی sales/orders/customers. |
| Action Agent | عملیات محدود و permission-aware مثل ساخت draft campaign. |
| Insights | تشخیص anomaly/opportunity و پیشنهاد اقدام. |
| Social Assistant | draft post، calendar و response suggestions. |
| Guardrails | تأیید کاربر برای عملیات حساس، audit و scope محدود. |

### 8.13 Integrations

| قابلیت | شرح کوتاه |
| --- | --- |
| Payments | Provider interface برای PSP/aggregator/BNPL ایرانی. |
| SMS | Kavenegar و سایر providerها پشت interface. |
| Shipping | Post/Tipax/Postex/Courier/manual adapters بر حسب قرارداد/API. |
| Accounting | Sepidar و سایر نرم‌افزارها از طریق connector/adapter. |
| Marketplaces | Torob، Emalls، Digikala import/feed و partner APIs. |
| Storage/CDN | S3-compatible؛ Arvan/Liara/other options. |
| Analytics | Google/Clarity و providerهای آینده. |
| Webhooks | Inbound/outbound signed webhooks. |
| Public API | API keys، scopes، rate limits و OpenAPI. |

### 8.14 Platform Control Plane

| قابلیت | شرح کوتاه |
| --- | --- |
| Tenant Lifecycle | Create، trial، activate، suspend، close. |
| Plan Management | تعریف plan و entitlement بدون deploy کد. |
| Module Catalog | فعال/غیرفعال کردن Module و Add-on. |
| Subscriptions | billing period، renewal، grace period و invoice metadata. |
| Usage Metering | SMS/AI/storage/API/limits. |
| Domains | verify، attach، status و SSL state. |
| Deployment Registry | shared/dedicated/standalone metadata. |
| Provisioning | آینده: ساخت DB/cache/deployment dedicated. |
| Feature Flags | rollout per tenant/plan/cohort. |
| Support Console | مشاهده وضعیت و access audited؛ impersonation فقط با policy سخت. |
| System Health | service status، queue، DB، jobs و alerts. |
| Backups / Restore | policy، recovery drills و tenant export. |

## 9. تجربه‌های کاربری و Applicationها

| App | Audience | مسئولیت |
| --- | --- | --- |
| apps/platform | پنل داخلی تیم Platform | Tenant، Plan، Billing، Deployments، Feature Flags، Support، Usage، Health. |
| apps/dashboard | Business Dashboard | Navigation و قابلیت‌ها از Entitlement/Moduleهای Business ساخته می‌شود. |
| apps/storefront | سایت عمومی | Website renderer + component registry + commerce/booking/restaurant widgets. |
| apps/api | Backend API | Hono routes، auth، tenant resolution، validation، domain service calls. |
| apps/worker | Async execution | Campaign، SMS، webhook، indexing، image jobs، reconciliation، automation. |

### 9.1 Dashboard ماژولار

Menu و Screenها بر اساس Entitlement ساخته می‌شوند. Retail ممکن است Products/Orders/Inventory ببیند؛ Salon ممکن است Appointments/Staff/Services و Restaurant Menu/Tables/Orders. Dashboard یک shell مشترک است، نه چند پنل جدا.

### 9.2 Storefront Composer

Merchant فقط Blockهای مورد تأیید Platform را اضافه/حذف/reorder/configure می‌کند. Design tokenها کنترل‌شده‌اند. Custom HTML/JS/CSS به‌صورت پیش‌فرض ممنوع است؛ در Enterprise در صورت نیاز فقط از Snippetهای امن و Allowlist استفاده می‌شود.

## 10. معماری نرم‌افزار و ارتباط اجزا

### 10.1 Modular Monolith

Moduleها boundary مستقل دارند اما در شروع داخل یک backend process اجرا می‌شوند. ارتباط synchronous بین Moduleهای داخل process از interface/service و ارتباط cross-cutting از Domain Event انجام می‌شود. اگر در آینده Module خاصی نیاز به scale مستقل داشت، boundary فعلی امکان extraction به service را می‌دهد.

شکل 3 — Request path و asynchronous event path.

### 10.2 قوانین Dependency

| لایه | قاعده |
| --- | --- |
| Storefront | می‌تواند contracts، themes، ui و API client را import کند؛ database ممنوع. |
| Dashboard | contracts، ui، themes، auth client؛ database مستقیم ممنوع. |
| Platform | contracts، ui، auth client؛ commerce internals مستقیم ممنوع. |
| API | domain modules، database، contracts، auth، tenancy، integrations. |
| Worker | domain modules، database، contracts، integrations، events. |
| Domain Modules | Platform Core، contracts، integration interfaces؛ React/Next/Hono/Puck ممنوع. |

## 11. Monorepo و Folder Tree واقعی

business-platform/
├── apps/
│   ├── platform/          # Control Plane - Next.js
│   ├── dashboard/         # Business Dashboard - Next.js
│   ├── storefront/        # Public Website/Storefront - Next.js
│   ├── api/               # Hono + Bun
│   └── worker/            # BullMQ workers
│
├── packages/
│   ├── platform-core/
│   │   ├── business/
│   │   ├── branch/
│   │   ├── customer/
│   │   ├── membership/
│   │   └── shared/
│   │
│   ├── modules/
│   │   ├── website/
│   │   ├── commerce/
│   │   ├── crm/
│   │   ├── booking/
│   │   ├── restaurant/
│   │   ├── marketing/
│   │   ├── loyalty/
│   │   ├── social/
│   │   └── analytics/
│   │
│   ├── database/
│   │   ├── schema/
│   │   │   ├── platform/
│   │   │   ├── commerce/
│   │   │   ├── booking/
│   │   │   ├── crm/
│   │   │   └── website/
│   │   ├── migrations/
│   │   ├── repositories/
│   │   ├── rls/
│   │   └── seed/
│   │
│   ├── contracts/        # Zod schemas + DTOs
│   ├── auth/             # Better Auth adapter + permissions
│   ├── tenancy/          # tenant/business/domain resolver
│   ├── entitlements/     # plan/module/limit resolution
│   ├── integrations/
│   │   ├── payments/
│   │   ├── sms/
│   │   ├── shipping/
│   │   ├── accounting/
│   │   ├── storage/
│   │   ├── social/
│   │   └── search/
│   ├── events/           # domain events + outbox contracts
│   ├── automation/       # workflow engine
│   ├── themes/           # Puck registry + templates + renderer
│   ├── ui/               # shadcn design system
│   └── config/
│
├── deployments/
│   ├── saas/
│   ├── dedicated/
│   └── standalone/
│
├── tooling/
├── scripts/
├── docs/
│   ├── adr/
│   ├── prd/
│   └── runbooks/
├── package.json
├── bun.lock
├── bunfig.toml
└── tsconfig.json

### 11.1 ساختار داخلی یک Module

packages/modules/commerce/src/
├── catalog/
│   ├── domain/
│   ├── services/
│   ├── repositories/      # interfaces only
│   └── events/
├── inventory/
├── cart/
├── checkout/
├── orders/
├── payments/
├── shipping/
├── discounts/
└── index.ts

Repository implementationهای وابسته به Drizzle در packages/database قرار می‌گیرند؛ Domain تا جای ممکن interface را می‌شناسد، نه ORM را.

## 12. معماری داده و Multi-Tenancy

### 12.1 مدل پایگاه داده

مدل پیش‌فرض SaaS: Shared PostgreSQL Cluster + Shared Schema. تمام رکوردهای Business-owned دارای tenant_id و معمولاً business_id هستند. Indexها باید از tenant/business شروع شوند تا Query pattern چندمستاجری بهینه باشد.

products(
  id uuid primary key,
  tenant_id uuid not null,
  business_id uuid not null,
  slug text not null,
  ...
)

UNIQUE (business_id, slug)
INDEX  (tenant_id, business_id, status)
INDEX  (business_id, category_id, status)

### 12.2 Isolation

Tenant middleware در Hono context را تعیین می‌کند.

Service/Repositoryهای tenant-owned بدون tenantId/businessId API ندارند.

PostgreSQL RLS برای جداول حساس Defense-in-Depth ایجاد می‌کند.

Platform DB و Business/Commerce DB حداقل به‌صورت logical boundary جدا نگه داشته می‌شوند.

Dedicated tenant در آینده می‌تواند datasource مستقل بگیرد بدون تغییر Domain Model.

### 12.3 Customer Identity

Customer entity در Platform Core قرار می‌گیرد و Moduleها reference ایجاد می‌کنند: CommerceOrder.customerId، BookingAppointment.customerId، SocialConversation.customerId و LoyaltyAccount.customerId. Merge/deduplication باید در آینده با phone/email/social identity انجام شود.

### 12.4 Money و Time

Money با integer minor unit یا Money value object ذخیره می‌شود؛ از float برای پول استفاده نمی‌شود.

Currency canonical ترجیحاً IRR است؛ نمایش تومان presentation concern است.

Timestampها UTC ذخیره می‌شوند؛ تاریخ شمسی فقط presentation/input adapter است.

Timezone per Business/Branch نگه‌داری می‌شود.

## 13. API، Contracts، Events و Automation

### 13.1 API

| Namespace | هدف |
| --- | --- |
| /api/v1/public/* | Storefront data، catalog، website rendering data |
| /api/v1/auth/* | Authentication / session |
| /api/v1/business/* | Business settings، customers، modules |
| /api/v1/commerce/* | Catalog/cart/checkout/orders |
| /api/v1/booking/* | Services/availability/appointments |
| /api/v1/platform/* | Control plane operations |
| /api/v1/webhooks/* | Provider callbacks / partner webhooks |

Zod schemaها source of truth قرارداد هستند. OpenAPI باید از schema/route metadata تولید شود. API keyها scope و rate limit دارند و public integration از internal implementation جداست.

### 13.2 Domain Events

| Event | مصرف‌کنندگان احتمالی |
| --- | --- |
| OrderCreated | CRM timeline، analytics، SMS، loyalty، webhook |
| PaymentSucceeded | order transition، receipt، analytics |
| CartAbandoned | marketing automation |
| AppointmentBooked | reminder، CRM، analytics |
| CustomerCreated | welcome flow / dedupe |
| PagePublished | cache invalidation / revalidation |
| ProductUpdated | search index / storefront cache invalidation |

### 13.3 Reliability Pattern

برای eventهای critical از Transactional Outbox استفاده می‌شود تا commit دیتابیس و انتشار job از هم جدا و قابل بازیابی باشند. Queue jobها idempotent، retryable و دارای dead-letter/error handling خواهند بود.

## 14. امنیت، حریم خصوصی و Audit

| کنترل | Baseline |
| --- | --- |
| Authentication | Better Auth baseline؛ email/mobile OTP/password، session management، MFA برای نقش‌های حساس. |
| Authorization | RBAC و permission per Business/Branch؛ platform permissions جدا. |
| Tenant Isolation | middleware + repository discipline + PostgreSQL RLS. |
| Session/Cookies | HttpOnly، Secure، SameSite مناسب و rotation. |
| Input Validation | Zod برای تمام untrusted input؛ file validation جدا. |
| Rate Limiting | Valkey-based per IP/user/business/API key. |
| CSRF/CORS | Explicit origins، credentials rules و CSRF protection برای flows مربوط. |
| Security Headers | CSP، HSTS، X-Content-Type-Options و policyهای مناسب. |
| Secrets | Secret manager/env injection؛ عدم ذخیره secret در repo. |
| Payment Security | عدم ذخیره اطلاعات کارت؛ verification server-side و signature/callback validation. |
| Webhooks | Signature + timestamp + replay protection. |
| Audit Logs | Login، permission، money، plan، deployment و support access. |
| Backups | PITR، encrypted backups، restore drill. |
| Uploads | Signed upload، MIME/size validation؛ malware scanning در فاز Enterprise. |
| Support Access | حداقل دسترسی؛ impersonation فقط audited/just-in-time و ترجیحاً consent-based. |

| Security Rule Cross-tenant data exposure یک Sev-0 است. هیچ Feature یا deadline حق ندارد Tenant Isolation را دور بزند. |
| --- |

## 15. Performance، Scalability و Reliability

هدف اولیه پشتیبانی مطمئن از ۱۰۰۰+ Business است. تعداد Tenant به‌تنهایی معیار Scale نیست؛ بار واقعی با request rate، SKU، سفارش، فایل، Search و jobs سنجیده می‌شود.

| موضوع | راهبرد |
| --- | --- |
| Storefront Cache | CDN + Next cache + Valkey؛ درخواست عمومی تا حد ممکن به DB نرسد. |
| Cache Keys | business/page/product scoped؛ invalidation دقیق پس از publish/update. |
| DB Indexing | Indexها بر اساس tenant/business + query pattern. |
| Connection Pooling | Pool محدود و observability؛ جلوگیری از connection storm. |
| Async Work | SMS/email/webhook/indexing/image/AI در worker. |
| Horizontal Scale | Storefront/API/Worker stateless تا جای ممکن و قابل scale-out. |
| Images | Object Storage + CDN، نه BLOB در PostgreSQL. |
| Search | Postgres FTS ابتدا؛ جداشدن Search Engine در threshold مشخص. |
| Read Replicas | فقط وقتی read pressure اثبات شد. |
| Dedicated | tenant بزرگ را بدون fork به infra اختصاصی منتقل می‌کنیم. |

## 16. Infrastructure، Deployment و نسخه Standalone

شکل 4 — هر سه مدل از یک Monorepo و Core استفاده می‌کنند.

| Mode | برای چه کسی | ساختار |
| --- | --- | --- |
| Shared SaaS | اکثر Businessها | Shared apps/API/DB/Valkey/Object Storage؛ tenant isolation logical. |
| Dedicated Managed | مشتری بزرگ/حساس | Dedicated DB و در صورت نیاز cache/API/worker؛ Control Plane همچنان مدیریت می‌کند. |
| Standalone/Freelance | مشتری با استقرار مستقل | Storefront + Dashboard + API + Worker + DB + Valkey در زیرساخت مشتری؛ Platform app اجباری نیست. |

### 16.1 Deployment Artifacts

deployments/
├── saas/
│   ├── Dockerfiles
│   ├── compose.dev.yml
│   └── manifests/          # provider-specific later
├── dedicated/
│   └── templates/
└── standalone/
    ├── docker-compose.yml
    ├── reverse-proxy/
    └── .env.example

### 16.2 Provider Independence

Storage، SMS، Payment، Shipping و حتی AI باید interface داشته باشند. برای بازار ایران امکان استفاده از زیرساخت داخلی (مثلاً S3-compatible storage/CDN یا VPS/Platform provider) بدون تغییر Domain Logic لازم است.

## 17. Technology Stack و Version Baseline

Baseline زیر در تاریخ 9 September 2026 ثبت شده است. نسخه‌ها در bun.lock pin می‌شوند. Security patchها سریع بررسی می‌شوند و Major upgrade نیازمند ADR است.

| Technology | Baseline | Role | Status |
| --- | --- | --- | --- |
| Bun | 1.4.2 | Runtime، package manager، workspaces | قطعی |
| Next.js | 16.3.3 | Platform/Dashboard/Storefront — Active LTS | قطعی |
| React | 19.2.8 | UI runtime | قطعی |
| TypeScript | 6.0.3 pinned | زبان اصلی؛ latest 7.0.2 است اما upgrade پس از compatibility spike | قطعی موقت |
| Tailwind CSS | 4.3.3 | Styling/design tokens | قطعی |
| shadcn CLI | 4.21.0 | Design system source distribution؛ Base UI baseline | قطعی |
| Hono | 4.13.7 | API framework | قطعی |
| Zod | 4.4.3 | Validation/contracts | قطعی |
| Drizzle ORM | 0.45.2 | Data access | قطعی |
| Drizzle Kit | 0.31.10 | Migrations/tooling | قطعی |
| PostgreSQL | 18.6 | Primary relational DB | قطعی |
| Puck | 0.23.0 | Controlled visual composer | قطعی |
| Better Auth | 1.7.3 | Auth framework behind internal abstraction | پیشنهادی قوی |
| Valkey | 8.1.10 baseline | Cache/locks/rate-limit/queue datastore؛ BSD | پیشنهادی قوی |
| BullMQ | 6.3.4 | Background jobs؛ Valkey compatible | پیشنهادی قوی |

### 17.1 چرا Valkey به‌جای Redis؟

Redis 8 امکان AGPLv3/RSALv2/SSPLv1 دارد. استفاده مستقیم به‌عنوان datastore داخل SaaS لزوماً ممنوع نیست، اما محصول ما نسخه Standalone و احتمالاً توزیع تجاری هم دارد؛ بنابراین Valkey با BSD و پشتیبانی Linux Foundation baseline ساده‌تری برای حقوقی، hosting و customer deployment است. Redis-compatible clients همچنان امکان جایگزینی را حفظ می‌کنند.

### 17.2 shadcn Base

برای پروژه جدید Base UI baseline است و RTL از ابتدا در Design System تست می‌شود. source componentها داخل repository ما هستند و از یک registry داخلی برای consistency بین apps استفاده می‌کنیم.

## 18. تست، CI/CD و Observability

### 18.1 Test Strategy

| نوع | هدف |
| --- | --- |
| Unit | Bun test برای domain/service/value objects. |
| Integration | PostgreSQL/Valkey test containers یا isolated services برای repository و policies. |
| Contract | Zod/API contract tests و webhook fixtureها. |
| E2E | Playwright برای signup، publish، checkout، booking و platform flows. |
| Security | RLS/tenant isolation regression tests؛ auth/permission matrix. |
| Load | k6 یا معادل برای storefront/API/checkout. |
| Migration | migration up/down/forward compatibility test روی snapshot. |

### 18.2 CI/CD Pipeline

Install locked dependencies

Lint/format

Typecheck

Unit tests

Integration tests

Build all affected apps

Migration validation

Security/dependency scan

Container build

Deploy staging

Smoke/E2E

Manual/automated production gate

Post-deploy health check

### 18.3 Observability

Structured JSON logs با requestId/tenantId/businessId (بدون PII غیرضروری).

Metrics: latency، error rate، DB pool، queue lag، cache hit، payment success.

Distributed tracing با OpenTelemetry در فاز production maturity.

Error monitoring مانند Sentry-compatible provider پشت config.

Runbook و alert برای payment callback، queue backlog، DB saturation، domain/SSL failures.

## 19. الزامات مخصوص بازار ایران

| موضوع | Requirement |
| --- | --- |
| RTL / Persian | UI فارسی-first، RTL واقعی، اعداد/فونت فارسی و accessibility. |
| Jalali | نمایش و ورودی تاریخ شمسی؛ storage UTC Gregorian. |
| Money | IRR canonical؛ نمایش تومان configurable و تبدیل centralized. |
| Mobile / OTP | شماره موبایل +98 و OTP flow بهینه. |
| Payments | درگاه مستقیم/واسط، card-to-card، COD، BNPL از طریق adapters. |
| Shipping | پست، پیک، ارسال سفارشی، pickup و provider integrations. |
| SMS | Provider abstraction و template/transactional messages. |
| Marketplaces | Torob/Emalls feeds، import از Digikala/Instagram در صورت API/قانونی بودن. |
| Accounting | Connector برای نرم‌افزارهای حسابداری رایج. |
| Domestic Infrastructure | امکان object storage/CDN/hosting داخلی بدون vendor lock. |
| SEO فارسی | slug policy، schema، sitemap، performance، metadata و content tools. |
| Compliance | اینماد/مالیات/فاکتور/حریم خصوصی بر اساس قوانین جاری؛ قبل launch بازبینی حقوقی جدا انجام شود. |

## 20. Roadmap اجرایی از قدم اول تا مقیاس

| مرحله | Deliverable |
| --- | --- |
| Step 0 — Repository Bootstrap | Bun monorepo، apps/packages skeleton، lint/typecheck/build، env/config. |
| Step 1 — Identity & Tenancy | Better Auth، Tenant/Business/Branch، memberships، roles، RLS baseline. |
| Step 2 — Control Plane Foundation | Tenant lifecycle، plans، entitlements، module catalog، domains. |
| Step 3 — Website Engine | Themes، Puck registry، publish/versioning، domain resolution، cache. |
| Step 4 — Commerce Catalog | Products، variants، categories، inventory، import/export. |
| Step 5 — Cart / Checkout / Orders | Cart، pricing، discount، order transaction، idempotency. |
| Step 6 — Iran Integrations | Payment، SMS، shipping، object storage. |
| Step 7 — Merchant Dashboard | Commerce UI، customers، reports، settings. |
| Step 8 — Production Hardening | Observability، backups، security tests، load tests، CI/CD، rate limits. |
| Step 9 — SaaS Launch | Trial/onboarding، billing process، support tools، usage metering. |
| Step 10 — Growth Core | CRM، marketing automation، wallet/loyalty، advanced SEO/analytics. |
| Step 11 — Booking | Service/staff/calendar/appointment/deposit/reminder. |
| Step 12 — Restaurant Pack | Menu، ordering، QR، reservation و restaurant operations. |
| Step 13 — Social | Inbox، identity linking، publishing، social automations. |
| Step 14 — AI Operator | Data Q&A، recommendations، controlled actions، AI site bootstrap. |
| Step 15 — Ecosystem | Public API maturity، webhooks، app/partner model، dedicated provisioning automation. |

### 20.1 MVP Definition

| MVP قابل فروش Platform Core + Tenant/Business + Website Builder + Commerce Catalog/Cart/Checkout/Orders + حداقل یک Payment Provider + SMS تراکنشی + Shipping پایه + Customer Core + Product/Order Dashboard + Domain/SSL + SEO پایه + Plan/Entitlement + Security/Backup/Monitoring baseline. |
| --- |

### 20.2 چیزی که در MVP نمی‌سازیم

Microservices

Marketplace app store کامل

Social unified inbox

AI autonomous actions

Advanced restaurant KDS/recipe costing

Enterprise SSO/SCIM

Complex workflow builder عمومی

Dedicated auto-provisioning کامل

Multiple search clusters

## 21. KPI، SLO و معیارهای پذیرش

| KPI | تعریف |
| --- | --- |
| Activation | Business بتواند از signup تا publish اولین سایت/فروشگاه با حداقل اصطکاک برسد. |
| Time-to-First-Value | هدف محصولی: راه‌اندازی پایه در یک session؛ KPI دقیق پس از usability test. |
| Retention | Active business weekly/monthly و module usage. |
| Revenue | MRR، ARPU، module attach rate، churn. |
| Commerce | GMV (در صورت استفاده داخلی)، order success، checkout conversion. |
| Platform | support tickets per active business، deployment failures، billing errors. |

| SLO | هدف اولیه |
| --- | --- |
| Availability | 99.9% initial target برای core SaaS؛ ارتقا بر اساس plan/scale. |
| Storefront cached response | P95 سریع و CDN-first؛ budget عملی پس از انتخاب hosting/load test. |
| API read | P95 < 300ms برای queryهای معمول در محیط production target. |
| Checkout backend | P95 < 1.5s بدون زمان gateway external. |
| Error rate | <1% application errors؛ critical flow target پایین‌تر. |
| RPO | <=15 min برای production data target با PITR. |
| RTO | <=2 hours initial; Dedicated/Enterprise می‌تواند سخت‌گیرانه‌تر باشد. |
| Tenant Isolation | Zero tolerated cross-tenant leakage. |

## 22. ریسک‌ها و راهکارها

| ریسک | اثر | راهکار |
| --- | --- | --- |
| Scope Explosion | Platform می‌تواند Shopify+Calendly+HubSpot+Hootsuite شود. | فازبندی سخت، module PRD جدا، MVP gate. |
| Over-abstraction | Plugin system بیش از نیاز اولیه پیچیده شود. | Modular monolith و interface فقط در boundary واقعی. |
| Tenant Data Leak | خطای query باعث exposure شود. | RLS + repository API + automated isolation tests. |
| Iran Provider Instability | API/شرایط providerها تغییر کند. | Adapter + fallback provider + retries + reconciliation. |
| Fork Hell in Freelance | هر مشتری codebase جدا شود. | Config/theme/extensions؛ no permanent client fork. |
| Performance by DB Overuse | هر storefront request چند DB query بزند. | CDN/cache/revalidation/data aggregation. |
| Payment Inconsistency | callback duplicate/lost. | idempotency + verification + reconciliation jobs. |
| Licensing | وابستگی با license نامناسب برای standalone. | License review؛ Valkey BSD baseline؛ OSS register. |
| AI Safety/Cost | هزینه و عملیات ناخواسته. | provider abstraction، budgets، approval، audit. |
| Social API Restrictions | کانال‌ها policy/API محدود کنند. | official APIs only، connector isolation، graceful degradation. |

## 23. تصمیم‌های باز و ADRها

| موضوع | حوزه | وضعیت |
| --- | --- | --- |
| Brand/Name | Product/Marketing | TBD |
| Exact Billing Provider/Process | Platform | نیاز به بررسی بازار و مالی/حقوقی |
| First Payment Provider | Commerce | بعد از API/قرارداد و priority بازار |
| First SMS Provider | Integrations | Kavenegar candidate؛ benchmark قیمت/تحویل |
| Hosting Primary | Infrastructure | Provider داخلی/VPS/cloud بر اساس SLA و هزینه |
| Object Storage Primary | Infrastructure | S3-compatible provider |
| Search Engine threshold | Architecture | تعریف بر اساس SKU/search QPS |
| TypeScript 7 migration | Tooling | بعد از compatibility spike با Next/Bun/toolchain |
| Accounting first connector | Integrations | براساس مشتریان اولیه |
| Tax/Invoice legal scope | Compliance | بازبینی حقوقی قبل از production billing/invoicing |

هر تغییر معماری مهم در docs/adr با شماره و rationale ثبت می‌شود؛ مثال: ADR-001 Modular Monolith، ADR-002 Valkey vs Redis، ADR-003 Tenant RLS Strategy.

## ضمیمه A — Feature Backlog جامع و اولویت پیشنهادی

جدول زیر Inventory قابلیت‌هایی است که از تحلیل رقبا، Vision محصول و نیازهای Platform استخراج شده است. این لیست «تعهد زمانی» نیست؛ برای هر Feature در PRD ماژول مربوطه Acceptance Criteria نوشته خواهد شد.

| Module | Feature | Phase | شرح |
| --- | --- | --- | --- |
| Platform | Audit logs | P0 | فعالیت حساس |
| Platform | Branch management | P0 | شعب متعدد |
| Platform | Business management | P0 | چند Business زیر Tenant |
| Platform | Deployment registry | P0 | shared/dedicated/standalone |
| Platform | Domain registry | P0 | custom/subdomain |
| Platform | Entitlements | P0 | feature/limit resolution |
| Platform | Feature flags | P0 | rollout کنترل‌شده |
| Platform | Module catalog | P0 | فعال‌سازی add-on |
| Platform | Plan management | P0 | Plan data-driven |
| Platform | Roles/permissions | P0 | RBAC granular |
| Platform | Support console | P0 | وضعیت tenant و troubleshooting |
| Platform | Tenant lifecycle | P0 | ساخت/فعال/تعلیق/بستن Tenant |
| Platform | Usage metering | P0 | SMS/AI/storage/API |
| Commerce | Abandoned cart | P1 | سبد رهاشده |
| Commerce | Advanced discount | P1 | rules |
| Commerce | Attributes | P1 | ویژگی و spec |
| Commerce | BNPL | P1 | اقساط |
| Commerce | Brands | P1 | برند |
| Commerce | Bulk import | P1 | Excel/CSV |
| Commerce | Bulk update | P1 | ویرایش گروهی |
| Commerce | COD | P1 | پرداخت محل |
| Commerce | Card-to-card | P1 | کارت‌به‌کارت |
| Commerce | Carrier integrations | P1 | پست/پیک |
| Commerce | Cart | P1 | سبد |
| Commerce | Cashback | P1 | بازگشت اعتبار |
| Commerce | Categories | P1 | دسته‌بندی |
| Commerce | Checkout fields | P1 | فرم سفارشی |
| Commerce | Collections | P1 | مجموعه |
| Commerce | Customer notifications | P1 | وضعیت سفارش |
| Commerce | Digikala import | P1 | انتقال کالا در صورت امکان |
| Commerce | Digital products | P1 | فایل دیجیتال |
| Commerce | Discount fixed | P1 | مبلغی |
| Commerce | Discount percent | P1 | درصدی |
| Commerce | Dynamic pricing | P1 | آینده ارز/طلا |
| Commerce | Export | P1 | خروجی داده |
| Commerce | Filters | P1 | فیلتر |
| Commerce | First purchase promo | P1 | خرید اول |
| Commerce | Flash deal | P1 | پیشنهاد زمان‌دار |
| Commerce | Free shipping | P1 | شرط مبلغ |
| Commerce | Instagram import | P1 | انتقال محتوا/کالا در صورت امکان |
| Commerce | Inventory | P1 | موجودی |
| Commerce | Low-stock alert | P1 | هشدار |
| Commerce | Marketplace feeds | P1 | ترب/ایمالز |
| Commerce | Minimum order | P1 | حداقل سبد |
| Commerce | Next purchase promo | P1 | خرید بعدی |
| Commerce | No-price product | P1 | بدون قیمت/استعلام |
| Commerce | Order edit | P1 | ویرایش |
| Commerce | Order management | P1 | مدیریت سفارش |
| Commerce | Order statuses | P1 | وضعیت و تاریخچه |
| Commerce | Payment aggregator | P1 | پرداخت‌یار |
| Commerce | Payment direct | P1 | درگاه مستقیم |
| Commerce | Payment link | P1 | لینک پرداخت |
| Commerce | Physical products | P1 | کالای فیزیکی |
| Commerce | Pickup | P1 | تحویل حضوری |
| Commerce | Postpaid shipping | P1 | پس‌کرایه |
| Commerce | Product form | P1 | فیلد سفارشی |
| Commerce | Product media | P1 | تصویر/ویدیو |
| Commerce | Related products | P1 | cross-sell |
| Commerce | Reviews | P1 | دیدگاه |
| Commerce | Search | P1 | جستجو |
| Commerce | Services/quote products | P1 | خدمت/استعلام |
| Commerce | Shipping rules | P1 | روش‌های ارسال |
| Commerce | VAT/fees | P1 | مالیات/هزینه |
| Commerce | Variant form | P1 | فیلد تنوع |
| Commerce | Variants | P1 | تنوع |
| Commerce | Wallet | P1 | کیف پول |
| Commerce | Weight shipping | P1 | محاسبه وزن |
| Website | Analytics tags | P1 | GA/GTM/Clarity |
| Website | Backup | P1 | policy و restore |
| Website | Banners/sliders | P1 | بلوک‌های تبلیغاتی |
| Website | Blog | P1 | محتوا و SEO |
| Website | CDN | P1 | delivery assets |
| Website | Canonical | P1 | canonical URL |
| Website | Custom domain | P1 | دامنه اختصاصی |
| Website | Forms | P1 | فرم تماس/lead |
| Website | Internal pages | P1 | صفحات ثابت |
| Website | Managed hosting | P1 | زیرساخت مدیریت‌شده |
| Website | No-code website | P1 | ساخت بدون کد |
| Website | Noindex | P1 | کنترل indexing |
| Website | Puck editor | P1 | ویرایشگر controlled |
| Website | Redirects | P1 | 301/302 |
| Website | Responsive preview | P1 | موبایل/تبلت/دسکتاپ |
| Website | SEO metadata | P1 | title/description |
| Website | SSL | P1 | گواهی خودکار |
| Website | Sitemap | P1 | خودکار |
| Website | Structured data | P1 | schema.org |
| Website | Templates | P1 | قالب‌های آماده |
| Website | Theme tokens | P1 | رنگ/فونت/layout |
| Analytics | Booking report | P2 | رزرو |
| Analytics | Campaign report | P2 | کمپین |
| Analytics | Customer report | P2 | مشتری |
| Analytics | Export reports | P2 | خروجی |
| Analytics | Inventory report | P2 | موجودی |
| Analytics | Product performance | P2 | محصول |
| Analytics | Restaurant report | P2 | رستوران |
| Analytics | Sales report | P2 | فروش |
| Analytics | Traffic source | P2 | ورودی |
| CRM | Activities | P2 | تعاملات |
| CRM | Customer 360 | P2 | پروفایل واحد |
| CRM | Duplicate merge | P2 | ادغام تکراری |
| CRM | Import/export | P2 | داده مشتری |
| CRM | Leads | P2 | سرنخ |
| CRM | Notes | P2 | یادداشت |
| CRM | Pipeline | P2 | فروش B2B آینده |
| CRM | Segments | P2 | سگمنت |
| CRM | Tags | P2 | برچسب |
| CRM | Top customers | P2 | مشتریان برتر |
| Loyalty | Cashback rules | P2 | قواعد کش‌بک |
| Loyalty | Gift cards | P2 | کارت هدیه |
| Loyalty | Points | P2 | امتیاز |
| Loyalty | Referral | P2 | معرف |
| Loyalty | Tiers | P2 | سطح وفاداری |
| Loyalty | Wallet ledger | P2 | دفتر کل کیف پول |
| Marketing | Abandoned cart SMS | P2 | بازیابی سبد |
| Marketing | Attribution | P2 | منبع ورودی |
| Marketing | Birthday | P2 | تولد |
| Marketing | Campaign SMS | P2 | کمپین |
| Marketing | Credit expiry | P2 | انقضای اعتبار |
| Marketing | Inactive customer | P2 | winback |
| Marketing | Online chat integration | P2 | چت |
| Marketing | Post-purchase | P2 | بعد از خرید |
| Marketing | Retargeting hooks | P2 | اتصال تبلیغات |
| Marketing | Review request | P2 | درخواست نظر |
| Marketing | Survey integration | P2 | نظرسنجی |
| Marketing | Transactional SMS | P2 | پیام تراکنشی |
| Marketing | Welcome | P2 | خوش‌آمد |
| Automation | Actions | P2/P5 | عمل |
| Automation | Branches | P2/P5 | شاخه |
| Automation | Conditions | P2/P5 | شرط |
| Automation | Execution log | P2/P5 | لاگ |
| Automation | Rate guards | P2/P5 | جلوگیری spam |
| Automation | Retry | P2/P5 | تلاش مجدد |
| Automation | Templates | P2/P5 | workflow آماده |
| Automation | Triggers | P2/P5 | رویداد |
| Automation | Wait | P2/P5 | تاخیر |
| Developer | API keys | P2/P6 | کلید |
| Developer | OpenAPI | P2/P6 | مستندات |
| Developer | Partner apps | P2/P6 | اکوسیستم آینده |
| Developer | Public API | P2/P6 | API باز |
| Developer | Rate limits | P2/P6 | محدودیت |
| Developer | SDK | P2/P6 | آینده |
| Developer | Scopes | P2/P6 | دسترسی |
| Developer | Webhook logs | P2/P6 | لاگ و retry |
| Developer | Webhooks | P2/P6 | Webhook |
| Booking | Appointment | P3 | رزرو |
| Booking | Availability | P3 | ظرفیت |
| Booking | Cancellation | P3 | لغو |
| Booking | Deposit | P3 | بیعانه |
| Booking | Multi-branch | P3 | چند شعبه |
| Booking | Recurring booking | P3 | دوره‌ای |
| Booking | Reminder | P3 | یادآوری |
| Booking | Reschedule | P3 | تغییر زمان |
| Booking | Resources | P3 | اتاق/تجهیز |
| Booking | Schedule | P3 | ساعات کاری |
| Booking | Services | P3 | خدمات |
| Booking | Staff | P3 | پرسنل |
| Booking | Waitlist | P3 | انتظار |
| Restaurant | Delivery order | P4 | ارسال |
| Restaurant | Dine-in order | P4 | سفارش حضوری |
| Restaurant | Item availability | P4 | موجود/ناموجود |
| Restaurant | Kitchen tickets | P4 | تیکت آشپزخانه |
| Restaurant | Menu | P4 | منو |
| Restaurant | Menu modifiers | P4 | افزودنی |
| Restaurant | QR menu | P4 | QR |
| Restaurant | Recipe/COGS | P4 | آینده قیمت تمام‌شده |
| Restaurant | Reservation | P4 | رزرو میز |
| Restaurant | Tables | P4 | میز |
| Restaurant | Takeaway | P4 | بیرون‌بر |
| Social | Assignment | P5 | ارجاع تیم |
| Social | Comment management | P5 | کامنت |
| Social | Content calendar | P5 | تقویم محتوا |
| Social | DM management | P5 | پیام |
| Social | Lead capture | P5 | سرنخ از social |
| Social | Publishing | P5 | انتشار |
| Social | Scheduling | P5 | زمان‌بندی |
| Social | Social commerce | P5 | تبدیل به خرید/رزرو |
| Social | Social identity | P5 | اتصال به customer |
| Social | Unified inbox | P5 | صندوق ورودی |
| AI | AI site bootstrap | P6 | ساخت اولیه سایت |
| AI | Business Q&A | P6 | سؤال روی داده |
| AI | Campaign drafting | P6 | کمپین |
| AI | Image cleanup | P6 | تصویر |
| AI | Insight detection | P6 | پیشنهاد رشد |
| AI | Permissioned actions | P6 | عملیات با تأیید |
| AI | Product description | P6 | توضیح محصول |
| AI | SEO assistant | P6 | سئو |
| AI | Social drafting | P6 | محتوا |

## ضمیمه B — Competitive Landscape

رقبای مستقیم Commerce فعلی شامل سازیتو، دیجی‌فای و میکسین هستند. اپیشاپ نیز از نظر Vision به «زیرساخت یکپارچه کسب‌وکار» نزدیک است و به‌عنوان رقیب/سیگنال بازار باید پایش شود. Featureهای عمومی قابل مشاهده رقبا در Feature Backlog بالا ادغام شده‌اند.

| رقیب | تمرکز مشاهده‌شده |
| --- | --- |
| سازیتو | Commerce feature depth، SEO، Wallet/CRM-style features، marketing automation، API/accounting؛ همچنین نسخه نوبت‌دهی. |
| دیجی‌فای | اکوسیستم دیجی‌کالا/دیجی‌پی/دیجی‌اکسپرس، acquisition، payment/logistics، AI tools. |
| میکسین | Store operations، visual editing، ترب، shipping، smart SMS/pricing و AI operational assistant. |
| اپیشاپ | Vision نزدیک به Business infrastructure: website/store/CRM/reservation/chat/payment + AI site setup. |

### B.1 مزیت رقابتی موردنظر ما

Module architecture واقعی و Entitlement-based؛ نه چند محصول جدا با login/data جدا.

Unified Customer Core بین Commerce، Booking، Restaurant، Social و CRM.

یک codebase که هم SaaS و هم Dedicated/Standalone را پشتیبانی می‌کند.

Provider abstraction مخصوص بازار ایران برای جلوگیری از قفل‌شدن به سرویس خاص.

Automation cross-module و در آینده AI Operator روی داده یکپارچه.

Vertical Packs عمیق، اما با reuse واقعی Moduleها.

## ضمیمه C — واژه‌نامه و منابع

| اصطلاح | تعریف |
| --- | --- |
| Control Plane | بخش مدیریت خود SaaS: tenant، plan، billing، deployment. |
| Business Plane | محیط عملیات کسب‌وکار و Moduleها. |
| Tenant | مرز مالکیت/صورتحساب/امنیت. |
| Business | کسب‌وکار عملیاتی/برند. |
| Entitlement | مجوز Feature یا Limit قابل محاسبه از Plan/Add-on. |
| Module | قابلیت مستقل Domain مانند Commerce یا Booking. |
| Vertical Pack | Bundle از Module+Template+Defaults برای صنعت. |
| RLS | Row Level Security در PostgreSQL. |
| Outbox | الگوی انتشار قابل اتکای event پس از transaction. |
| Puck | Visual editor کنترل‌شده برای React. |
| Valkey | BSD key-value datastore سازگار با Redis protocol. |
| ADR | Architecture Decision Record. |

### C.1 منابع فنی و بازار (Snapshot: 2026-09-09)

| منبع | URL / Note |
| --- | --- |
| Next.js | https://nextjs.org/blog — 16.3.3 Active LTS security release |
| Bun | https://bun.sh/ — 1.4.2 |
| React | https://www.npmjs.com/package/react — 19.2.8 |
| Tailwind CSS | https://www.npmjs.com/package/tailwindcss — 4.3.3 |
| shadcn/ui | https://ui.shadcn.com/ — CLI 4.21.0; Base UI default for new projects |
| Hono | https://www.npmjs.com/package/hono — 4.13.7 |
| Zod | https://www.npmjs.com/package/zod — 4.4.3 |
| Drizzle ORM | https://www.npmjs.com/package/drizzle-orm — 0.45.2 |
| Drizzle Kit | https://www.npmjs.com/package/drizzle-kit — 0.31.10 |
| PostgreSQL | https://www.postgresql.org/docs/release/18.6/ — 18.6 |
| Puck | https://www.npmjs.com/package/@puckeditor/core — 0.23.0 |
| Better Auth | https://better-auth.com/ — 1.7.3; Hono/Next integrations |
| Valkey | https://valkey.io/ — BSD; 8.1.10/9.1.2 current lines |
| BullMQ | https://www.npmjs.com/package/bullmq — 6.3.4; Valkey support |
| Redis licensing | https://redis.io/legal/licenses/ — Redis 8 tri-license |
| Iran ecommerce report | https://ecomotive.ir/wp-content/uploads/2025/10/ec_report1403.pdf |
| Sazito | https://sazito.com/ ; https://sazito.com/pricing |
| Digify | https://digify.shop/ ; https://digify.shop/pricing |
| Mixin | https://mixin.ir/ ; https://mixin.ir/pricing |
| Appeshop | https://appeshop.ir/products |

## نتیجه و Definition of Done این Master PRD

این سند Vision و Architecture مادر را تثبیت می‌کند. گام بعدی توسعه سند نیست، بلکه تبدیل هر Domain به PRD تخصصی و Backlog اجرایی است. ترتیب پیشنهادی PRDهای بعدی: (1) Platform Core & Tenancy، (2) Website Builder، (3) Commerce Catalog/Inventory، (4) Checkout/Orders/Payments، (5) Plans/Billing/Entitlements، سپس CRM/Marketing و Verticalها.

| Baseline نهایی Monorepo + Modular Monolith + Control Plane + Multi-Tenant Business Core + Module System + Next.js/shadcn/Puck + Hono/Bun/Zod + Drizzle/PostgreSQL + Valkey/BullMQ + Provider-based Iranian Integrations + Shared/Dedicated/Standalone Deployment. |
| --- |
