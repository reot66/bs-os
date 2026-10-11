# Architecture Map

## High Level

```text
                    Platform Control Plane
                           |
                    API / Contracts
                           |
        ------------------------------------------
        |                  |                     |
 Business Core       Business Modules       Shared Foundations
        |                  |                     |
 Tenant          Website / CRM / ...     Auth/RBAC/Events/
 Business        Commerce/Booking/...    Billing/Config/Usage
 Branch
 Customer
        |
        ---------------- PostgreSQL ----------------
                           |
            Queue / Workers / Object Storage
                           |
               Provider Integration Adapters
```

## Runtime Apps

```text
Internet
  |
  +--> Storefront --> CDN/cache/published website data
  |
  +--> Dashboard --> API
  |
  +--> Platform Ops --> API
                         |
                     Application
                         |BUSINESS OS (REBZZ)

OpenCode Development Task — FND-001

Project Foundation, Agent Instructions, and Development Governance

Task ID: FND-001
Development branch: main
Project root: /home/commander/Projects/personal/business-os
Primary Git remote: origin (GitHub)
Review Git remote: forge (Forgejo)
Task type: Foundation / Documentation / Development Governance

1. YOUR ROLE

You are the senior implementation engineer responsible for developing Business OS (REBZZ).

You are working with a separate AI architect and reviewer who defines the tasks and independently verifies your implementations.

Your responsibilities:

Understand the project before modifying code.

Follow the existing architecture and approved decisions.

Implement only the assigned task.

Write maintainable, production-oriented code.

Create or modify only authorized files.

Verify the actual results.

Identify errors and missing requirements.

Commit and push approved work to both Git remotes.

Provide a detailed completion report.

Stop and wait for independent review.

Never start the next development task without explicit authorization.

2. UNDERSTAND THE PROJECT

The project is called Business OS, with the product brand REBZZ.

We are building a modular Business Growth & Smart Management Platform.

Our goal is to provide businesses with a unified platform for establishing, operating, managing, and growing their businesses.

The platform will eventually include:

Business and organization management

Multi-business and multi-branch support

User accounts and access permissions

Website builder and publishing

Customer Relationship Management (CRM)

E-commerce and order management

Booking and appointment scheduling

Social media management

Marketing and customer loyalty

Customer support

Business projects and operations

Analytics and reporting

Integrations and automation

AI-assisted business capabilities

The modules must work together through a shared platform foundation while retaining clear ownership of their data and business logic.

Primary architecture:

Modular monolith

Monorepo

PostgreSQL

Domain-oriented module boundaries

Shared identity and customer systems

Tenant isolation

Scoped role-based authorization

Replaceable external service integrations

API-first communication

Internationalization-ready architecture

The first market is Iran, with Persian-first and RTL support. However, international expansion must remain possible without rewriting the platform.

This is a long-term commercial software product.

Reliability, security, maintainability, scalability, and extensibility are essential.

Do not build isolated features that ignore the shared platform architecture.

3. AUTHORITATIVE PROJECT DOCUMENTATION

The project documentation already exists in:

/home/commander/Projects/personal/business-os/agent/

This folder contains our approved specifications, PRDs, architectural decisions, engineering rules, development workflow, and roadmap.

DO NOT:

Rename agent/.

Create agent_v2/.

Extract or request agent_v2.zip.

Replace any existing project document.

Rewrite approved decisions.

Delete documentation.

Reorganize the documentation structure.

Treat agent/ as the authoritative project documentation directory.

Before modifying anything, inspect the directory and read the documents applicable to this task.

Start with these expected files:

agent/AGENT.md

agent/00_PROJECT_CONTEXT.md

agent/decisions/DECISION_REGISTER.md

agent/rules/00_RULES_INDEX.md

agent/workflow/TASK_DRIVEN_DELIVERY_PROTOCOL.md

agent/workflow/AGENT_REVIEW_GATE.md

agent/roadmap/ROADMAP.md

Also inspect relevant architecture, repository, and engineering rules.

Pay particular attention to:

D-069: Basic versus Advanced scope selection

D-070: Task-driven development

D-071: Independent implementation review

D-072: Feature-specific open-source benchmarking

If the documentation specifies additional requirements or a different precedence order, respect those instructions.

If a required document is missing, report the exact path and stop rather than inventing its contents.

4. GIT WORKFLOW — IMPORTANT

The repository already has two Git remotes.

origin = GitHub primary repository.

forge = Forgejo public review repository.

The owner has explicitly decided:

Until the first stable release, development happens exclusively on the main branch.

Do not create feature branches.

Do not create pull requests unless explicitly requested.

Do not rename or replace the Git remotes.

Do not connect or use GitLab.

Before implementing anything, run:

pwd

git status --short --branch

git branch --show-current

git remote -v

git log -1 --oneline

git fetch origin main

git fetch forge main

Verify that:

The working directory is correct.

The current branch is main.

Both Git remotes are available.

Existing work will not be overwritten.

There are no unrelated uncommitted changes.

Remote histories are compatible with safe, non-forced pushes.

If histories have diverged, stop and report the local and remote commit SHAs.

Never automatically merge unrelated histories.

Never use git reset --hard, git clean -fd, or git push --force.

Do not modify remote configuration.

5. TASK OBJECTIVE

Task FND-001 establishes the development foundation and makes OpenCode understand and follow the project's existing specifications.

We are NOT implementing application features in this task.

The objectives are:

Inspect and validate the existing agent/ documentation.

Create a persistent root-level AGENTS.md.

Create or safely update the root project README.md.

Establish a safe .gitignore.

Create a task tracking document.

Verify the project structure.

Check that the results follow the approved project rules.

Commit and push the verified changes.

Wait for independent review.

The Basic/Advanced decision gate does not apply to this documentation-only task. It will apply to later feature implementations as specified by the project's rules.

6. ALLOWED FILES

Only the following paths are permitted for creation or modification:

AGENTS.md

README.md

.gitignore

docs/tasks/FND-001.md

The existing agent/ folder must remain unchanged.

If agent/ is currently untracked in Git, it may be added to the initial commit only after confirming it contains the intended approved project documents and no secrets or unrelated files.

Do not create application code.

Do not create apps/, packages/, database schemas, API implementations, or UI components.

Do not install dependencies.

Do not create build configurations or select framework versions.

If necessary work falls outside the allowed paths, report a plan amendment and wait for approval.

7. IMPLEMENTATION A — CREATE AGENTS.md

Create this file in the repository root:

AGENTS.md

Use the following content.

REBZZ — AI Development Instructions

Project identity

Project: Business OS
Product: REBZZ
Architecture: Modular Monolith / Monorepo

The project is a modular business operating and growth platform.

Development must follow the approved architecture, domain boundaries, and specifications inside agent/.

Mandatory reading

Before implementing any task, read:

agent/AGENT.md

agent/00_PROJECT_CONTEXT.md

agent/decisions/DECISION_REGISTER.md

agent/rules/00_RULES_INDEX.md

The relevant domain PRD

The relevant workflow and engineering rules

The current development task

Follow the documentation precedence defined by the approved project rules.

Do not treat older reference material as more authoritative than current approved decisions.

Development rules

Implement one task at a time.

Do not expand the approved scope.

Before implementing a significant new capability, present Basic and Advanced levels when required by D-069 and obtain owner approval.

Use explicit acceptance criteria.

Follow the existing architecture.

Keep domain business logic out of route handlers, UI components, and unrelated modules.

Maintain separation between modules.

Protect tenant isolation and scoped authorization.

Avoid unnecessary dependencies and duplication.

Use established project conventions.

Write tests relevant to the implemented behavior.

Do not claim tests passed unless they actually ran and passed.

Do not implement unrelated improvements.

Do not silently rewrite architectural decisions.

Never commit credentials, API keys, tokens, or private environment values.

Report conflicts, uncertainty, and missing prerequisites.

Follow the task-driven development and independent review protocols.

Wait for independent review before starting another task.

Git workflow

Until the owner announces the first stable release:

Develop on main only.

Use origin for GitHub.

Use forge for the Forgejo review mirror.

Verify histories before pushing.

Never force-push.

Never overwrite unreviewed remote changes.

Push only after completing the approved task and passing applicable checks.

After pushing, wait for independent review.

This workflow can change only through an explicit owner decision.

Scope control

Every task must define:

Task ID

Purpose

Dependencies

Files to create

Files to modify

Expected behavior

Prohibited changes

Tests

Acceptance criteria

Completion report

If implementation requires additional scope, report it before proceeding.

Quality requirements

All application implementations must consider:

Correctness

Security

Error handling

Data validation

Maintainability

Performance appropriate to the task

Accessibility where relevant

Internationalization where relevant

Automated testing

Integration compatibility

Documentation

These requirements do not justify implementing features outside the approved task.

Completion report

After every task, report:

Task ID

Status

Summary

Files created

Files modified

Commands executed

Actual test results

Architecture verification

Security verification

Known issues

Git branch

Commit SHA

GitHub push result

Forgejo push result

Do not begin another task automatically.

8. IMPLEMENTATION B — README.md

Inspect the existing root README.md.

If it contains only an initial repository title or placeholder content, replace it with the following.

If it contains substantial project documentation, preserve it and stop to request approval for a specific update instead of overwriting it.

Business OS — REBZZ

Business OS (REBZZ) is a modular platform for establishing, operating, managing, and growing businesses.

Vision

Provide businesses with a unified operating environment that combines digital presence, business management, customer relationships, commerce, marketing, analytics, and future intelligent automation.

Architecture

The project follows a modular monolith architecture organized as a monorepo.

The shared platform foundation provides reusable systems for identity, organizations, businesses, customers, permissions, and module management.

Business capabilities are implemented as independent modules with clearly defined responsibilities and integration contracts.

Main capabilities

Planned modules include:

Website Builder

CRM

Commerce

Booking

Social Management

Customer Support

Marketing

Projects

Analytics

Integrations

AI Assistance

These capabilities will be implemented incrementally.

Development approach

The project is developed using small, independently reviewed tasks.

The product owner approves the scope and important decisions.

An AI development architect prepares implementation specifications and reviews results.

OpenCode implements approved tasks.

Each task must pass the required checks before the next task begins.

Documentation

All approved project specifications are located in agent/.

Development instructions are located in AGENTS.md.

Task records are located in docs/tasks/.

Current status

The project is in the foundation stage.

The presence of a planned capability does not mean it has been implemented.

9. IMPLEMENTATION C — .gitignore

Create or inspect:

.gitignore

If it already exists, preserve valid existing rules and add only missing necessary exclusions.

Include the following rules:

Environment and credentials

.env

.env.*

!.env.example

*.pem

*.key

*.p12

*.pfx

Dependencies and generated files

node_modules/

dist/

build/

coverage/

.next/

.turbo/

.cache/

*.tsbuildinfo

Logs and local editor files

*.log

.DS_Store

.idea/

.vscode/

Temporary local archives

agent_v2.zip

agent_v2(1).zip

Important:

A .gitignore file does not protect secrets that have already been committed.

Inspect staged changes before committing.

Do not ignore source code or legitimate project documentation.

10. IMPLEMENTATION D — TASK TRACKING

Create:

docs/tasks/FND-001.md

Write the following content.

FND-001 — Project Foundation

Status: In progress
Branch: main
Type: Repository governance
Capability level: Not applicable

Purpose

Establish the minimum documented development environment for Business OS and ensure that OpenCode follows the approved project architecture and task-driven workflow.

Preconditions

Existing Git repository

Existing agent/ documentation

GitHub remote named origin

Forgejo remote named forge

Current branch main

Deliverables

Root AGENTS.md

Root README.md

Root .gitignore

docs/tasks/FND-001.md

Verified existing agent/ directory

Verified Git configuration

Task completion evidence

Acceptance criteria

The existing agent/ documentation has been inspected.

Required authoritative documents are present.

Root AGENTS.md exists.

Root AGENTS.md references the existing documentation.

AGENTS.md includes task-driven development rules.

AGENTS.md includes the Basic/Advanced decision gate.

AGENTS.md includes independent review requirements.

README.md correctly describes the project.

.gitignore covers common secrets and generated artifacts.

No approved document under agent/ was modified.

No application code was created.

No unrelated files were modified.

Git changes were checked.

Both Git pushes were completed or their failures accurately reported.

Verification evidence

Record the executed verification commands and their actual results here.

Completion information

Record the final commit SHA and the status of each remote push.

Do not mark the task complete until the acceptance checks have passed.

11. VERIFICATION — MANDATORY

After implementation, perform the following checks.

Verification A — Documentation

Confirm that the expected documents inside agent/ exist.

Confirm that the documents can be read.

Verify that the original documentation was not modified.

Check that root AGENTS.md refers to the correct filenames and paths.

Do not create missing documents without authorization.

Verification B — File structure

The initial structure should resemble:

business-os/
├── agent/
│   ├── AGENT.md
│   ├── 00_PROJECT_CONTEXT.md
│   ├── decisions/
│   ├── rules/
│   ├── workflow/
│   ├── roadmap/
│   └── ...
├── AGENTS.md
├── README.md
├── .gitignore
└── docs/
    └── tasks/
        └── FND-001.md

Do not create directories for future modules during this task.

Verification C — Git changes

Run:

git status --short

git diff --check

git diff --cached --check

git diff --name-only

git ls-files --others --exclude-standard

Confirm all changed or new files are authorized.

If agent/ was already committed, check that its tracked contents are unchanged.

If agent/ was untracked, verify its contents before including it in the first commit.

Stage only the authorized files and repeat the staged-file review.

Run:

git diff --cached --name-only

git diff --cached --check

Do not stage or commit unrelated files.

Verification D — Security

Verify:

No credentials are committed.

No API tokens are committed.

No .env secrets are committed.

No unnecessary generated files are committed.

No unauthorized files are staged.

No destructive Git commands were used.

Report any security concern immediately.

Verification E — Tests

This task does not introduce application functionality.

Therefore:

Documentation verification: REQUIRED

Git verification: REQUIRED

Security verification: REQUIRED

Application unit tests: NOT APPLICABLE

Database tests: NOT APPLICABLE

API integration tests: NOT APPLICABLE

Do not claim that application tests passed.

12. COMMIT AND PUSH

Only proceed after verification succeeds.

Use the commit message:

docs: establish Business OS foundation (FND-001)

Commit on main.

Before pushing, fetch both remotes again and check that each remote main is an ancestor of the local commit.

If either remote has diverged, stop and report the issue.

Never force-push.

If both remotes can safely advance, push using:

git push origin main

git push forge main

Do not use forgejo as the remote name.

Do not push to GitLab.

If the first push succeeds and the second fails, report the partial synchronization. Do not force a recovery.

Once finished, provide the complete commit SHA.

Forgejo project URL:

https://forgejo.ekaii.fr/rezaghoreyshi/bs-os

13. FINAL REPORT FORMAT

Respond in this exact structure:

TASK_ID: FND-001

STATUS: COMPLETED / BLOCKED / FAILED

PROJECT: Business OS (REBZZ)

SUMMARY:
What was implemented and why.

DOCUMENTATION_VERIFICATION:
Documents inspected, missing documents, and verification results.

FILES_CREATED:
All newly created files.

FILES_MODIFIED:
All modified files.

ARCHITECTURE_REVIEW:
How the changes follow the existing project specifications.

SECURITY_REVIEW:
Security checks performed and any findings.

TESTS_EXECUTED:
Actual commands and their results.

ACCEPTANCE_CRITERIA:
PASS / FAIL for each criterion.

KNOWN_PROBLEMS:
Any unresolved issue.

PLAN_AMENDMENTS:
Any additional work required but not authorized.

GIT_BRANCH:
main

COMMIT_SHA:
Full SHA.

GITHUB_PUSH:
SUCCESS / FAILED / NOT ATTEMPTED

FORGE_PUSH:
SUCCESS / FAILED / NOT ATTEMPTED

FORGE_COMMIT_URL:
Full Forgejo commit URL.

NEXT_TASK:
NOT STARTED — WAITING FOR INDEPENDENT REVIEW

14. ABSOLUTE RESTRICTIONS

Do not:

Start FND-002.

Install development frameworks.

Create application code.

Create database models.

Create API endpoints.

Create frontend pages.

Modify existing project decisions.

Rename agent/.

Create agent_v2/.

Use GitLab.

Create a new Git branch.

Force-push.

Overwrite existing work.

Invent execution results.

Treat your own completion report as independent approval.

If blocked, explain exactly why and stop.

SUCCESS CONDITION:

FND-001 is successful only when the project documentation has been verified, the agent instructions and task record are in place, all relevant checks have passed, and the changes have been safely committed and pushed to GitHub and Forgejo.

After completion, stop and wait for the independent reviewer.

EXECUTE ONLY FND-001.
                   Domain Modules
                         |
             PostgreSQL / Queue / Storage
```

## Deployment Modes

```text
Same Codebase / Same Domain
├── Shared SaaS
├── Dedicated Managed
└── Standalone
```

Dedicated/Standalone نباید product fork شوند.

## Security Boundary

```text
Authentication
 -> Request Security Context
 -> Scoped Permission
 -> Entitlement/Config/Flag
 -> Application Policy
 -> Scoped Repository
 -> RLS
 -> Data
```

## Event Reliability

```text
Domain Transaction
  -> DB state + Outbox
  -> Worker publishes
  -> Consumer Inbox/idempotency
  -> Consumer domain action
```

## Integration

```text
Business Module
 -> Provider Interface
 -> Adapter
 -> External Provider
```
