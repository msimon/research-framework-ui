// The displayed source list during/after an agent run. Combines the
// persisted `public.sources` rows (which only land on completion) with the
// URLs being captured live in the citation stream — so [N] brackets can
// resolve as soon as the citation event fires, rather than waiting for the
// DB insert. After completion the live entries are replaced by their
// persisted counterparts (same URL → first-seen order is preserved).
export type EffectiveSource = { id: string; url: string; title: string | null };

export function buildEffectiveSources(
  dbSources: ReadonlyArray<{ id: string; url: string; title: string | null }>,
  citationUrls: ReadonlyArray<{ url: string }>,
): EffectiveSource[] {
  const result: EffectiveSource[] = [];
  const seen = new Set<string>();
  for (const s of dbSources) {
    if (seen.has(s.url)) continue;
    result.push({ id: s.id, url: s.url, title: s.title });
    seen.add(s.url);
  }
  for (const c of citationUrls) {
    if (seen.has(c.url)) continue;
    result.push({ id: `live:${c.url}`, url: c.url, title: null });
    seen.add(c.url);
  }
  return result;
}
