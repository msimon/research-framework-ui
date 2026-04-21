---
name: review-code-change
description: Project conventions checklist for reviewing local code changes (staged + unstaged diffs). Use when reviewing written code, checking conventions, or validating changes before committing.
user-invocable: true
---

# Lint Conventions

Review the current local diff (`git diff` and `git diff --cached`) against these project rules.

## Checklist

- Files use correct suffixes (`.command.ts`, `.repository.ts`, `.action.ts`, `.service.ts`, `.schema.ts`, `.view.tsx`, etc.)
- Imports use `@/` alias — no relative paths or `src/` prefixes
- Commands don't call other commands
- Repositories don't call other repositories
- Infra/vendor code lives under `src/server/infra/*`, not under `src/server/domain/*`
- Server actions use `withAuth()` or `requireAuth()`
- No `SELECT *` in Supabase queries — select explicit fields
- `supabase.types.ts` is not manually edited
- New tables include `created_at` / `updated_at` fields with triggers
- Colors use OKLCH format
- UI components prefer Shadcn — no unnecessary custom components
- No secrets or hardcoded API keys
- `process.env` is only read inside `src/shared/config/*`

## Report format

For each finding, report:

- **File and line** — e.g. `src/server/domain/tasks/tasks.command.ts:42`
- **Rule violated** — which checklist item
- **Severity** — error (must fix) | warning (should fix) | nit (optional)
- **Suggestion** — how to fix it

Group findings by file. If no issues are found, say so explicitly.

End with a short summary: number of errors, warnings, and nits.
