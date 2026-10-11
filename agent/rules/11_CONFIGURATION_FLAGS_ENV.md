# Configuration, Feature Flags & Environments

## پنج مفهوم مستقل
Configuration ≠ Feature Flag ≠ Entitlement ≠ Secret ≠ Environment.

## Config hierarchy
Platform → Deployment → Tenant/Agency → Business → Branch/Module.
Config definition مشخص می‌کند کدام scope اجازه override دارد و آیا lock می‌شود.

## Typed Registry
هر config: key, type, default, scopes, validation, visibility, dynamic/restart-required, version.
Unknown key رد می‌شود.

## Feature Flags
برای rollout/experiment/kill switch؛ owner/review date/lifecycle دارند و بعد از stable rollout حذف می‌شوند.

## Environments
local/test/staging/production و preview در صورت نیاز. Environment vars فقط bootstrap/infra، نه business settings.

## Prohibited
`if businessId === X` یا config مخصوص customer در source code ممنوع. نیاز خاص با config/entitlement/flag/module/integration/extension حل شود.

## Effective UI/Product State
Permission + Entitlement + Flag + Config + Integration Health.
