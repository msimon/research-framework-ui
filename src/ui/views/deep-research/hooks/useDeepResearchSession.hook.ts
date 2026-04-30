'use client';

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useState, useTransition } from 'react';
import { submitTurnAction } from '@/app/_actions/deep-research.action';
import type { LexiconEntry } from '@/prompts/landscape/landscape.schema';
import { supabaseClient } from '@/shared/lib/supabase/client';
import type { DeepResearchTurnState } from '@/ui/views/deep-research/types/deep-research-turn-state.type';
import type { LiveTurnBuffer } from '@/ui/views/deep-research/types/live-turn-buffer.type';

type SessionEvent =
  | { type: 'status'; status: string }
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input?: { query?: string } }
  | { type: 'tool_result'; id: string; name: string }
  | { type: 'citation'; url: string; title: string | null; cited_text: string }
  | { type: 'supporting_source'; url: string; title: string | null }
  | { type: 'complete' }
  | { type: 'error'; message: string };

type BroadcastPayload = SessionEvent & { sessionId: string; turnId: string; seq: number };

type Args = {
  subjectId: string;
  subjectSlug: string;
  topicSlug: string;
  sessionId: string;
  initialStatus: string;
  initialLexicon: LexiconEntry[];
  initialTurns: DeepResearchTurnState[];
};

export function useDeepResearchSession(args: Args) {
  const [turns, setTurns] = useState<DeepResearchTurnState[]>(args.initialTurns);
  const [sessionStatus, setSessionStatus] = useState(args.initialStatus);
  const [lexicon, setLexicon] = useState<LexiconEntry[]>(args.initialLexicon);
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
          const existing = prev[turnId] ?? {
            text: '',
            reasoning: '',
            toolCalls: [],
            citations: [],
            supporting: [],
          };
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
                  citations: [
                    ...existing.citations,
                    { url: payload.url, title: payload.title, cited_text: payload.cited_text },
                  ],
                },
              };
            case 'supporting_source':
              return {
                ...prev,
                [turnId]: {
                  ...existing,
                  supporting: [...existing.supporting, { url: payload.url, title: payload.title }],
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
        (payload: RealtimePostgresChangesPayload<{ lexicon: LexiconEntry[] }>) => {
          if (payload.eventType !== 'UPDATE') return;
          setLexicon(payload.new.lexicon);
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(subjectRow);
    };
  }, [args.subjectId]);

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
    live,
    sessionStatus,
    lexicon,
    error,
    pending,
    activeTurn,
    canSubmit,
    submit,
  };
}
