# Glossary

- **Platform:** کل محصول و زیرساخت.
- **Tenant/Organization:** مرز security/billing/contract.
- **Business:** موجودیت عملیاتی کسب‌وکار.
- **Branch:** شعبه/واحد عملیاتی زیر Business.
- **Module:** business capability قابل فعال‌سازی.
- **Vertical Pack:** bundle از template/config/modules برای صنعت؛ لزوماً Module نیست.
- **Customer Core:** هویت canonical مشتری بین Moduleها.
- **Control Plane:** ابزار داخلی Platform برای مدیریت tenant/deployment/support/billing.
- **Entitlement:** حق/limit استفاده از capability.
- **Feature Flag:** rollout switch، نه commercial access.
- **Configuration:** رفتار قابل تنظیم capability.
- **Integration:** اتصال به external provider/system.
- **Provider Adapter:** implementation یک provider پشت interface داخلی.
- **Domain Event:** رخداد business meaningful.
- **Outbox/Inbox:** الگوهای reliability/idempotency برای event processing.
- **Basic Level:** scope عملیاتی حداقلی ولی production-grade.
- **Advanced Level:** عمق حرفه‌ای بیشتر روی همان foundation.
