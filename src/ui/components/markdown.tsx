import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import { Cite } from '@/ui/components/cite.component';

// LLM output only — rehype-raw parses embedded HTML (e.g. Anthropic <cite> tags
// and the <sup><a href="#source-N">[N]</a></sup> bracket links the server
// bakes into the persisted markdown after a streaming run completes).
// Do not render user-submitted markdown through this component without sanitization.
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted prose-code:before:content-none prose-code:after:content-none',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ cite: Cite }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
