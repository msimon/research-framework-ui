'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { runDiscoverAction } from '@/app/_actions/discover.action';
import { supabaseClient } from '@/shared/lib/supabase/client';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';

type Topic = {
  id: string;
  slug: string;
  title: string;
  pitch: string;
  rationale: string;
  category: string;
  status: string;
  sort_order: number;
  discover_hint: string | null;
  created_at: string;
};

type Props = {
  subjectId: string;
  subjectSlug: string;
  initialTopics: Topic[];
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

export function TopicsSection({ subjectId, subjectSlug, initialTopics }: Props) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const broadcast = supabaseClient
      .channel(`subject:${subjectId}`)
      .on('broadcast', { event: 'event' }, ({ payload }: { payload: { type?: string } }) => {
        if (payload?.type === 'discover:thinking') setThinking(true);
        if (payload?.type === 'discover:complete') setThinking(false);
      })
      .subscribe();

    const rows = supabaseClient
      .channel(`topics:subject:${subjectId}`)
      .on(
        // biome-ignore lint/suspicious/noExplicitAny: Supabase channel generic is awkward for postgres_changes
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'topics',
          filter: `subject_id=eq.${subjectId}`,
        },
        (payload: { new: Topic | null }) => {
          const row = payload.new;
          if (!row) return;
          setTopics((prev) => {
            if (prev.some((t) => t.id === row.id)) return prev;
            const next = [...prev, row];
            next.sort((a, b) => a.sort_order - b.sort_order);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(broadcast);
      supabaseClient.removeChannel(rows);
    };
  }, [subjectId]);

  function triggerDiscover(hint?: string) {
    setError(null);
    const formData = new FormData();
    formData.set('subjectId', subjectId);
    if (hint) formData.set('hint', hint);
    startTransition(async () => {
      const result = await runDiscoverAction(formData);
      if (result && 'error' in result) setError(result.error ?? 'Discover failed');
    });
  }

  const hasTopics = topics.length > 0;
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
          {topics.map((topic) => (
            <li
              key={topic.id}
              className={topic.discover_hint ? 'border-l-2 border-l-primary/50 bg-primary/5 p-3' : 'p-3'}
            >
              <TopicRow topic={topic} subjectSlug={subjectSlug} />
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

function TopicRow({ topic }: { topic: Topic; subjectSlug: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{topic.title}</span>
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
    <div className="flex items-center gap-3 rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
      <span className="tabular-nums">{elapsed}s</span>
      <span>Searching the web and enumerating topics{'.'.repeat(dots)}</span>
    </div>
  );
}
