# Backup, Disaster Recovery & Data Lifecycle

- Backup و DR یکی نیستند.
- RPO/RTO برای deployment tier تعریف می‌شود.
- PostgreSQL: scheduled backup + PITR/WAL strategy.
- Object storage: versioning/backup/lifecycle.
- Config/infra/secrets recovery plan دارند.
- Backup بدون restore test قابل اعتماد محسوب نمی‌شود.
- Logical recovery از full DB restore جداست.
- Entity deletion policy یکی از: hard-delete / soft-delete / archive / immutable.
- Recycle Bin برای resourceهای مناسب.
- Business deletion یک workflow کنترل‌شده و module-aware است.
- Critical backups در برابر production credential compromise محافظت شوند.
- Sensitive migration قبل از اجرا backup/PITR health را verify می‌کند.
- DR runbook و periodic drill.
- MVP: reliable single region + off-site backup بهتر از multi-region ناقص.
- Critical jobs/webhooks idempotent باشند تا recovery duplicate effect نسازد.
