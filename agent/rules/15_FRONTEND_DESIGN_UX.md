# Frontend, Design System & UX

- چند app، یک Design Language.
- Shared primitives + shared product components.
- Token-based styling: color/spacing/type/radius/shadow; no random hardcoded styles.
- RTL/LTR، locale، timezone، number/currency/date presentation از روز اول.
- Jalali presentation only؛ storage UTC.
- Frontend module boundaries مشابه backend؛ direct cross-module UI dependency محدود.
- Navigation/routes از Module Registry، نه hardcoded sidebar.
- Standard page shell/table/filter/form/loading/empty/error/status patterns.
- Permission-denied، not-entitled، needs-setup و degraded-integration UX از هم جدا.
- Effective UI state = permission + entitlement + flag + config + integration state.
- Website Builder interaction خاص ولی design system مشترک.
- White-label via tokens/theme، نه CSS fork.
- Component library versioned/deprecated deliberately.
- Component lab/Storybook-like environment.
- Code splitting/lazy module routes.
- Shared API client/data fetching/cache patterns.
- Server remains authoritative؛ frontend guards security نیستند.
