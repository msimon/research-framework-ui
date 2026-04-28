'use client';

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useState, useTransition } from 'react';

import { submitTurnAction } from '@/app/_actions/deep-research.action';
import type { CitationEntry } from '@/shared/citation.type';
import { supabaseClient } from '@/shared/lib/supabase/client';

export type DeepResearchTurnState = {
  id: string;
  turn_number: number;
  user_text: string | null;
  findings_md: string | null;
  my_read_md: string | null;
  followup_question: string | null;
  reasoning_md: string | null;
  citation_map: CitationEntry[];
  status: string;
  error_message: string | null;
};

export type DeepResearchSourceState = {
  id: string;
  turn_id: string | null;
  url: string;
  title: string | null;
};

export type LiveTurnBuffer = {
  text: string;
  reasoning: string;
  toolCalls: Array<{ id: string; name: string; query: string; resolved: boolean }>;
  citations: CitationEntry[];
};

type SessionEvent =
  | { type: 'status'; status: string }
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input?: { query?: string } }
  | { type: 'tool_result'; id: string; name: string }
  | { type: 'citation'; url: string; title: string | null; cited_text: string }
  | { type: 'complete' }
  | { type: 'error'; message: string };

type BroadcastPayload = SessionEvent & { sessionId: string; turnId: string; seq: number };

type Args = {
  subjectId: string;
  subjectSlug: string;
  topicSlug: string;
  sessionId: string;
  initialStatus: string;
  initialLexiconMd: string;
  initialTurns: DeepResearchTurnState[];
  initialSources: DeepResearchSourceState[];
};

export function useDeepResearchSession(args: Args) {
  const [turns, setTurns] = useState<DeepResearchTurnState[]>(args.initialTurns);
  const [sources, setSources] = useState<DeepResearchSourceState[]>(args.initialSources);
  const [sessionStatus, setSessionStatus] = useState(args.initialStatus);
  const [lexiconMd, setLexiconMd] = useState(args.initialLexiconMd);
  const [live, setLive] = useState<Record<string, LiveTurnBuffer>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const channel = supabaseClient
      .channel(`session:${args.sessionId}`, { config: { private: true } })
      .on('broadcast', { event: 'event' }, ({ payload }: { payload: BroadcastPayload }) => {
        if (!payload || typeof payload !== 'object' || !('type' in payload)) return;
        const { turnId } = payload;
        setLive((prev) => {
          const existing = prev[turnId] ?? { text: '', reasoning: '', toolCalls: [], citations: [] };
          switch (payload.type) {
            case 'text':
              return { ...prev, [turnId]: { ...existing, text: existing.text + payload.delta } };
            case 'reasoning':
              return {
                ...prev,
                [turnId]: { ...existing, reasoning: existing.reasoning + payload.delta },
              };
            case 'tool_call': {
              const query = typeof payload.input?.query === 'string' ? payload.input.query : '…';
              return {
                ...prev,
                [turnId]: {
                  ...existing,
                  toolCalls: [
                    ...existing.toolCalls,
                    { id: payload.id, name: payload.name, query, resolved: false },
                  ],
                },
              };
            }
            case 'tool_result':
              return {
                ...prev,
                [turnId]: {
                  ...existing,
                  toolCalls: existing.toolCalls.map((c) =>
                    c.id === payload.id ? { ...c, resolved: true } : c,
                  ),
                },
              };
            case 'citation':
              return {
                ...prev,
                [turnId]: {
                  ...existing,
                  citations: [...existing.citations, { url: payload.url, cited_text: payload.cited_text }],
                },
              };
            default:
              return prev;
          }
        });
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [args.sessionId]);

  useEffect(() => {
    const rows = supabaseClient
      .channel(`deep_research_turns:session:${args.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deep_research_turns',
          filter: `session_id=eq.${args.sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<DeepResearchTurnState>) => {
          if (payload.eventType === 'DELETE') return;
          const next = payload.new;
          setTurns((prev) => {
            const idx = prev.findIndex((t) => t.id === next.id);
            if (idx === -1) return [...prev, next].sort((a, b) => a.turn_number - b.turn_number);
            const clone = [...prev];
            clone[idx] = next;
            return clone;
          });
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(rows);
    };
  }, [args.sessionId]);

  useEffect(() => {
    const sessionRow = supabaseClient
      .channel(`deep_research_sessions:row:${args.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deep_research_sessions',
          filter: `id=eq.${args.sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<{ status: string }>) => {
          if (payload.eventType !== 'UPDATE') return;
          setSessionStatus(payload.new.status);
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(sessionRow);
    };
  }, [args.sessionId]);

  useEffect(() => {
    const subjectRow = supabaseClient
      .channel(`subjects:row:${args.subjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subjects',
          filter: `id=eq.${args.subjectId}`,
        },
        (payload: RealtimePostgresChangesPayload<{ lexicon_md: string }>) => {
          if (payload.eventType !== 'UPDATE') return;
          setLexiconMd(payload.new.lexicon_md);
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(subjectRow);
    };
  }, [args.subjectId]);

  useEffect(() => {
    const src = supabaseClient
      .channel(`sources:session:${args.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sources',
          filter: `session_id=eq.${args.sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<DeepResearchSourceState>) => {
          if (payload.eventType !== 'INSERT') return;
          const next = payload.new;
          setSources((prev) => (prev.some((s) => s.id === next.id) ? prev : [...prev, next]));
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(src);
    };
  }, [args.sessionId]);

  function submit(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;
    setError(null);
    const formData = new FormData();
    formData.set('sessionId', args.sessionId);
    formData.set('userText', trimmed);
    startTransition(async () => {
      const result = await submitTurnAction(formData);
      if (result && 'error' in result) setError(result.error ?? 'Turn failed');
    });
  }

  const activeTurn = turns.find((t) => t.status === 'streaming') ?? null;
  const canSubmit = sessionStatus === 'active' && !activeTurn && !pending;

  return {
    turns,
    sources,
    live,
    sessionStatus,
    lexiconMd,
    error,
    pending,
    activeTurn,
    canSubmit,
    submit,
  };
}
