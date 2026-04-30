# Lexicon — flatten to three subject-wide sections

## Bug

After 3+ landscape / deep-research runs on a subject, `subject.lexicon_md` looks like:

```
Community Rheum Practice P&L
  Abbreviations
    | RA | Rheumatoid Arthritis | ... |
    ...
  Terms & concepts
    | Buy-and-bill | ... |
    ...
  Entities
    | ACR | ... |
    ...

Community Rheum Practice P&L          ← repeated
  Abbreviations
    | MPFS | ... |
  Terms & concepts
    | Net cost recovery | ... |
  Entities
    | Healix | ... |

Community Rheum Practice P&L — deep research   ← turn 1
  - **NCR** — ...
  - **Underwater** — ...

Community Rheum Practice P&L — deep research   ← turn 2 (no heading suffix change)
  - ePA — ...
  ...
```

Two compounding issues:

1. **Per-run topic headings stack.** Both `appendLexicon` (`src/server/domain/landscapes/landscapes.command.ts:317`) and `mergeDeepLexicon` (`src/server/domain/deep-research/deep-research.command.ts:529`) tag each merge with the topic title, and on subsequent runs they either append a *new* duplicate block (landscape) or insert under the same heading without consolidating across topics (deep-research).
2. **Format drift between sources.** Landscape emits tables under `### Abbreviations / ### Terms & concepts / ### Entities`. Deep-research emits flat bullets with no sub-section. The two never reconcile, so terms added by deep-research end up uncategorized.

## Fix — what the lexicon should look like

A single subject-scoped lexicon with **exactly three top-level sections**, regardless of which topic / landscape / turn contributed each entry:

```markdown
## Abbreviations

| Abbrev | Expansion | One-line meaning |
|---|---|---|
| RA | Rheumatoid Arthritis | ... |
| MPFS | Medicare Physician Fee Schedule | ... |
| ePA | Electronic Prior Authorization | ... |
...

## Terms & concepts

| Term | One-line meaning |
|---|---|
| Buy-and-bill | ... |
| Net cost recovery | ... |
| ...

## Entities (companies, institutions, tools, policies)

| Name | What it is / what it does |
|---|---|
| ACR (American College of Rheumatology) | ... |
| Healix | ... |
| ...
```

No topic headings. No per-turn / per-landscape sub-sections. No "deep research" suffix. Entries are deduplicated across all sources by `label` (case-insensitive).

## Implementation choice — markdown vs structured storage

Three options, ordered by upgrade effort:

### A. Keep `subjects.lexicon_md`, rewrite the merger

Replace `appendLexicon` and `mergeDeepLexicon` with a single `mergeLexicon(currentMd, newEntries)` that:
1. Parses `currentMd` back into `LexiconEntry[]` (table rows under each section).
2. Merges by `label` (existing entry wins on conflict — first writer keeps definition; new entries added).
3. Re-renders the canonical three-section markdown from the merged set.

Pros: minimal surface change, lexicon UI continues to render directly from the markdown.
Cons: round-trip parse/render every merge; markdown is lossy if a future field is added.

### B. Add `subjects.lexicon` jsonb (alongside `lexicon_md`)

Persist `LexiconEntry[]` directly. Generate `lexicon_md` from it on every write so the rendering layer doesn't change. The lexicon-inline-highlight TODO (`lexicon-inline-term-highlight.md`) already wants structured access to the lexicon for client-side rehype matching — this is the right shape for both consumers.

Pros: no markdown parsing, structured access enables the inline-highlight TODO without re-parsing per render. Single source of truth.
Cons: small migration; need to keep `lexicon_md` in sync (or drop it once the highlight TODO ships and the prompt context can take JSON).

### C. Dedicated `public.subject_lexicon_entries` table

One row per entry: `(subject_id, label, expansion, kind, definition, first_seen_in, created_at)`.

Pros: queryable (e.g. "show all abbreviations across subjects"), per-row updated_at, easier deduplication.
Cons: more migration work, and the lexicon is currently always read as a single block (passed wholesale into prompts and rendered as one section in the UI), so the row-level granularity isn't paying for itself yet.

**Recommend B.** It's the right shape for both this fix and the lexicon-highlight TODO, with one migration. Single source of truth — markdown is rendered on the fly wherever needed.

## DB migration

Clean break — no preservation of existing lexicon data.

```sql
ALTER TABLE public.subjects
  DROP COLUMN lexicon_md,
  ADD COLUMN lexicon jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Each entry: `{ kind: 'abbreviation' | 'term' | 'entity' | null, label: string, expansion?: string, definition: string }` — matches `LexiconEntry` from `src/prompts/landscape/landscape.schema.ts`.

Existing lexicons are discarded. They'll refill on the next landscape / deep-research run; the existing data is the broken shape we're replacing anyway.

## Server wiring

- New `mergeLexicon(currentEntries: LexiconEntry[], adds: LexiconEntry[]): LexiconEntry[]` in `src/server/lib/utils/merge-lexicon.util.ts`. Pure function — dedupe by `label.toLowerCase()`, existing wins.
- New `renderLexiconMd(entries: LexiconEntry[]): string` in `src/server/lib/utils/render-lexicon-md.util.ts` (or co-located). Emits the canonical three-section markdown — used by prompt builders to construct the lexicon block in the LLM context.
- `landscapes.command.ts:completeLandscape` and `deep-research.command.ts:completeTurn` both:
  1. Read `subject.lexicon` (JSON).
  2. Call `mergeLexicon` with the run's `lexicon_adds`.
  3. Persist `subjects.lexicon = merged`.
- Drop `appendLexicon` and `mergeDeepLexicon` entirely.
- Drop every reference to `subject.lexicon_md` — `buildLandscapeMessages`, `buildDeepResearchMessages`, the UI, anywhere it appears. Replace with `renderLexiconMd(subject.lexicon)` at the call site. Update the supabase types after the migration.

## Prompt update

- `landscape.prompt.ts` and `deep-research.prompt.ts` describe a "Subject lexicon: ..." block — keep that, just feed it `renderLexiconMd(subject.lexicon)`.
- Make sure the prompt no longer invites topic-scoped lexicons or per-turn sub-sections. Current prompts probably don't — the topic suffix was added by the merger, not requested from the model. Verify and adjust if needed.

## UI update

- The collapsed `<details>` lexicon block in `session-chat.component.tsx` (and the equivalent in landscape) currently consumes `lexicon_md`. Switch to consuming `subject.lexicon` directly (an array of entries), rendering the three sections inline. This also unblocks the inline-highlight TODO without an extra parse step.

## Out of scope here

- Lexicon editing UI (just the data model + merger fix)
- Cross-subject lexicons (still per-subject)
- The inline-term highlight tooltip (separate TODO: `lexicon-inline-term-highlight.md` — this fix is a hard prerequisite for that one to look good)
