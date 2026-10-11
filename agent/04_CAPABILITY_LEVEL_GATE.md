# Capability Level Gate — Basic / Advanced

## Rule

قبل از Implementation هر قابلیت non-trivial، Agent باید دو Scope بدهد و متوقف شود تا Owner انتخاب کند.

## خروجی اجباری Agent

### Feature
نام قابلیت

### Problem
این قابلیت چه مشکل واقعی را حل می‌کند؟

### Placement
Core / Module / Integration + Domain Owner

### Basic
حداقل نسخه production-ready.

- Included
- Excluded
- User outcome
- Dependencies
- Upgrade path

### Advanced
Basic + قابلیت‌های حرفه‌ای.

- Included additions
- User outcome
- Additional dependencies/complexity

### Future / Enterprise (informational)
فقط برای جلوگیری از بستن Architecture.

### Recommendation
Agent می‌تواند Trade-off توضیح دهد، ولی انتخاب نهایی با Owner است.

### Decision Required

- A) Basic
- B) Advanced

Agent تا انتخاب صریح Implementation را آغاز نمی‌کند.

## Quality Invariant

Basic و Advanced هر دو باید full foundation quality داشته باشند:

- security
- tenant isolation
- authorization
- migrations
- tests
- observability
- contracts
- error handling
- privacy/data lifecycle

## مثال — Social Scheduling

### Basic

- connect social account
- compose content
- media
- schedule
- calendar basic
- publish
- status/retry
- cancel scheduled publication

### Advanced

Basic +

- bulk scheduling
- recurring content
- approvals
- campaign grouping
- collaboration
- richer analytics
- advanced calendar

## Scope Extension Rule

اگر حین Implementation feature جدید لازم/جذاب شد:

```text
Scope Extension Detected
Current Level: Basic
New capability: Approval Workflow
Impact: Advanced scope
Decision: Add now / Keep for later
```
