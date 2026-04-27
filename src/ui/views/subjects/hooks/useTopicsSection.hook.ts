'use client';

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { runDiscoverAction } from '@/app/_actions/discover.action';
import { supabaseClient } from '@/shared/lib/supabase/client';

export type TopicsSectionTopic = {
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

type Args = {
  subjectId: string;
  initialTopics: TopicsSectionTopic[];
};

function statusRank(status: string): number {
  if (status === 'deep') return 0;
  if (status === 'landscape') return 1;
  return 2;
}

export function useTopicsSection({ subjectId, initialTopics }: Args) {
  const [topics, setTopics] = useState<TopicsSectionTopic[]>(initialTopics);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const broadcast = supabaseClient
      .channel(`subject:${subjectId}`, { config: { private: true } })
      .on('broadcast', { event: 'event' }, ({ payload }: { payload: { type?: string } }) => {
        if (payload?.type === 'discover:thinking') setThinking(true);
        if (payload?.type === 'discover:complete') setThinking(false);
      })
      .subscribe();

    const rows = supabaseClient
      .channel(`topics:subject:${subjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'topics',
          filter: `subject_id=eq.${subjectId}`,
        },
        (payload: RealtimePostgresChangesPayload<TopicsSectionTopic>) => {
          if (payload.eventType !== 'INSERT') return;
          const row = payload.new;
          setTopics((prev) => {
            if (prev.some((t) => t.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'topics',
          filter: `subject_id=eq.${subjectId}`,
        },
        (payload: RealtimePostgresChangesPayload<TopicsSectionTopic>) => {
          if (payload.eventType !== 'UPDATE') return;
          const row = payload.new;
          setTopics((prev) => prev.map((t) => (t.id === row.id ? row : t)));
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

  const sortedTopics = useMemo(
    () =>
      [...topics].sort((a, b) => {
        const rankDiff = statusRank(a.status) - statusRank(b.status);
        if (rankDiff !== 0) return rankDiff;
        return a.sort_order - b.sort_order;
      }),
    [topics],
  );

  return {
    sortedTopics,
    thinking,
    error,
    pending,
    triggerDiscover,
  };
}
