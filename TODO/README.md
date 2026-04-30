# TODO

Deferred work — items scoped out of the current focus, kept here so they don't get lost.

| Item | Summary |
| --- | --- |
| [Precise per-source citation linking](precise-source-citations.md) | Replace the current `#sources`-anchor citations with per-URL `[N]` brackets using Anthropic's native citation metadata. |
| [Enable adaptive thinking with `display: omitted`](enable-adaptive-thinking-omitted.md) | Set `thinking: { type: 'adaptive', display: 'omitted' }` on the Anthropic provider options so model preamble narration ("I'll research…") shifts into the suppressed thinking channel and the first user-visible text-delta is real content. Lets us drop the `# Findings` marker hack. |
| [Citation `[N]` hover URL tooltip](citation-hover-url-tooltip.md) | On hover over a `[N]` bracket, show the source URL in an overlay so the user can judge source type without scrolling. |
| [Citation `[N]` click flash-highlights source](citation-click-highlight-source.md) | When the user clicks `[N]`, scroll to the source AND briefly fade-in/fade-out a primary-tinted background on the target row (~3s) so it's easy to spot in long lists. |
| [Source trust score & weight](source-trust-score-and-weight.md) | Per-source authority signal (gov / regulator / press / company-primary / etc.) computed via a small Haiku classification call and cached. Surface as colored bracket / trust badge in the source list. |
