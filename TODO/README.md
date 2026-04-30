# TODO

Deferred work — items scoped out of the current focus, kept here so they don't get lost.

| Item | Summary |
| --- | --- |
| [Citation `[N]` hover URL tooltip](citation-hover-url-tooltip.md) | On hover over a `[N]` bracket, show the source URL in an overlay so the user can judge source type without scrolling. |
| [Citation `[N]` click flash-highlights source](citation-click-highlight-source.md) | When the user clicks `[N]`, scroll to the source AND briefly fade-in/fade-out a primary-tinted background on the target row (~3s) so it's easy to spot in long lists. |
| [Source trust score & weight](source-trust-score-and-weight.md) | Per-source authority signal (gov / regulator / press / company-primary / etc.) computed via a small Haiku classification call and cached. Surface as colored bracket / trust badge in the source list. |
| [BYO Anthropic key — settings + onboarding](byok-anthropic-key.md) | Per-user Anthropic API key (encrypted at rest, validated on save). Settings page + first-login modal gate that reuses the same form. Implements the `resolveModelClient(userId)` BYOK path called out in `CLAUDE.md`. |
| [Deep-research turn sources — collapsed accordion](deep-research-sources-accordion.md) | Each turn's Sources section closed by default (`<details>`); opens when the user clicks the arrow or a `[N]` bracket in that turn's findings. Composes with the click-flash-highlight TODO. |
| [Inline lexicon term highlight + hover definition](lexicon-inline-term-highlight.md) | Annotate lexicon terms (abbreviations / terms / entities from `subject.lexicon_md`) inline in landscape and deep-research markdown — dotted underline + hover tooltip with the one-line definition and expansion. Client-side via a rehype plugin so updates reflect immediately. |
| [Lexicon — flatten to three subject-wide sections](lexicon-flatten-three-sections.md) | After several runs the lexicon stacks duplicate per-topic / per-turn blocks with mixed table+bullet formats. Replace `appendLexicon` + `mergeDeepLexicon` with a single canonical Abbreviations / Terms / Entities renderer. Recommend storing as `subjects.lexicon` jsonb so the inline-highlight TODO can read structured entries directly. |
