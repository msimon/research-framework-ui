import { cn } from '@/lib/utils';
import type { SourceTrust } from '@/ui/types/source-trust.type';

type Props = {
  trust: SourceTrust;
};

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

export function TrustBadge({ trust }: Props) {
  const tier = trustTier(trust.trust_score);
  return (
    <span className="group relative inline-block">
      <span
        className={cn(
          'inline-flex shrink-0 cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none tabular-nums',
          tierClasses[tier],
        )}
      >
        <span>{trust.category}</span>
        <span aria-hidden="true" className="opacity-60">
          ·
        </span>
        <span>{trust.trust_score}/5</span>
      </span>
      {trust.rationale ? (
        <span
          role="tooltip"
          className="pointer-events-none invisible absolute left-0 top-full z-50 mt-1 w-72 max-w-[80vw] rounded-md border bg-popover p-2 text-left text-xs leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          <span className="block text-muted-foreground">{trust.rationale}</span>
        </span>
      ) : null}
    </span>
  );
}
