---
name: lint-code-change
description: Lints pre-commit changes (staged + unstaged + untracked) against the project's convention/architecture checklist. Use before committing. Not a logic-bug review.
user-invocable: true
---

# Lint pre-commit changes

The lint must run in a fresh `convention-linter` subagent, not inline. A fresh agent has no implementation bias from the same session and is more likely to catch architecture violations the author rationalized while writing the code.

## Step 1 — gather the changed files

Run in parallel from the repo root:

- `git diff --name-only HEAD` — staged + unstaged paths
- `git ls-files --others --exclude-standard` — untracked paths

Deduplicate the two lists. If the combined list is empty, tell the user there's nothing to review and stop — do not spawn the subagent.

The diff base for this scope is `HEAD`.

## Step 2 — invoke the convention-linter subagent

Single `Agent` tool call:

- `subagent_type: "convention-linter"`
- `prompt`:

  ```
  Diff base: HEAD

  Changed files:
  <one path per line>
  ```

Do not run the lint yourself, even partially — the whole point is that the subagent comes in fresh.

## Step 3 — relay the report

Relay the subagent's report verbatim or with minimal trimming. Do not add findings of your own; if you spot something the subagent missed, mention it as an addendum after the relayed report so the user can see it came from you, not from the fresh-agent lint.
