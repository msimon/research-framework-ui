'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { startSessionAction } from '@/app/_actions/deep-research.action';
import { Button } from '@/ui/components/ui/button';
import { Textarea } from '@/ui/components/ui/textarea';

export type DeepResearchSessionSummary = {
  id: string;
  seed_question: string;
  status: string;
  turn_count: number;
  last_turn_at: string | null;
  created_at: string;
};

type Props = {
  subjectSlug: string;
  topicSlug: string;
  sessions: DeepResearchSessionSummary[];
};

export function DeepResearchSection({ subjectSlug, topicSlug, sessions }: Props) {
  const router = useRouter();
  const [seed, setSeed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    const trimmed = seed.trim();
    if (!trimmed) {
      setError('Write a question to start.');
      return;
    }
    setError(null);

    const formData = new FormData();
    formData.set('subjectSlug', subjectSlug);
    formData.set('topicSlug', topicSlug);
    formData.set('seedQuestion', trimmed);

    startTransition(async () => {
      const result = await startSessionAction(formData);
      if (result && 'error' in result) {
        setError(result.error ?? 'Could not start session');
        return;
      }
      setSeed('');
      router.push(`/subjects/${subjectSlug}/topics/${topicSlug}/sessions/${result.sessionId}`);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">Deep research</h3>

      <p className="text-xs text-muted-foreground">
        Read the landscape above, pick a specific point or concept you want to understand better, and ask a
        question. Each turn searches the web, returns a focused answer with sources, extracts key insights
        into your brief and lexicon, and suggests a natural follow-up you can use to go deeper.
      </p>

      {sessions.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border/40 rounded-md border bg-muted/20">
          {sessions.map((s) => (
            <li key={s.id} className="p-3">
              <Link
                href={`/subjects/${subjectSlug}/topics/${topicSlug}/sessions/${s.id}`}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{s.seed_question}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.turn_count} turn{s.turn_count === 1 ? '' : 's'}
                  {s.last_turn_at ? ` · last activity ${relativeTime(s.last_turn_at)}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
        className="flex flex-col gap-2 rounded-md border bg-muted/20 p-4"
      >
        <label htmlFor="deep-seed" className="text-xs font-medium text-muted-foreground">
          Question
        </label>
        <Textarea
          id="deep-seed"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="A specific, operational, or falsifiable question to anchor the dive…"
          rows={3}
          disabled={pending}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <Button type="submit" disabled={pending || seed.trim().length === 0}>
            {pending ? 'Starting…' : 'Start deep research'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
