# BUGS

Known defects — broken behavior we've decided not to fix immediately, kept here so they don't get lost.

## Index

| ID | Bug | Symptom | In progress | Depends on |
| --- | --- | --- | --- | --- |
| 1 | [Create-subject failures are silent; UI stuck on "Creating…" / interview never starts](create-subject-silent-failure.md) | A throw in `createSubjectAction` doesn't surface to the form (no error shown, button resets), and a background failure in `triggerFirstInterviewStep` orphans the subject in `interviewing` status with no first turn. | [ ] | — |
| 2 | ["More topics arriving…" loading indicator is static and uninformative](topics-loading-indicator-static.md) | The "Find more" loading state is a one-liner with literal-text `…` (no animation, no elapsed counter, no expected duration, no hint echo) — vs. the rich `DiscoverThinking` block shown for the initial discover. | [ ] | — |

## Adding a bug

1. Pick the next free ID — one greater than the highest in the index. IDs are never reused; when a bug is fixed and its row is removed, its number stays retired so older commit / PR references remain unambiguous.
2. Create `BUGS/<short-kebab-slug>.md` with the spec — symptom, reproduction, suspected cause, recommended fix, what's out of scope.
3. Append a row to the index: `| <id> | [Title](slug.md) | <one-line symptom> | [ ] | <comma-separated dep IDs, or —> |`.
4. List a dependency only when the bug genuinely cannot be fixed until that other bug or TODO is done. Soft "would compose with" relationships belong in the spec body, not the index.

## Starting a bug fix

1. Verify every ID in "Depends on" is already removed from the index — i.e. the dep is fixed and deleted. If a dep is still present, fix or unblock it first.
2. Tick the "In progress" checkbox: `[ ] → [x]`. This is the lock — it signals to humans and other agents that someone owns this work right now. Commit the README change before starting the implementation so the lock is visible.
3. Read the spec file end-to-end before editing code. Reproduce the bug locally first.
4. When the fix ships: delete the spec file AND remove the row from this index in the same commit. Do not leave a `[x]` row lying around.
