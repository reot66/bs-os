# Agent Feature Flow & Capability Level Rule

## Mandatory Flow
```text
User Request
→ Clarify feature only if truly necessary
→ Problem statement
→ Domain placement
→ Dependencies
→ Basic vs Advanced scopes
→ User selects level
→ Feature spec / PRD delta
→ Architecture impact
→ Implementation
→ Tests
→ Release
```

## Agent must stop before implementation
اگر Level انتخاب نشده، Agent حق تولید implementation کامل ندارد. می‌تواند analysis/design را ارائه کند اما باید selection بگیرد.

## Basic/Advanced Comparison must include
- User outcome
- Included capabilities
- Explicit exclusions
- Data model impact
- Dependencies
- Upgrade path
- Cost/complexity note کوتاه

## Foundation is never downgraded
Security/Tenant isolation/RBAC/Data/Test/Observability/Migrations/API quality در Basic همان استاندارد Advanced را دارد.

## Mid-development discovery
Scope extension → owner decision. Silent scope creep ممنوع.
