'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import type { ExtraProps } from 'react-markdown';

import { useCitations } from '@/ui/components/citation.context';

// Renders an Anthropic <cite> tag from web_search output. Claude emits these
// with an `index` attribute of the form `X-Y[,A-B,...]` where each pair
// references one citation: `X` is the 1-indexed position of the source in the
// citation_map (the ordered list of `source` events captured during streaming),
// and `Y` is a sub-position inside that source (paragraph or character span)
// which the rendering doesn't need.
//
// We split the index attribute, take each `X`, look up the URL at that
// position in `citationMap`, then map the URL to its position in the
// deduplicated displayed `sources` list — that's the bracket number.
//
// Falls back to the legacy `src` superscript when the cite tag has an index
// but none of its X values resolved (e.g. the source list hasn't streamed in
// yet or the index is out of range).
export function Cite({ children, node: _node, ...rest }: HTMLAttributes<HTMLElement> & ExtraProps) {
  const ctx = useCitations();
  const indexAttr = (rest as { index?: string }).index;
  const hasIndex = typeof indexAttr === 'string' && indexAttr.length > 0;
  const brackets = ctx ? resolveBrackets(indexAttr, ctx.citationMap, ctx.sources) : [];
  // Strip `index` from the spread so React doesn't warn about an unknown DOM attribute.
  const { index: _index, ...citeProps } = rest as { index?: unknown } & Record<string, unknown>;

  return (
    <>
      <cite
        {...citeProps}
        className="bg-primary/10 not-italic text-foreground decoration-primary/60 underline decoration-dotted underline-offset-2"
      >
        {children as ReactNode}
      </cite>
      {brackets.length > 0 ? (
        <sup className="ml-0.5">
          {brackets.map((bracket, i) => (
            <a
              key={`${bracket}-${i}`}
              href={`#source-${bracket}`}
              className="text-[10px] text-primary no-underline hover:underline"
            >
              [{bracket}]
            </a>
          ))}
        </sup>
      ) : hasIndex ? (
        <sup>
          <a href="#sources" className="ml-0.5 text-[10px] text-primary no-underline hover:underline">
            src
          </a>
        </sup>
      ) : null}
    </>
  );
}

function resolveBrackets(
  indexAttr: string | undefined,
  citationMap: ReadonlyArray<{ url: string }>,
  sources: ReadonlyArray<{ url: string }>,
): number[] {
  if (!indexAttr) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const part of indexAttr.split(',')) {
    const x = Number.parseInt(part.trim().split('-')[0], 10);
    if (!Number.isFinite(x) || x <= 0) continue;
    const entry = citationMap[x - 1];
    if (!entry) continue;
    const bracket = sources.findIndex((s) => s.url === entry.url) + 1;
    if (bracket <= 0) continue;
    if (seen.has(bracket)) continue;
    seen.add(bracket);
    result.push(bracket);
  }
  return result;
}
