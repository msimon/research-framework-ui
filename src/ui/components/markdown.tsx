'use client';

import type { HTMLAttributes } from 'react';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import type { CitationEntry } from '@/shared/citation.type';
import { useCitations } from '@/ui/components/citation.context';
import { Cite } from '@/ui/components/cite.component';

// LLM output only — rehype-raw parses embedded HTML (e.g. Anthropic <cite> tags).
// Do not render user-submitted markdown through this component without sanitization.
export function Markdown({ children, className }: { children: string; className?: string }) {
  const ctx = useCitations();
  // Cursor advances each time react-markdown invokes the cite handler. Children
  // are traversed top-down in document order, so the Nth cite tag in the rendered
  // output consumes the Nth (and following K-1) entries from citation_map.
  const cursor = { i: 0 };

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted prose-code:before:content-none prose-code:after:content-none',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          cite: ({
            children: citeChildren,
            node: _node,
            ...rest
          }: HTMLAttributes<HTMLElement> & ExtraProps) => {
            const indexAttr = (rest as { index?: string }).index;
            const k = countCitations(indexAttr);
            const entries: CitationEntry[] = ctx ? ctx.citationMap.slice(cursor.i, cursor.i + k) : [];
            cursor.i += k;
            return (
              <Cite {...rest} entries={entries} sources={ctx?.sources ?? []} indexAttr={indexAttr}>
                {citeChildren}
              </Cite>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function countCitations(indexAttr: string | undefined): number {
  if (!indexAttr) return 1;
  const count = indexAttr.split(',').filter((s) => s.trim().length > 0).length;
  return count > 0 ? count : 1;
}
