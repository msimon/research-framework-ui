---
name: leave-worktree
description: "Leave the current worktree session and return to the original directory. Manual-only: never auto-trigger this skill. Only invoke when the user explicitly runs /leaveWorktree."
user-invocable: true
---

# Leave Worktree

Exit the current worktree session, with safety checks for uncommitted work.

## Steps

1. **Check if in a worktree session.** Run `[ "$(git rev-parse --git-dir)" != "$(git rev-parse --git-common-dir)" ]` to detect if the current directory is a git worktree. If the values are equal (i.e. not a worktree), tell the user "No worktree session is active." and stop. Do not proceed to the next steps.

2. **Check for uncommitted changes.** Run `git status --porcelain` in the worktree.

3. **If there are uncommitted changes**, warn the user and ask what they want to do:
   - **Keep** the worktree on disk (can return to it later or manually)
   - **Commit first** using `/commit`, then ask again
   - **Discard** everything and remove the worktree

4. **If clean (no uncommitted changes)**, check for commits not on the original branch by running `git log --oneline HEAD --not <original-branch>`. If there are worktree-only commits, inform the user and ask:
   - **Keep** the worktree (to merge/cherry-pick later)
   - **Remove** the worktree (those commits will be lost)

5. **Call `ExitWorktree`** with the chosen action:
   - `action: "keep"` — preserves worktree directory and branch
   - `action: "remove"` — deletes worktree and branch
   - `discard_changes: true` — only if user chose to discard uncommitted changes

6. **Confirm exit:** "Back in `<original-directory>` on branch `<original-branch>`."
