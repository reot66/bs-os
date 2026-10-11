# agent/ — Complete Agent Context Pack

این فولدر برای دادن مستقیم به Coding/Product Agent ساخته شده است. تمام فایل‌ها Markdown هستند.

## شروع Agent
به ترتیب بخوان:
1. `AGENT.md`
2. `00_PROJECT_CONTEXT.md`
3. `prd/00_MASTER_PRD.md`
4. `decisions/DECISION_REGISTER.md`
5. `rules/00_RULES_INDEX.md`
6. PRD مربوط به کاری که قرار است انجام شود
7. Ruleهای مرتبط

## ساختار
```text
agent/
├── README.md
├── AGENT.md
├── 00_PROJECT_CONTEXT.md
├── 01_PRODUCT_VISION.md
├── 02_BUSINESS_MODEL.md
├── 03_DOMAIN_MODEL.md
├── 04_CAPABILITY_LEVEL_GATE.md
├── GLOSSARY.md
├── decisions/
├── rules/
├── prd/
├── roadmap/
├── templates/
└── source/
```

## Source of Truth
- تصمیم‌های جدید: `decisions/DECISION_REGISTER.md`
- Ruleها: `rules/`
- محصول فعلی: `prd/00_MASTER_PRD.md`
- سند قبلی: `source/LEGACY_MASTER_PRD_V1.md` فقط historical reference

## Important Agent Rule
قبل از کدنویسی capability غیرجزئی، Basic vs Advanced را ارائه کن و منتظر انتخاب Owner بمان.

## PRDهای موجود
PRDهای Domain در این Pack Vision/Boundary/Basic/Advanced candidate را نگه می‌دارند. Scope دقیق Feature فقط پس از انتخاب Level توسط Owner قطعی می‌شود.

## Deep references
- Architecture map: `architecture/ARCHITECTURE_MAP.md`
- Engineering handbook: `engineering/ENGINEERING_HANDBOOK.md`
- Feature workflow: `workflow/FEATURE_WORKFLOW.md`
- Detailed approved rules: `rules/FOUNDATION_RULES_DETAILED.md`
- Detailed product decisions: `decisions/PRODUCT_DECISIONS_DETAIL.md`
- Legacy PRD conversion: `source/LEGACY_MASTER_PRD_V1.md`
- Complete file list: `FILE_INDEX.md`

## Execution layer added
برای توسعه task-driven و handoff به Coding Agent:

- `workflow/TASK_DRIVEN_DELIVERY_PROTOCOL.md`
- `workflow/AGENT_REVIEW_GATE.md`
- `research/OSS_BENCHMARK_PROTOCOL.md`
- `templates/TASK_PACKET_TEMPLATE.md`
- `templates/AGENT_IMPLEMENTATION_PROMPT_TEMPLATE.md`
- `templates/AGENT_OUTPUT_REVIEW_TEMPLATE.md`
- `templates/TEST_PLAN_TEMPLATE.md`
