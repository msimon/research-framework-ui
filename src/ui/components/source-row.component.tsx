import { TrustBadge } from '@/ui/components/trust-badge.component';
import type { SourceTrust } from '@/ui/types/source-trust.type';

type Props = {
  url: string;
  title: string | null;
  citedPosition: number | null;
  anchorId?: string;
  trust: SourceTrust | undefined;
};

export function SourceRow({ url, title, citedPosition, anchorId, trust }: Props) {
  return (
    <li id={anchorId} className="scroll-mt-16 p-3 text-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {citedPosition !== null ? `${citedPosition}.` : '·'}
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
          {title || url}
        </a>
        {trust ? <TrustBadge trust={trust} /> : null}
      </div>
    </li>
  );
}
