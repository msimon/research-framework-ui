# Source trust score & weight

## Problem

Right now every cited source is rendered identically — a CMS rule announcement and a press release from a single drug-maker show up the same in the list, and the user has to mentally weigh each one. We want a per-source signal indicating:

- **Trust score** — how authoritative the source is (gov agency vs. trade press vs. company blog vs. random LinkedIn post).
- **Weight** — how much the model's claims rely on this source for the cited span (a primary-evidence link vs. a "see also" reference).

This is harder than the other citation TODOs — it's not a UI tweak, it requires classification logic.

## Approach

### Step 1 — classify the source domain

Use a second small LLM call (Haiku is fine — fast + cheap) per unique URL to produce:

```ts
type SourceTrust = {
  url: string;
  category: 'gov' | 'regulator' | 'standards-body' | 'peer-reviewed' | 'major-press' | 'trade-press' | 'company-primary' | 'company-marketing' | 'industry-blog' | 'social' | 'unknown';
  trust_score: 0 | 1 | 2 | 3 | 4 | 5;  // 5 = authoritative primary, 0 = uncited rumor
  rationale: string;  // one-line explanation
};
```

Run this once per URL (results cached on the source domain in DB) — landscape/deep-research runs read from the cache when reusing a URL.

### Step 2 — surface in the UI

In the source list under each landscape / turn:
- Color the bracket number by trust tier (green = 4-5, neutral = 2-3, amber = 0-1).
- Inline a small trust badge next to the source title ("CMS · authoritative" / "Pfizer · primary, vendor-published" / etc.).
- Optionally collapse the lowest-trust sources by default ("3 lower-trust sources hidden — show").

### Step 3 — weight (harder, defer)

Weight is harder because it requires per-citation analysis (does this URL carry the *core* claim or is it a passing reference?). Two options:
1. Ask the original landscape/deep-research model to emit a 1-3 weight per citation in `emit_updates` / `emit_turn`. Cheap but increases the structured-payload schema.
2. Run a separate post-hoc classifier that reads the cited span + the URL's content and rates how directly the URL supports the span. Better fidelity, more cost.

Defer step 3 until step 1+2 ship and we can see whether trust score alone is enough.

## DB shape

New table `public.source_trust` (one row per unique URL — domain-level overrides handled in code):

```sql
CREATE TABLE public.source_trust (
  url text PRIMARY KEY,
  category text NOT NULL,
  trust_score smallint NOT NULL CHECK (trust_score BETWEEN 0 AND 5),
  rationale text NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT now(),
  classified_by_model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

No RLS needed — this is a global cache, same trust score applies to every user.

## Open questions

- Domain-level vs. URL-level: `cms.gov/123` and `cms.gov/456` should share a trust score. Cache by domain? But then individual articles can't override (e.g. a CMS press release gets the same score as the underlying rule). Probably hybrid: cache by domain, allow per-URL overrides when the model classifies a specific URL as deviating.
- TTL: should classifications expire? A domain's trust can shift over time. Probably re-classify any cached entry older than 90 days.
- Multi-tier badges or single score: 0-5 is granular but the UI only needs 3 buckets. Decide late, store granular.

## Out of scope here

- The hover/click UX (separate TODOs in this folder)
