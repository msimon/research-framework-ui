'use client';

import type { Database } from '@/shared/lib/supabase/supabase.types';

type TopicRow = Database['public']['Tables']['topics']['Row'];

type Props = {
  topic: TopicRow;
};

const CATEGORY_LABELS: Record<string, string> = {
  market: 'Market',
  clinical: 'Clinical',
  regulatory: 'Regulatory',
  operations: 'Operations',
  technology: 'Technology',
  competitive: 'Competitive',
  economic: 'Economic',
  other: 'Other',
};

function statusLabel(status: string): string | null {
  if (status === 'deep') return 'deep research ✓';
  if (status === 'landscape') return 'landscape ✓';
  return null;
}

export function TopicListItem({ topic }: Props) {
  const stateLabel = statusLabel(topic.status);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{topic.title}</span>
          {stateLabel ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              {stateLabel}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {topic.discover_hint ? (
            <span
              className="max-w-[220px] truncate rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary"
              title={`Surfaced from hint: ${topic.discover_hint}`}
            >
              via: {topic.discover_hint}
            </span>
          ) : null}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[topic.category] ?? topic.category}
          </span>
        </div>
      </div>
      <p className="text-xs text-foreground">{topic.pitch}</p>
      {topic.rationale ? <p className="text-xs text-muted-foreground">{topic.rationale}</p> : null}
    </div>
  );
}
