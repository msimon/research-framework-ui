# TODO

Deferred work — items scoped out of the current focus, kept here so they don't get lost.

## Index

| ID | Item | Summary | In progress | Depends on |
| --- | --- | --- | --- | --- |
| 2 | [Citation `[N]` hover URL tooltip](citation-hover-url-tooltip.md) | On hover over a `[N]` bracket, show the source URL in an overlay so the user can judge source type without scrolling. | [ ] | — |
| 3 | [Citation `[N]` click flash-highlights source](citation-click-highlight-source.md) | When the user clicks `[N]`, scroll to the source AND briefly fade-in/fade-out a primary-tinted background on the target row (~3s) so it's easy to spot in long lists. | [ ] | — |
| 5 | [BYO Anthropic key — settings + onboarding](byok-anthropic-key.md) | Per-user Anthropic API key (encrypted at rest, validated on save). Settings page + first-login modal gate that reuses the same form. Implements the `resolveModelClient(userId)` BYOK path called out in `CLAUDE.md`. | [ ] | — |
| 6 | [Deep-research turn sources — collapsed accordion](deep-research-sources-accordion.md) | Each turn's Sources section closed by default (`<details>`); opens when the user clicks the arrow or a `[N]` bracket in that turn's findings. Composes with the click-flash-highlight TODO. | [ ] | 3 |
| 7 | [Inline lexicon term highlight + hover definition](lexicon-inline-term-highlight.md) | Annotate lexicon terms (abbreviations / terms / entities from `subject.lexicon`) inline in landscape and deep-research markdown — dotted underline + hover tooltip with the one-line definition and expansion. Client-side via a rehype plugin so updates reflect immediately. | [ ] | — |

## Adding a TODO

1. Pick the next free ID — one greater than the highest in the index. IDs are never reused; when a TODO completes and its row is removed, its number stays retired so older commit / PR references remain unambiguous.
2. Create `TODO/<short-kebab-slug>.md` with the spec — problem, recommended fix, what's out of scope. Keep it tight enough to skim.
3. Append a row to the index: `| <id> | [Title](slug.md) | <one-line summary> | [ ] | <comma-separated dep IDs, or —> |`.
4. List a dependency only when the new TODO genuinely cannot ship until that other one is done. Soft "would compose nicely with" relationships belong in the spec body, not the index.

## Starting a TODO

1. Verify every ID in "Depends on" is already removed from the index — i.e. completed and deleted. If a dep is still present, finish or unblock it first.
2. Tick the "In progress" checkbox: `[ ] → [x]`. This is the lock — it signals to humans and other agents that someone owns this work right now. Commit the README change before starting the implementation so the lock is visible.
3. Read the spec file end-to-end before editing code.
4. When the work ships: delete the spec file AND remove the row from this index in the same commit. Do not leave a `[x]` row lying around.
