import { cn } from '@/lib/utils';
import { trustTier } from '@/shared/lib/utils/source-trust-tier.util';
import type { SourceTrust } from '@/ui/types/source-trust.type';

type Props = {
  trust: SourceTrust;
};

const tierClasses: Record<ReturnType<typeof trustTier>, string> = {
  high: 'border-primary/40 bg-primary/10 text-primary',
  medium: 'border-border bg-muted text-foreground',
  low: 'border-destructive/30 bg-destructive/5 text-destructive',
  unknown: 'border-border bg-muted text-muted-foreground',
};

export function TrustBadge({ trust }: Props) {
  const tier = trustTier(trust.trust_score);
  return (
    <span
      title={trust.rationale}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none tabular-nums',
        tierClasses[tier],
      )}
    >
      <span>{trust.category}</span>
      <span aria-hidden="true" className="opacity-60">
        ·
      </span>
      <span>{trust.trust_score}/5</span>
    </span>
  );
}
