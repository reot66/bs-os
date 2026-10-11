# Product & Scope Governance Rules

- Product یک Growth & Business Management Platform است، نه یک vertical-specific app.
- Core نباید برای هر صنعت تغییر کند.
- Vertical Pack یک bundle/config/template از capabilityهاست؛ فقط وقتی Domain اختصاصی واقعی دارد Module اختصاصی ساخته می‌شود.
- Feature جدید مستقیم وارد Code نمی‌شود: Problem → Domain → Level Gate → Spec → Development.
- Roadmap dependency-aware است و Owner ترتیب را تعیین می‌کند.
- AI در foundation اولیه requirement نیست؛ AI future consumer of platform APIs/events/data است.
- Business capabilityهای استراتژیک Build-first هستند؛ OSS کامل فقط reference/research است مگر Decision جدید.
- Customer-specific branch در code ممنوع است.
- Scope extension هنگام development باید به Owner گزارش شود.
