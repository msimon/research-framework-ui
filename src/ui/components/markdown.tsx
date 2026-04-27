import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

// LLM output only — rehype-raw parses embedded HTML (e.g. Anthropic <cite> tags).
// Do not render user-submitted markdown through this component without sanitization.
export function Markdown({ children, className }: { children: string; className?: string }) {
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
          cite: ({ node: _node, ...props }) => {
            const { index: _index, ...rest } = props as {
              index?: string;
              [key: string]: unknown;
            };
            const hasCitation = typeof _index === 'string' && _index.length > 0;
            return (
              <>
                <cite
                  className="bg-primary/10 not-italic text-foreground decoration-primary/60 underline decoration-dotted underline-offset-2"
                  {...rest}
                />
                {hasCitation ? (
                  <sup>
                    <a
                      href="#sources"
                      className="ml-0.5 text-[10px] text-primary no-underline hover:underline"
                    >
                      src
                    </a>
                  </sup>
                ) : null}
              </>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
