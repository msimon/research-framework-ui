---
name: review-code-change
description: Project conventions checklist for reviewing local code changes (staged + unstaged diffs). Use when reviewing written code, checking conventions, or validating changes before committing.
user-invocable: true
---

# Lint Conventions

Review the current local diff (`git diff` and `git diff --cached`) against the rules in `DEVELOPMENT.md` → `## Review Checklist`.

**Source of truth:** `DEVELOPMENT.md` at the repo root. Read that section first, then apply each bullet to the diff. If a rule there conflicts with anything you remember, `DEVELOPMENT.md` wins.

## Report format

For each finding, report:

- **File and line** — e.g. `src/server/domain/tasks/tasks.command.ts:42`
- **Rule violated** — which checklist item (quote the bullet verbatim)
- **Severity** — error (must fix) | warning (should fix) | nit (optional)
- **Suggestion** — how to fix it

Group findings by file. If no issues are found, say so explicitly.

End with a short summary: number of errors, warnings, and nits.
