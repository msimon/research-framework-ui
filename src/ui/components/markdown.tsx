import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import { CitationAnchor } from '@/ui/components/citation-anchor.component';
import type { SourceTrustMap } from '@/ui/types/source-trust.type';

type CitedSource = { url: string; title: string | null };

export type CitationContext = {
  // Cited URLs in the same order as the bracket positions baked into the
  // markdown. `citedSources[N-1]` is the source for the `[N]` bracket.
  citedSources: ReadonlyArray<CitedSource>;
  trustMap: SourceTrustMap;
};

type Props = {
  children: string;
  className?: string;
  // When supplied, `<a href="#source-N">` and `<a href="#turn-K-source-N">`
  // anchors get replaced with a hover-tooltip variant exposing URL + trust.
  citation?: CitationContext;
};

const SOURCE_HREF_RE = /^#(?:turn-\d+-)?source-(\d+)$/;

// LLM output only — rehype-raw parses the `<sup><a href="#source-N">[N]</a></sup>`
// bracket links the server bakes into the persisted markdown after a
// streaming run completes. Do not render user-submitted markdown through
// this component without sanitization.
export function Markdown({ children, className, citation }: Props) {
  const components = citation ? buildComponents(citation) : undefined;

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted prose-code:before:content-none prose-code:after:content-none',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

function buildComponents({ citedSources, trustMap }: CitationContext): Components {
  return {
    a({ href, children, ...rest }) {
      const match = typeof href === 'string' ? SOURCE_HREF_RE.exec(href) : null;
      if (!match) {
        return (
          <a href={href} {...rest}>
            {children}
          </a>
        );
      }
      const position = Number.parseInt(match[1] ?? '', 10);
      const source = citedSources[position - 1];
      if (!source || !href) {
        return (
          <a href={href} {...rest}>
            {children}
          </a>
        );
      }
      return <CitationAnchor href={href} position={position} source={source} trust={trustMap[source.url]} />;
    },
  };
}
