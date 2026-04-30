# Citation [N] hover tooltip — show URL

## Problem

When the user hovers over a `[1]` bracket in landscape or deep-research markdown, nothing happens. They have to click and scroll to figure out which source it points to. For quick "is this CMS or some random blog?" judgments, the user wants the URL right there in an overlay.

## Fix

Render each `[N]` anchor inside a small tooltip that shows the source URL on hover. The cited URL is already available — the citation map is persisted per-entity (`citation_map` JSONB on `landscapes` / `deep_research_turns`) and the bracket position in the markdown is the 1-indexed position in the deduped sources list.

Two approaches:

### A. Server-side (simpler)

In `buildCitationOutput` (`src/server/lib/utils/build-citation-output.util.ts`), include `title="<url>"` on the anchor element. Browser default tooltip kicks in on hover. Free, no JS.

```ts
anchors.push(
  `<a href="#${anchorPrefix}source-${pos}" title="${escapeHtml(c.url)}" class="...">[${pos}]</a>`,
);
```

Cons: no styling control, ~1s delay before browser tooltip appears, doesn't show favicon.

### B. Client-side (richer)

Replace the raw `<sup><a>...` with a custom rehype handler in `src/ui/components/markdown.tsx`. The handler matches `a[href^="#source-"]` (or `#turn-N-source-`) anchors, looks up the source by `citation_map[N-1]`, and renders a shadcn `Tooltip` with the URL + title + favicon.

To do this the markdown component needs the `citation_map` and (for deep-research) the turn-scope prefix. Either pass them as props from each consumer, or wire a `CitationProvider` context (one per landscape, one per turn) and have the rehype/component step pull from `useContext`.

## Recommendation

Start with **A** for a one-line ship. Upgrade to **B** when the favicon/title overlay is worth the wiring.

## Out of scope here

- Highlight-on-click (separate TODO: `citation-click-highlight-source.md`)
- Trust score / weight (separate TODO: `source-trust-score-and-weight.md`)
