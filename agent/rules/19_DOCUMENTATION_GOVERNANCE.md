# Documentation, ADR & Engineering Governance

- Documentation نزدیک code و version-controlled.
- Architecture docs، Engineering Handbook، Product PRDها، Runbooks و ADRها نقش متفاوت دارند.
- Decision مهم معماری → ADR.
- ADR حذف نمی‌شود؛ superseded می‌شود.
- Rule قابل enforce باید CI/lint/test داشته باشد؛ Markdown تنها کافی نیست.
- Module README/manifest docs: purpose/entities/permissions/events/metrics/config/integrations/data governance.
- OpenAPI/Event/Permission/Config catalogs تا حد امکان generated.
- Incident مهم postmortem.
- Technical Debt Registry جدا از Feature Backlog.
- Decision Register D-001+ history رسمی است.
- Core/new-module/security/public-API changes architecture review می‌خواهند.
- Documentation update بخشی از DoD.
- Engineering standard versioned؛ freeze baseline به معنی immutable forever نیست.
- Exception باید documented/scoped/owned/reviewable باشد.
- Roadmap dependency-aware است، Owner ترتیب را تغییر می‌دهد.
