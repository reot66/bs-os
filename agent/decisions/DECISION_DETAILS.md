# Decision Details — Rationale Summary

## Product & GTM (D-001 تا D-019)
Platform عمداً بین Agency و pure SaaS قرار نمی‌گیرد؛ مدل Hybrid Services + Platform انتخاب شد تا اولین مشتریان از طریق مشاوره و setup واقعی وارد شوند و محصول از نیاز واقعی یاد بگیرد. Positioning از Website/Store Builder به Digital Business Setup و سپس Growth Partnership ارتقا یافت. بازار اولیه general اما کنترل‌شده است: Retail، Service و Small Company با Core یکسان و preset/template متفاوت. Customer Dashboard سطح اصلی تعامل است و AI در MVP dependency نیست.

## Core Architecture (D-020 تا D-044)
Modular Monolith، hybrid multi-tenancy، Business→Branch، hybrid business/branch data scope، Agency support، internal module catalog، Customer Core canonical، Website core-level module، API-first، multiple frontend apps، object storage، auth abstraction و full scoped RBAC انتخاب شدند. Deployment container-first/cloud-agnostic و DB PostgreSQL با core/module schemas است.

## Commercial/GTM evolution (D-045 تا D-049)
Platform با templateهای محدود برای چند دسته business معرفی می‌شود. GTM از direct sales شروع و بعد partner scale می‌شود. Revenue هر سه setup/subscription/service را دارد و entry message ابتدا Digital Business Setup است. Documentation strategy چندسندی است تا product/architecture/moduleها قابل نگهداری باشند.

## Build ownership & Engineering Foundation (D-050 تا D-068)
Business capabilities first-party ساخته می‌شوند و OSS محصولی بیشتر reference است. Feature/module governance، repository standard، versioning، observability، tenant security، DR، scale، provider abstraction، billing/entitlements، configuration، data architecture، API contracts، testing، UX system، CI/CD، supply-chain security، privacy/data governance و engineering governance به‌عنوان Foundation Rules رسمی ثبت شدند.

## Agent Capability Gate (D-069)
Owner عمق هر capability را تعیین می‌کند. Agent قبل از implementation باید Basic/Advanced را توضیح دهد و منتظر selection بماند. Foundation quality در Basic کاهش نمی‌یابد و هر scope extension نیازمند تصمیم Owner است.
