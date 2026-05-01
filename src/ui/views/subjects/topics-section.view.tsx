'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { Database } from '@/shared/lib/supabase/supabase.types';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { useTopicsSection } from '@/ui/views/subjects/hooks/useTopicsSection.hook';

type TopicRow = Database['public']['Tables']['topics']['Row'];

type Props = {
  subjectId: string;
  subjectSlug: string;
  initialTopics: TopicRow[];
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

function rowBgForStatus(status: string, hasHint: boolean): string {
  if (status === 'deep') return 'bg-accent/40';
  if (status === 'landscape') return 'bg-accent/15';
  return hasHint ? 'bg-primary/5' : '';
}

function statusLabel(status: string): string | null {
  if (status === 'deep') return 'deep research ✓';
  if (status === 'landscape') return 'landscape ✓';
  return null;
}

export function TopicsSection({ subjectId, subjectSlug, initialTopics }: Props) {
  const { sortedTopics, thinking, error, pending, triggerDiscover } = useTopicsSection({
    subjectId,
    initialTopics,
  });

  const hasTopics = sortedTopics.length > 0;
  const isWorking = thinking || pending;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">Topics</h3>

      {!hasTopics && !isWorking ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          <p>
            Start by reviewing your research brief and open questions below — that's the framing discovery
            will use.
          </p>
          <p>
            When you're ready, discovery takes that framing and does a wide web search to surface candidate
            research areas you can dig into.
          </p>
          <Button onClick={() => triggerDiscover()} disabled={isWorking}>
            Discover topics
          </Button>
        </div>
      ) : null}

      {isWorking && !hasTopics ? <DiscoverThinking /> : null}

      {hasTopics ? (
        <ul className="flex flex-col divide-y divide-border/40 rounded-md border bg-muted/20">
          {sortedTopics.map((topic) => (
            <li
              key={topic.id}
              className={[
                topic.discover_hint ? 'border-l-2 border-l-primary/50' : '',
                rowBgForStatus(topic.status, Boolean(topic.discover_hint)),
              ].join(' ')}
            >
              <Link
                href={`/subjects/${subjectSlug}/topics/${topic.slug}`}
                className="block p-3 transition-colors hover:bg-muted/40"
              >
                <TopicListItem topic={topic} subjectSlug={subjectSlug} />
              </Link>
            </li>
          ))}
          <li className="p-3">
            <NarrowTopicsRow onSubmit={triggerDiscover} disabled={isWorking} />
          </li>
        </ul>
      ) : null}

      {isWorking && hasTopics ? <p className="text-xs text-muted-foreground">More topics arriving…</p> : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

function TopicListItem({ topic }: { topic: TopicRow; subjectSlug: string }) {
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

function NarrowTopicsRow({ onSubmit, disabled }: { onSubmit: (hint: string) => void; disabled: boolean }) {
  const [hint, setHint] = useState('');

  function submit() {
    const trimmed = hint.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setHint('');
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        Missing a topic you had in mind? Describe it in a sentence and we'll dig for more.
      </span>
      <div className="flex items-center gap-2">
        <Input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. payer-side economics, pediatric edge cases"
          disabled={disabled}
          className="h-8"
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={disabled || hint.trim().length === 0}
          className="whitespace-nowrap"
        >
          Find more
        </Button>
      </div>
    </div>
  );
}

function DiscoverThinking() {
  const [tick, setTick] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, []);

  const dots = tick % 4;
  const elapsed = Math.floor((Date.now() - startRef.current) / 1000);

  return (
    <div className="flex flex-col items-center gap-4 rounded-md border bg-muted/20 p-8 text-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="tabular-nums">{elapsed}s</span>
      </div>
      <div>
        <p className="text-base font-medium">Mapping the research space{'.'.repeat(dots)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Surfacing candidate research topics tailored to your scope, angle, and end goal.
          <br />
          You'll get a ranked list — each with a title, a short pitch, and a rationale for why it matters —
          and you pick which ones to explore next.
          <br />
          This usually takes 60–120 seconds.
        </p>
      </div>
    </div>
  );
}
