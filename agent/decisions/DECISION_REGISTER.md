# Decision Register — D-001 تا D-072

> این فایل Baseline رسمی تصمیم‌هاست. تصمیم جدید باید شماره بعدی بگیرد. اگر تصمیمی تغییر کند، تصمیم قبلی حذف نمی‌شود؛ `Superseded` می‌شود و تصمیم جدید به آن ارجاع می‌دهد.

| ID | عنوان | تصمیم قطعی |
|---|---|---|
| D-001 | مدل ورود به بازار | Hybrid Services + Platform از روز اول. |
| D-002 | Positioning | پلتفرم «رشد و مدیریت هوشمند کسب‌وکار»؛ نه صرفاً سایت‌ساز یا فروشگاه‌ساز. |
| D-003 | رابطه با مشتری | همکاری بلندمدت و نقش Digital Partner، نه پروژه یک‌باره. |
| D-004 | مدل مشاوره/اجرا | ابتدا Human-led؛ در آینده AI + Human، با AI برای intake/analysis و انسان برای اجرا. |
| D-005 | پیشنهاد تجاری اولیه | Setup/Launch + همکاری ماهانه بلندمدت. |
| D-006 | بازار اولیه | Retail + Service + Small Company با Core مشترک و Template/Pack جدا. |
| D-007 | Domain اصلی | Business-centric؛ Business موجودیت عملیاتی اصلی و Moduleها قابلیت‌های متصل به آن هستند. |
| D-008 | Multi-business | یک User می‌تواند چند Business را مالک/مدیریت کند. |
| D-009 | Team/permissions rollout | UX می‌تواند ساده شروع شود، ولی معماری از ابتدا Team/Role/Permission-ready باشد؛ با D-040 به Full RBAC ارتقا یافت. |
| D-010 | Module/Plugin strategy | First-party internal modules اکنون؛ اکوسیستم Plugin خارجی بعداً. |
| D-011 | جهت MVP | Core + Website + Customer Core + Industry Templates؛ از ساخت همزمان همه Moduleها اجتناب شود. |
| D-012 | Website Builder | Controlled Template + Section/Block Editor؛ نه full free-form drag/drop. |
| D-013 | Deployment مشتری | Hosted/Managed پیش‌فرض + Standalone برای نیازهای خاص. |
| D-014 | ورود مشتری | Hybrid Self-Service + Consultant Assisted. |
| D-015 | تعامل با محصول | Customer Dashboard محور اصلی است؛ تیم داخلی نیز مدیریت/پشتیبانی دارد. |
| D-016 | AI در MVP | AI در MVP نیست؛ foundation داده و business ابتدا. |
| D-017 | اولویت Panelها | Customer Dashboard + Consultant Dashboard، با اولویت Customer. |
| D-018 | Onboarding | مسیر سریع برای نیاز ساده + مسیر assessment/consulting برای نیاز پیچیده. |
| D-019 | Scope اولیه قابل ساخت | Core + Website + Customer/Lead پایه + Consultant Panel؛ Commerce/Loyalty/Booking/Automation/AI/Marketplace عمومی بعداً. |
| D-020 | Backend architecture | Modular Monolith؛ Microservices فقط در صورت نیاز واقعی آینده. |
| D-021 | Multi-tenancy | Hybrid: shared DB/tenant isolation برای SaaS + dedicated DB/deployment برای Enterprise. |
| D-022 | ساختار Business | Business → Branch از روز اول. |
| D-023 | Scope داده ماژول | Business-level + Branch-level hybrid. |
| D-024 | Pricing engine | Business subscription + Module add-ons + Usage-based؛ metering foundation از ابتدا. |
| D-025 | Agency/Partner | Agency/Partner Account از ابتدا در معماری و محصول. |
| D-026 | White-label | معماری از ابتدا White-label-ready؛ activation بعداً. |
| D-027 | Marketplace | Internal Module Catalog ابتدا؛ Public Marketplace بعداً. |
| D-028 | Customer/CRM | Customer Core در Platform؛ CRM Advanced به‌عنوان Module مستقل. |
| D-029 | Website جایگاه | Website یک Core-Level Module است؛ modular ولی معمولاً default/available. |
| D-030 | تعداد Website | MVP یک Website برای هر Business؛ data architecture آماده 1:N. |
| D-031 | Template ownership | Templateها ابتدا توسط تیم داخلی؛ Marketplace Template در آینده. |
| D-032 | Editor model | Section/Block Editor با reorder/toggle/content/theme محدود؛ بدون HTML/CSS arbitrary. |
| D-033 | Data ownership | Shared Core Entities + Module-owned specialized data؛ duplicate Customer/Business ممنوع. |
| D-034 | Event model | Shared Event/Activity Core + module-specific events؛ cross-cutting via events/contracts. |
| D-035 | API strategy | API-first برای Core؛ implementation فقط نیاز فعلی، ولی آماده Public API/Plugins/Mobile/AI. |
| D-036 | Frontend architecture | Monorepo، چند app مستقل + shared packages/design system/api client. |
| D-037 | Rendering | Public websites SSR/SSG/cache-oriented؛ Dashboard interactive SPA-like. |
| D-038 | Storage | Object Storage از ابتدا؛ S3-compatible abstraction؛ blobs داخل DB/backend server ممنوع. |
| D-039 | Identity | Platform User model + auth provider abstraction؛ authorization/membership جدا از authentication. |
| D-040 | RBAC | Full Role + Permission از ابتدا. |
| D-041 | RBAC scope | Scoped RBAC: Platform → Agency → Business → Branch → Module. |
| D-042 | Deployment operations | Container-first, Kubernetes-ready؛ Kubernetes فقط هنگام نیاز Scale. |
| D-043 | Cloud strategy | Cloud-agnostic با Docker/PostgreSQL/S3-compatible/Kubernetes/adapters. |
| D-044 | Database architecture | PostgreSQL + Core Schema + Module Schemas؛ ownership و migrations مستقل. |
| D-045 | Market entry presentation | General Platform Entry + limited Retail/Service/Corporate templates/presets. |
| D-046 | Go-to-market | Direct Sales First → Partner Scale. |
| D-047 | Revenue model | Setup Fee + Subscription + Service Packages؛ هر سه پشتیبانی شوند. |
| D-048 | Entry product | ابتدا Digital Business Setup، سپس Growth Partnership. |
| D-049 | Product documentation strategy | Master Product/Architecture baseline + Domain PRDs + Feature PRDs؛ نه یک سند عظیم واحد. |
| D-050 | Build ownership | Business capabilities را خودمان می‌سازیم؛ OSS برای research/pattern/library/infra؛ business OSS runtime وابستگی اصلی نمی‌شود. |
| D-051 | Feature/module governance | Core minimal، domain ownership اجباری، Core/Module/Integration classification، contracts/events، manifests و mini-PRD. |
| D-052 | Repository/module standard | Monorepo رسمی + استاندارد یکسان Module Template + framework-independent domain. |
| D-053 | Versioning/upgrades | SemVer، module versions، compatibility، expand-migrate-contract، immutable artifacts، feature flags. |
| D-054 | Observability/audit/support | Structured logs، correlation، metrics/tracing، audit، support console، health model و incident/runbook. |
| D-055 | Security/tenant isolation | Defense-in-depth: context + scoped RBAC + repository scope + RLS + isolation across cache/storage/queue/events. |
| D-056 | Backup/DR/data lifecycle | PITR/backups/object versioning/restore tests/logical recovery/retention/DR drills. |
| D-057 | Performance/scalability | Stateless apps، async workers، caching measured، tenant-aware indexes/limits، scale stepwise، no premature microservices/sharding. |
| D-058 | Integration/provider abstraction | Modules never know providers directly؛ provider interfaces/adapters، webhook inbox، outbox، canonical data/errors. |
| D-059 | Billing/entitlements/usage | BillingAccount، Catalog، Plan/Price separation، effective entitlements، usage events/meters، add-ons/overage-ready. |
| D-060 | Configuration/flags/environment | Config/Flag/Entitlement/Secret/Environment جدا؛ typed registry، scoped inheritance، no customer-specific code. |
| D-061 | Deep data architecture | Domain ownership، canonical entities، UUIDv7 preferred، transaction boundaries، outbox/inbox، schema ownership. |
| D-062 | API/contracts | REST-first transport، typed contracts، public/internal separation، pagination/idempotency/versioning/OpenAPI. |
| D-063 | Testing/quality | Test pyramid، real Postgres integration tests، tenant/permission/contract/migration/E2E/compliance suites. |
| D-064 | Frontend/design/UX | One design language، tokens، RTL/LTR، module registry navigation، consistent tables/forms/states، lazy modules. |
| D-065 | CI/CD/release | Trunk-based، PR gates، build once/deploy many، immutable artifacts، staging/canary/rollback، no manual prod edits. |
| D-066 | Supply-chain/AppSec | Dependency/license/security review، lockfiles/scans، minimal non-root containers، secret/crypto/web security baselines. |
| D-067 | Privacy/data governance | Classification/PII registry، minimization، consent history، export/delete/anonymize/residency/policy versioning. |
| D-068 | Documentation/governance | ADR، engineering handbook، generated catalogs، runbooks، tech debt registry، dependency-aware roadmap. |
| D-069 | Capability Level Gate | قبل از کدنویسی هر capability غیرجزئی، Agent باید Basic و Advanced را توضیح دهد و منتظر انتخاب صریح کاربر بماند؛ quality foundation همیشه کامل است. |
| D-070 | Task-driven implementation | هر Capability پس از Level Gate با Test Plan و Task Packetهای کوچک، file-by-file plan، commandهای قابل تکرار و acceptance evidence اجرا می‌شود. |
| D-071 | Agent output verification | خروجی Coding Agent فقط پس از بررسی واقعی diff/files + test evidence + security/performance/architecture checks تأیید می‌شود؛ ادعای Agent evidence نیست. |
| D-072 | OSS benchmark before major capability design | برای Capabilityهای مهم قبل از finalize design تحقیق feature-specific روی محصولات/OSS mature انجام می‌شود؛ adoption pattern مستقل از direct code reuse است و direct reuse نیازمند license/dependency review است. |
