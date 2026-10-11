# REBZZ — AI Development Instructions

## Project identity

- Project: Business OS
- Product: REBZZ
- Architecture: Modular Monolith / Monorepo

The project is a modular business operating and growth platform.

Development must follow the approved architecture, domain boundaries, and specifications inside `agent/`.

## Mandatory reading

Before implementing any task, read:

- `agent/AGENT.md`
- `agent/00_PROJECT_CONTEXT.md`
- `agent/decisions/DECISION_REGISTER.md`
- `agent/rules/00_RULES_INDEX.md`
- The relevant domain PRD
- The relevant workflow and engineering rules
- The current development task

Follow the documentation precedence defined by the approved project rules.

Do not treat older reference material as more authoritative than current approved decisions.

## Development rules

- Implement one task at a time.
- Do not expand the approved scope.
- Before implementing a significant new capability, present Basic and Advanced levels when required by D-069 and obtain owner approval.
- Use explicit acceptance criteria.
- Follow the existing architecture.
- Keep domain business logic out of route handlers, UI components, and unrelated modules.
- Maintain separation between modules.
- Protect tenant isolation and scoped authorization.
- Avoid unnecessary dependencies and duplication.
- Use established project conventions.
- Write tests relevant to the implemented behavior.
- Do not claim tests passed unless they actually ran and passed.
- Do not implement unrelated improvements.
- Do not silently rewrite architectural decisions.
- Never commit credentials, API keys, tokens, or private environment values.
- Report conflicts, uncertainty, and missing prerequisites.
- Follow the task-driven development and independent review protocols.
- Wait for independent review before starting another task.

## Git workflow

Until the owner announces the first stable release:

- Develop on `main` only.
- Use `origin` for GitHub.
- Use `forge` for the Forgejo review mirror.
- Verify histories before pushing.
- Never force-push.
- Never overwrite unreviewed remote changes.
- Push only after completing the approved task and passing applicable checks.
- After pushing, wait for independent review.

This workflow can change only through an explicit owner decision.

## Scope control

Every task must define:

- Task ID
- Purpose
- Dependencies
- Files to create
- Files to modify
- Expected behavior
- Prohibited changes
- Tests
- Acceptance criteria
- Completion report

If implementation requires additional scope, report it before proceeding.

## Quality requirements

All application implementations must consider:

- Correctness
- Security
- Error handling
- Data validation
- Maintainability
- Performance appropriate to the task
- Accessibility where relevant
- Internationalization where relevant
- Automated testing
- Integration compatibility
- Documentation

These requirements do not justify implementing features outside the approved task.

## Completion report

After every task, report:

- Task ID
- Status
- Summary
- Files created
- Files modified
- Commands executed
- Actual test results
- Architecture verification
- Security verification
- Known issues
- Git branch
- Commit SHA
- GitHub push result
- Forgejo push result

Do not begin another task automatically.