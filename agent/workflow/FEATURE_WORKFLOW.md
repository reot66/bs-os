# Feature Workflow — از ایده تا Release

```text
Idea / Owner Request
      ↓
Problem definition
      ↓
Domain placement
      ↓
Dependency check
      ↓
Capability Level Gate (Basic/Advanced)
      ↓
Owner decision
      ↓
Feature PRD/Spec
      ↓
Architecture impact check
      ↓
Data/API/Event/Permission/Usage/Config design
      ↓
Implementation plan
      ↓
Development
      ↓
Tests + Compliance
      ↓
Preview/Staging
      ↓
Release behind flag when appropriate
      ↓
Observe / Iterate
```

## Foundation Change Detection

اگر Feature نیازمند تغییر یکی از Ruleهای بنیادین است، Implementation متوقف و ADR پیشنهاد می‌شود.

## Mini-PRD Requirement

قابلیت non-trivial باید حداقل Feature Spec داشته باشد، حتی اگر Module PRD قبلاً وجود دارد.

## Scope Fields

- selected level
- included
- excluded
- future
- dependencies
- acceptance criteria
- Definition of Done
