import type { LexiconEntry } from '@/prompts/landscape/landscape.schema';

// Dedupe by `label` (case-insensitive, trimmed). Existing entries win — the
// first writer's definition is preserved across landscape and deep-research
// runs. Entries within `adds` that collide with each other are also deduped.
// Returns the same `current` reference when nothing new was added so callers
// can skip the DB write.
export function mergeLexicon(current: LexiconEntry[], adds: LexiconEntry[]): LexiconEntry[] {
  const seen = new Set(current.map((e) => e.label.trim().toLowerCase()));
  const fresh: LexiconEntry[] = [];
  for (const e of adds) {
    const key = e.label.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(e);
  }
  if (fresh.length === 0) return current;
  return [...current, ...fresh];
}
