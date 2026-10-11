# PRD — Future AI Intelligence Layer

## Status
Future؛ AI dependency MVP/Foundation نیست.

## Potential Basic Candidate (when activated)
- Business data Q&A روی authorized data
- Summaries
- Recommendations
- Content drafting
- Safe read-only assistant tools

## Potential Advanced Candidate
Basic + controlled actions, workflow automation, growth analyst, business operator, AI site bootstrap, cross-module reasoning, human approval policies.

## Mandatory Guardrails
- same RBAC/tenant scope as human actors
- tool-level permissions
- auditable actions
- deterministic APIs/contracts
- no cross-tenant context leakage
- provider abstraction/data governance
- human approval for high-risk actions where appropriate

## Capability Level Gate
**Level هنوز انتخاب نشده است مگر Owner صریحاً انتخاب کند.** قبل از implementation Agent باید Basic و Advanced را با scope دقیق ارائه کند.

## Engineering Baseline
در هر Level تمام Foundation Rules مربوط به Security, tenancy, tests, observability, data ownership, migrations, contracts و audit رعایت می‌شوند.
