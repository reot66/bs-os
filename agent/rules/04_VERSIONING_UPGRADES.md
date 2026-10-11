# Versioning & Upgrade Rules

- Platform، Module، DB schema، Public API، Event schema، Template و Deployment versions مفهوم مستقل دارند.
- SemVer مبناست.
- Module Manifest minimum compatible platform/core versions را اعلام می‌کند.
- Production migration رسمی و versioned است.
- Breaking schema changes با `Expand → Migrate/Backfill → Contract`.
- Forward-only migration strategy؛ rollback اصلی application/config است، data recovery جداست.
- Public API/Event breaking changes versioned و deprecation window دارند.
- Template definition از customer overrides جداست.
- Release artifacts immutable و pinned هستند؛ `latest` در production ممنوع.
- Shared/Dedicated/Standalone upgrade policy متفاوت ولی artifact مشترک.
- Feature flag برای progressive rollout؛ entitlement جای آن نیست.
- Dependency major upgrades نیازمند compatibility test و در تغییرات مهم ADR.
- Job payloads و worker compatibility باید version-aware باشند.
