---
name: review-workspace-change
description: Project conventions checklist for reviewing every workspace change since the branch diverged from main (commits since divergence + uncommitted + untracked). Use before pushing or opening a PR.
user-invocable: true
---

# Review workspace changes

The review must run in a fresh `code-reviewer` subagent, not inline. A fresh agent has no implementation bias from the same session and is more likely to catch architecture violations the author rationalized while writing the code.

## Step 1 — gather the changed files

Resolve the merge-base, then list every file that changed between it and the working tree:

- `MERGE_BASE=$(git merge-base origin/main HEAD)`
- In parallel:
  - `git diff --name-only "$MERGE_BASE"` — committed + uncommitted paths in one shot
  - `git ls-files --others --exclude-standard` — untracked paths

Deduplicate the two lists. If the combined list is empty, tell the user there's nothing to review and stop — do not spawn the subagent.

The diff base for this scope is the resolved merge-base SHA. Substitute the actual SHA into the subagent prompt below — never the literal text `MERGE_BASE` or `<merge-base>`.

## Step 2 — invoke the code-reviewer subagent

Single `Agent` tool call:

- `subagent_type: "code-reviewer"`
- `prompt`:

  ```
  Diff base: <merge-base SHA>

  Changed files:
  <one path per line>
  ```

Do not run the review yourself, even partially — the whole point is that the subagent comes in fresh.

## Step 3 — relay the report

Relay the subagent's report verbatim or with minimal trimming. Do not add findings of your own; if you spot something the subagent missed, mention it as an addendum after the relayed report so the user can see it came from you, not from the fresh-agent review.
