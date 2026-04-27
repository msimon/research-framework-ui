---
name: enter-worktree
description: "Enter an isolated git worktree for the current session. Manual-only: never auto-trigger this skill. Only invoke when the user explicitly runs /enterWorktree."
user-invocable: true
---

# Enter Worktree

Create an isolated git worktree branched from HEAD and switch the entire session into it.

## Arguments

The user may provide an optional name: `/enterWorktree my-feature`

- If a name is provided, use it as the worktree name.
- If no name is provided, auto-generate one by running this command:
  ```bash
  BRANCH=$(git rev-parse --abbrev-ref HEAD); ADJS=(calm bold swift keen warm cool bright sharp quick steady); NOUNS=(oak fox elm ray dew pine ash wolf creek stone); echo "${BRANCH}-${ADJS[$((RANDOM % 10))]}-${NOUNS[$((RANDOM % 10))]}"
  ```
  Use the output as the worktree name (e.g., `mvp-keen-wolf`, `main-cool-pine`).

## Steps

1. **Check if already in a worktree session.** Run `[ "$(git rev-parse --git-dir)" != "$(git rev-parse --git-common-dir)" ]` to detect if the current directory is a git worktree. If the values differ (i.e. already in a worktree), warn the user: "You're already in a worktree. Run `/leaveWorktree` first." and stop.

2. **Record the current branch and SHA before entering.** Run:
   - `git rev-parse --abbrev-ref HEAD` to get the branch name (e.g., `mvp`)
   - `git rev-parse HEAD` to get the full SHA

   Save both — you'll need them in step 4.

3. **Call `EnterWorktree`** with the name (parsed from args or auto-generated).

4. **Rebase the worktree onto the correct commit.** `EnterWorktree` branches from the default branch (e.g., master), not the current branch. Fix this by running:
   ```
   git reset --hard <SHA-from-step-2>
   ```
   This brings the worktree to the exact state of the branch you were on.

5. **Orient the user.** After entering, run:
   - `git log --oneline -5` to show recent commits
   - `git status` to show current state

6. **Print a summary:**
   ```
   Worktree ready: <worktree-name>
   Branch: <branch-name>
   Based on: <original-branch> @ <short-sha>

   Use /leave-worktree when done.
   ```
