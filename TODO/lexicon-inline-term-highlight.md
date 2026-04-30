# Inline lexicon term highlight + hover definition

## Problem

The subject's lexicon (`subjects.lexicon`, a `LexiconEntry[]` jsonb populated by landscape and deep-research turns via `lexicon_adds`) is currently rendered only as a collapsed `<details>` block at the bottom of the page (via the `LexiconView` component). The user has to expand it and scroll-search to find a term they don't know. We want lexicon terms to be **highlighted inline wherever they appear** in landscape / deep-research markdown, with the definition surfaced on hover.

## What "matching" means

`LexiconEntry` (see `src/prompts/landscape/landscape.schema.ts`) has:
- `kind`: `'abbreviation' | 'term' | 'entity' | null`
- `label`: the abbreviation / term / entity name (e.g. "PA", "prior authorization", "EviCore")
- `expansion`: spelled-out form for abbreviations (e.g. "Prior Authorization")
- `definition`: one-line definition — **what it is / what it does**, factual

A match is a case-rule occurrence of `label` (or `expansion`) in a text node:
- **abbreviations**: case-sensitive whole-word match on `label` (e.g. "PA" matches "PA" but not "page", not "pa"). Also match `expansion` case-insensitively.
- **terms / entities**: case-insensitive whole-word match on `label`.

Word boundary detection: regex `\b` plus a guard against matching inside markdown code spans, `<a>`, `<cite>`, `<sup>` (already used for citation brackets), and `<pre>`.

## Where to do the matching

Two options:

### A. Client-side rehype plugin (preferred)

A unified rehype plugin in `src/ui/components/markdown.tsx` that walks the AST, takes the current lexicon as input, and wraps matched text nodes in a `<span data-lexicon-label="...">` element. The `Markdown` component grows props:

```tsx
<Markdown lexicon={lexiconEntries}>{contentMd}</Markdown>
```

The wrapping span is then styled and given a `<Tooltip>` via a custom `components.span` override that reads `data-lexicon-label` and matches it back to the entry from a context (`<LexiconProvider>`).

Pros: lexicon updates reflect on next render. No DB rewrite. Handles future lexicon growth without re-running landscape/turns.

Cons: client-side cost on every render — for a 1000-word landscape and 50-term lexicon, ~50k regex tests per render. Memoize aggressively; the result is stable per `(content_md, lexiconHash)`.

### B. Server-side baking

Same logic but run inside `buildCitationOutput` (or a sibling `buildLexiconOutput`) so the persisted `content_md` already has `<span data-lexicon-label="...">` baked in.

Pros: zero client cost.

Cons: stale — a lexicon entry added in turn 5 won't retroactively annotate landscape markdown written before turn 5. We'd have to re-bake on every lexicon update, which is hairy.

**Recommend A.** The client cost is acceptable; the freshness benefit is substantial.

## UX

- **Highlight style**: subtle dotted-underline (similar to the old `<cite>` styling). Avoid background tints — too noisy when many terms hit.
- **Tooltip** (shadcn `Tooltip`):
  - Top line: `**PA**` (label, bold).
  - Second line: `Prior authorization` (expansion, only if abbreviation).
  - Body: the `definition` ("Insurer-imposed pre-approval requirement before a treatment is covered.").
  - Optional footer: link `→ See full lexicon` that scrolls to the existing lexicon `<details>` and expands it.

## Edge cases

- **First mention vs. all mentions**: do we annotate every occurrence or only the first? Initial behavior: every occurrence. Reassess if it's visually noisy.
- **Overlapping matches**: "prior authorization (PA)" — the parenthetical PA shouldn't double-highlight if "prior authorization" already wraps the phrase. Process longest-label-first, skip overlap.
- **Abbreviations inside code spans**: don't annotate code, kbd, pre. The rehype walker should skip those node types.
- **Inside `<cite>` / `<sup>` / `<a>`**: the citation brackets and link anchors shouldn't get lexicon annotations layered on top. Skip.
- **Inside other annotations**: once a span is wrapped, don't recurse into it.

## Implementation sketch

```ts
// src/ui/components/lexicon-rehype.util.ts
export function rehypeLexicon(entries: LexiconEntry[]) {
  // Sort by label length desc — longer matches win
  const patterns = entries
    .flatMap((e) => [
      { entry: e, pattern: buildPattern(e.label, e.kind === 'abbreviation') },
      ...(e.expansion ? [{ entry: e, pattern: buildPattern(e.expansion, false) }] : []),
    ])
    .sort((a, b) => b.pattern.source.length - a.pattern.source.length);

  return () => (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || isInSkippedAncestor(parent)) return;
      // ...split text node, wrap matches in <span data-lexicon-label="...">
    });
  };
}
```

Then in `Markdown`:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeRaw, rehypeLexicon(lexiconEntries)]}
  components={{ span: LexiconSpan }}
>
  {children}
</ReactMarkdown>
```

The `LexiconSpan` component reads `data-lexicon-label`, looks up the entry from `useLexicon()`, renders the styled span + Tooltip.

## Where the lexicon comes from on the page

- Landscape page (`topic.view.tsx` → `Landscape` component): pass `subject.lexicon` (already a `LexiconEntry[]` jsonb). The lexicon is per-subject.
- Deep-research session page (`deep-research-session.view.tsx` → `SessionChat`): same — `subject.lexicon` is already passed down to `useDeepResearchSession` and surfaced as `lexicon` state, with realtime updates wired through `postgres_changes`.

## Out of scope here

- Lexicon editing UI (just rendering, not authoring)
- Cross-subject lexicon (lexicons are per-subject only)
- Synonyms / aliases (only the literal `label` and `expansion` get matched)
