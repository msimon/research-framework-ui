'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import type { ExtraProps } from 'react-markdown';

import type { CitationEntry } from '@/shared/citation.type';
import type { CitationSource } from '@/ui/components/citation.context';

// Renders an Anthropic <cite> tag from web_search output. The parent Markdown
// resolves which CitationEntries belong to this cite tag (via document-order
// cursor) and passes them as `entries`. We then look each entry's URL up in
// the entity-scoped sources list to compute the [N] bracket number.
//
// Falls back to the legacy `src` superscript when the model emitted an
// `index` attribute but no entries resolved to a known source row.
type Props = HTMLAttributes<HTMLElement> &
  ExtraProps & {
    entries: CitationEntry[];
    sources: CitationSource[];
    indexAttr: string | undefined;
  };

export function Cite({ children, node: _node, entries, sources, indexAttr, ...rest }: Props) {
  const brackets = entries
    .map((entry) => sources.findIndex((s) => s.url === entry.url) + 1)
    .filter((n): n is number => n > 0);
  const hasIndex = typeof indexAttr === 'string' && indexAttr.length > 0;
  // `index` is the model-provided attribute; strip it so React doesn't warn
  // about an unknown DOM attribute when we spread `rest` onto <cite>.
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
