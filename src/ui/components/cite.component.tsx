'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import type { ExtraProps } from 'react-markdown';

// Renders an Anthropic <cite> tag from web_search output as a highlighted
// span. The bracket links that follow each cited claim ([1][2]…) are baked
// into the persisted markdown by the server (see
// `build-citation-output.util.ts`), so this component is purely cosmetic —
// it just styles the inline span Claude wraps around its supported claims.
export function Cite({ children, node: _node, ...rest }: HTMLAttributes<HTMLElement> & ExtraProps) {
  // The `index` attribute Claude emits is not used by the renderer; strip it
  // so React doesn't warn about an unknown DOM attribute.
  const { index: _index, ...citeProps } = rest as { index?: unknown } & Record<string, unknown>;

  return (
    <cite
      {...citeProps}
      className="bg-primary/10 not-italic text-foreground decoration-primary/60 underline decoration-dotted underline-offset-2"
    >
      {children as ReactNode}
    </cite>
  );
}
