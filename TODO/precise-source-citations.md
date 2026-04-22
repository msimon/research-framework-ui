# Precise per-source citation linking

## Goal

Replace the current `src` superscript (which links to the `#sources` anchor) with inline numbered brackets `[1][23][2]` where each bracket links to the exact cited URL in the sources list.

## Current state

Claude's web_search output embeds `<cite index="X-Y">...</cite>` tags inline in the findings. We currently render these as highlighted text with a single trailing `src` superscript that links to `#sources`. The `index` attribute is model-invented and not a reliable key into our source list.

## Why approach B (not A)

Considered two approaches:

- **A — order-based heuristic:** Number cite tags by order of first distinct `index` value and assume the ordering lines up with `result.sources`. Cheap, but occasionally misattributes — `[2]` may link to the wrong URL because Claude doesn't strictly cite sources in the order they were fetched.
- **B — real citation metadata:** Anthropic already attaches `web_search_result_location` citations to each text block, carrying `{url, title, cited_text, encrypted_index}`. Every bracket can link to the actual URL with no inference.

Picked B because the point of the feature is trust — a link that lies occasionally is worse than no link.

## Implementation sketch

1. **Capture citation metadata during streaming.** In the Vercel AI SDK, verify whether per-text-block citations arrive as `source` parts on `fullStream` or as `providerMetadata.anthropic.citations` on text parts. Start there — the rest depends on this surface.
2. **Persist per-turn citation map.** Add a JSONB column (e.g. `citation_map`) on `deep_research_turns`. Map each citation reference to a 1-indexed source position.
3. **Consume the map in `<Markdown>`.** Probably via React context to avoid prop drilling. For each `<cite>` tag, split the comma-separated `index` attribute and render one `[N]` anchor per reference, each linking to `#source-N`. Multi-source cites render as `[1][23][2]`, not collapsed.
4. **Add `id="source-N"` on each source list item** so anchor jumps land correctly.
5. **Apply the same pattern to landscape** once deep-research works — landscape also uses web_search.

## Scope exclusions

- Don't ship A as a stepping-stone. If we can't pull off B cleanly, keep the current `src` superscript rather than introduce a half-correct `[N]`.
