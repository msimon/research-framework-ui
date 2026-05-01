'use client';

import Link from 'next/link';
import type { Database } from '@/shared/lib/supabase/supabase.types';
import { Button } from '@/ui/components/ui/button';
import { DiscoverThinking } from '@/ui/views/subjects/components/discover-thinking.component';
import { NarrowTopicsRow } from '@/ui/views/subjects/components/narrow-topics-row.component';
import { TopicListItem } from '@/ui/views/subjects/components/topic-list-item.component';
import { useTopicsSection } from '@/ui/views/subjects/hooks/useTopicsSection.hook';

type TopicRow = Database['public']['Tables']['topics']['Row'];

type Props = {
  subjectId: string;
  subjectSlug: string;
  initialTopics: TopicRow[];
};

function rowBgForStatus(status: string, hasHint: boolean): string {
  if (status === 'deep') return 'bg-accent/40';
  if (status === 'landscape') return 'bg-accent/15';
  return hasHint ? 'bg-primary/5' : '';
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
                <TopicListItem topic={topic} />
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
