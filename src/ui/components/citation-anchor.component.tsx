import { cn } from '@/lib/utils';
import type { SourceTrust } from '@/ui/types/source-trust.type';

type Props = {
  href: string;
  position: number;
  source: { url: string; title: string | null };
  trust: SourceTrust | undefined;
};

// Renders the [N] bracket with a hover popover showing the source URL and
// trust badge. Used by the Markdown component to replace server-baked
// `<a href="#source-N">[N]</a>` anchors when a citation context is supplied.
export function CitationAnchor({ href, position, source, trust }: Props) {
  return (
    <span className="group relative inline-block">
      <a href={href} className="ml-0.5 text-[10px] text-primary no-underline hover:underline">
        [{position}]
      </a>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-50 mt-1 w-72 max-w-[80vw] rounded-md border bg-popover p-2 text-left text-xs leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <span className="block truncate font-medium text-foreground">{source.title || source.url}</span>
        <span className="block truncate text-muted-foreground">{source.url}</span>
        {trust ? <CitationTrust trust={trust} /> : null}
      </span>
    </span>
  );
}

type TrustTier = 'high' | 'medium' | 'low' | 'unknown';

const tierClasses: Record<TrustTier, string> = {
  high: 'border-primary/40 bg-primary/10 text-primary',
  medium: 'border-border bg-muted text-foreground',
  low: 'border-destructive/30 bg-destructive/5 text-destructive',
  unknown: 'border-border bg-muted text-muted-foreground',
};

function trustTier(score: number | undefined | null): TrustTier {
  if (score === undefined || score === null) return 'unknown';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function CitationTrust({ trust }: { trust: SourceTrust }) {
  const tier = trustTier(trust.trust_score);
  return (
    <span className="mt-1.5 flex flex-col gap-1">
      <span
        className={cn(
          'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none tabular-nums',
          tierClasses[tier],
        )}
      >
        <span>{trust.category}</span>
        <span aria-hidden="true" className="opacity-60">
          ·
        </span>
        <span>{trust.trust_score}/5</span>
      </span>
      {trust.rationale ? <span className="text-[11px] text-muted-foreground">{trust.rationale}</span> : null}
    </span>
  );
}
