import type { CitationEntry } from '@/shared/citation.type';

// Per-block accumulator captured during streaming. The streaming layer
// tracks AI SDK text content blocks (text-start / text-end with the same id)
// and attaches `source` events that fire between those boundaries to the
// open block.
export type CitationBlock = {
  text: string;
  citations: CitationEntry[];
};

export type CitationOutput = {
  // The assembled markdown with `<sup>[N]</sup>` brackets baked in at the
  // end of each text block that had citations attached.
  markdown: string;
  // Deduplicated cited URLs in first-seen order — gets persisted to
  // `public.sources` and rendered as the entity's Sources section. Bracket
  // numbers above are 1-indexed positions in this list.
  sources: Array<{ url: string; title: string | null }>;
  // Full ordered citation list, including duplicates — persisted to the
  // entity's `citation_map` JSONB column for future use (hover-quote
  // tooltips, etc.). Not currently consumed by the UI.
  citationMap: CitationEntry[];
};

export function buildCitationOutput(
  blocks: ReadonlyArray<CitationBlock>,
  // Prefix prepended to the bracket anchors. Empty for single-document
  // contexts (landscape) → anchors are `#source-N`. For multi-block contexts
  // where multiple Sources sections coexist on one page (deep-research turns
  // in a session), pass `turn-${turn_number}-` so anchors are
  // `#turn-3-source-N` and stay unique across the document.
  anchorPrefix = '',
): CitationOutput {
  const citationMap: CitationEntry[] = [];
  const sources: Array<{ url: string; title: string | null }> = [];
  const sourcePosition = new Map<string, number>();

  for (const block of blocks) {
    for (const c of block.citations) {
      citationMap.push(c);
      if (!sourcePosition.has(c.url)) {
        sources.push({ url: c.url, title: c.title });
        sourcePosition.set(c.url, sources.length);
      }
    }
  }

  const markdown = blocks
    .map((block) => {
      if (block.citations.length === 0) return block.text;
      const seen = new Set<number>();
      const anchors: string[] = [];
      for (const c of block.citations) {
        const pos = sourcePosition.get(c.url);
        if (pos === undefined || seen.has(pos)) continue;
        seen.add(pos);
        anchors.push(
          `<a href="#${anchorPrefix}source-${pos}" class="ml-0.5 text-[10px] text-primary no-underline hover:underline">[${pos}]</a>`,
        );
      }
      // Wrap the whole cited block in <cite> so the Cite component can style
      // it as a highlighted span. The model no longer emits its own cite tags
      // — these are server-emitted, scoped to API-level cited blocks.
      return `<cite>${block.text}</cite><sup>${anchors.join('')}</sup>`;
    })
    .join('');

  return { markdown, sources, citationMap };
}
