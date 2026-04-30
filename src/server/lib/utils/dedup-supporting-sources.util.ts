type SourceRef = { url: string; title: string | null };

// Drop supporting URLs that are also in the cited list (cited takes
// precedence; the UI lists them under cited, no duplicate in supporting).
// Also dedupes supporting against itself in first-seen order.
export function dedupSupportingAgainstCited(
  supporting: ReadonlyArray<SourceRef>,
  cited: ReadonlyArray<SourceRef>,
): SourceRef[] {
  const seen = new Set(cited.map((s) => s.url));
  const out: SourceRef[] = [];
  for (const s of supporting) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push({ url: s.url, title: s.title });
  }
  return out;
}
