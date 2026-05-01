---
name: commit
description: Create a git commit from staged and unstaged changes with project commit style conventions.
user-invocable: true
---

# Commit

Create a commit for the current changes.

## Steps

1. Run `git status` and `git diff HEAD` to understand what changed.
2. Run the `/lint-code-change` skill on the current changes.
3. If the lint finds issues, present them and ask the user: **fix the issues first, or commit anyway?**
   - If the user chooses to fix → apply fixes, then loop back to step 1.
   - If the user chooses to commit anyway → continue to step 4.
   - If the lint finds no issues → continue to step 4.
4. Stage all relevant changes (prefer adding specific files over `git add -A`).
5. Write a commit message following the style rules below.
6. Commit and confirm the result.

## Commit Message Style

- **Prefer one line.** Fit everything on a single line when possible.
- **Up to 3 lines** if the change has many moving parts — use a blank line between the subject and extra lines.
- **Max ~70 characters per line.** Be concise. No trailers, no `Co-Authored-By`.
- **Sentence case**, no period at the end.
- **Focus on the "what"**, not the "how". The diff has the details.

## Format

```
[optional task ID][TYPE] Description
```

### Type prefixes (required)

| Prefix | When |
|--------|------|
| `[FEAT]` | New feature or functionality |
| `[FIX]` | Bug fix |
| `[REFACTOR]` | Restructuring, no behavior change |
| `[CHORE]` | Config, deps, tooling, CI, formatting, linting |
| `[DOCS]` | Documentation only |
| `[WIP]` | Incomplete work |

### Task ID

When a task ID is known, prepend it before the type: `[#XX-42][FIX]`. Task IDs follow the format `#XX-123`.

## Examples

```
[FEAT] Login form with email and password fields
[#XX-42][FEAT] Task creation modal
[FIX] Redirect loop on auth callback
[#XX-15][FIX] Missing null check on user profile
[REFACTOR] RLS rules into dedicated skill
[CHORE] Shadcn MCP config
[DOCS] Project-specific README
[WIP] Task list drag and drop
```
