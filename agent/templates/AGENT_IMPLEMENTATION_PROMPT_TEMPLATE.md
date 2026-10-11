# Coding Agent Implementation Prompt — <TASK-ID>

You are implementing exactly one approved task in an existing production-oriented codebase.

## Mandatory context to read first
- `AGENT.md`
- `00_PROJECT_CONTEXT.md`
- relevant PRD
- relevant rules
- this Task Packet

## Task
<copy exact goal>

## Selected capability level
Basic | Advanced

## Scope
### You MUST implement
- ...

### You MUST NOT implement
- ...

## Allowed files/folders
- ...

Do not modify files outside this list unless the task is impossible without it. If another file is required, STOP implementation of that extra change and report a Plan Amendment with reason and impact.

## Required architecture rules
- Keep business logic out of HTTP routes/controllers and UI components.
- Do not access another module's database directly.
- Enforce authorization server-side.
- Preserve tenant/business/branch scoping.
- Do not hardcode customer/provider-specific behavior.
- No secrets or PII in code/logs.
- Use bounded/paginated queries.
- Heavy or retryable external work must follow async/idempotency rules when applicable.

## Exact implementation steps
1. ...
2. ...
3. ...

## File-by-file expected changes
### `path/to/file`
- ...

## Tests you MUST add/update
- ...

## Commands you MUST run
```bash
...
```

## Output format
Return exactly:

1. `SUMMARY`
2. `FILES_CHANGED` with one-line reason per file
3. `IMPLEMENTATION_NOTES`
4. `MIGRATIONS`
5. `SECURITY_REVIEW`
6. `PERFORMANCE_REVIEW`
7. `TESTS_ADDED`
8. `COMMANDS_RUN`
9. `TEST_RESULTS` with pass/fail evidence
10. `KNOWN_LIMITATIONS`
11. `PLAN_AMENDMENTS` or `NONE`
12. `DIFF/COMMIT/PR REFERENCE` when available

Do not claim success if a required command was not actually executed. Clearly mark unavailable commands or environment limitations.
