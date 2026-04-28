'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import type { ExtraProps } from 'react-markdown';

import type { CitationEntry } from '@/shared/citation.type';
import { type CitationSource, useCitations } from '@/ui/components/citation.context';

// Renders an Anthropic <cite> tag from web_search output. When a citation
// context is mounted, finds matching entries by cited_text substring and
// renders one [N] bracket per match linking to the corresponding source row.
// Falls back to the legacy `src` superscript only when the model emitted
// an `index` attribute but nothing matched.
export function Cite({ children, node: _node, ...rest }: HTMLAttributes<HTMLElement> & ExtraProps) {
  const ctx = useCitations();
  const innerText = extractText(children);
  const matches = ctx ? findCitationMatches(innerText, ctx.citationMap, ctx.sources) : [];
  const indexAttr = (rest as { index?: string }).index;
  const hasIndex = typeof indexAttr === 'string' && indexAttr.length > 0;

  return (
    <>
      <cite
        {...rest}
        className="bg-primary/10 not-italic text-foreground decoration-primary/60 underline decoration-dotted underline-offset-2"
      >
        {children}
      </cite>
      {matches.length > 0 ? (
        <sup className="ml-0.5">
          {matches.map((bracket, i) => (
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

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function findCitationMatches(
  citeText: string,
  citationMap: CitationEntry[],
  sources: CitationSource[],
): number[] {
  const normalized = normalize(citeText);
  if (!normalized) return [];

  const brackets: number[] = [];
  const seenBrackets = new Set<number>();
  for (const entry of citationMap) {
    const cited = normalize(entry.cited_text);
    if (!cited) continue;
    if (!normalized.includes(cited) && !cited.includes(normalized)) continue;
    const bracket = sources.findIndex((s) => s.url === entry.url) + 1;
    if (bracket <= 0) continue;
    if (seenBrackets.has(bracket)) continue;
    seenBrackets.add(bracket);
    brackets.push(bracket);
  }
  return brackets;
}

function normalize(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
