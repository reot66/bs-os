# API & Contract Architecture

- Internal Product API و Public API contract levels متفاوت دارند.
- REST-first؛ Domain transport-agnostic.
- Business logic در route ممنوع.
- Pipeline: Auth → Context → Authorization → Validation → Rate limit → Application service → response mapping.
- Shared typed schemas/contracts؛ shape validation از domain validation جدا.
- Stable error codes؛ client متن error را parse نکند.
- Resource-oriented URLs و domain action endpoints برای commandهای واقعی.
- Lists: limit/pagination/filter/sort/search conventions.
- Sensitive create/command endpoints idempotency key.
- Optimistic concurrency/version support where needed.
- Long-running action → async Job API.
- Internal API backward-compatible evolution؛ Public API version/deprecation policy.
- OpenAPI generated from contracts.
- Machine/API actors scoped and audited.
- Realtime UI transport از domain event bus جدا.
- Storefront public API surface از management API جدا.
- Direct-to-object-storage uploads با signed URL.
- Public webhook API versioned/signed/retried و از internal event bus جدا.
