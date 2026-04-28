// Dedupe a streamed list of citations into a per-URL source list, preserving
// the first-seen title (and upgrading null → first non-null title).
export function dedupeCitations<T extends { url: string; title: string | null }>(
  entries: readonly T[],
): Array<{ url: string; title: string | null }> {
  const seen = new Map<string, { url: string; title: string | null }>();
  for (const entry of entries) {
    const existing = seen.get(entry.url);
    if (!existing) {
      seen.set(entry.url, { url: entry.url, title: entry.title });
    } else if (existing.title === null && entry.title !== null) {
      existing.title = entry.title;
    }
  }
  return [...seen.values()];
}
