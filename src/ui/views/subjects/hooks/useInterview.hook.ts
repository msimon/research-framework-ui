'use client';

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { AgentStep } from '@/prompts/init-subject/init-subject.schema';
import { supabaseClient } from '@/shared/lib/supabase/client';
import type { InterviewBroadcastEvent } from '@/shared/realtime/interview.events';

export type InterviewTurn = {
  id: string;
  turn_number: number;
  agent_step: AgentStep;
  user_answer: { text?: string } | null;
};

type Args = {
  subjectId: string;
  subjectSlug: string;
  initialTurns: InterviewTurn[];
  initialStatus: string;
};

export function useInterview({ subjectId, subjectSlug, initialTurns, initialStatus }: Args) {
  const router = useRouter();
  const [turns, setTurns] = useState<InterviewTurn[]>(initialTurns);
  const [status, setStatus] = useState(initialStatus);
  const [thinking, setThinking] = useState(false);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  useEffect(() => {
    console.log('[rt] mounting subscriptions for subject', subjectId);

    const liveChannel = supabaseClient
      .channel(`interview:${subjectId}`, { config: { private: true } })
      .on('broadcast', { event: 'event' }, ({ payload }: { payload: InterviewBroadcastEvent }) => {
        console.log('[rt:broadcast]', payload);
        if (payload.type === 'thinking') setThinking(true);
      })
      .subscribe((s, err) => console.log('[rt:broadcast] status', s, err ?? ''));

    const turnsChannel = supabaseClient
      .channel(`turns:interview:${subjectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'init_interview_turns',
          filter: `subject_id=eq.${subjectId}`,
        },
        (payload: RealtimePostgresChangesPayload<InterviewTurn>) => {
          console.log('[rt:turns] event', payload.eventType, payload);
          if (payload.eventType === 'INSERT') setThinking(false);
          if (payload.eventType === 'DELETE') return;
          const row = payload.new;
          setTurns((prev) => {
            const next = prev.filter((t) => t.id !== row.id);
            next.push(row);
            next.sort((a, b) => a.turn_number - b.turn_number);
            return next;
          });
        },
      )
      .subscribe((s, err) => console.log('[rt:turns] status', s, err ?? ''));

    const subjectChannel = supabaseClient
      .channel(`subject-status:${subjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subjects',
          filter: `id=eq.${subjectId}`,
        },
        (payload: RealtimePostgresChangesPayload<{ status: string }>) => {
          console.log('[rt:subject] event', payload);
          if (payload.eventType !== 'UPDATE') return;
          const nextStatus = payload.new.status;
          if (nextStatus) setStatus(nextStatus);
        },
      )
      .subscribe((s, err) => console.log('[rt:subject] status', s, err ?? ''));

    return () => {
      console.log('[rt] unmounting subscriptions for subject', subjectId);
      supabaseClient.removeChannel(liveChannel);
      supabaseClient.removeChannel(turnsChannel);
      supabaseClient.removeChannel(subjectChannel);
    };
  }, [subjectId]);

  useEffect(() => {
    if (status === 'ready') router.push(`/subjects/${subjectSlug}`);
  }, [status, subjectSlug, router]);

  const latestTurn = turns[turns.length - 1];
  const awaitingAnswer =
    latestTurn?.agent_step.type === 'question' || latestTurn?.agent_step.type === 'pushback';
  const canAnswer = awaitingAnswer && !latestTurn?.user_answer;

  const planStep = turns.find((t) => t.agent_step.type === 'plan')?.agent_step;
  const plannedCount = planStep?.type === 'plan' ? planStep.will_ask.length : 0;
  const answeredQuestionIds = new Set(
    turns.flatMap((t) =>
      t.agent_step.type === 'question' && t.user_answer ? [t.agent_step.question_id] : [],
    ),
  );
  const finalizing = thinking && plannedCount > 0 && answeredQuestionIds.size >= plannedCount;

  return {
    turns,
    status,
    thinking,
    latestTurn,
    awaitingAnswer,
    canAnswer,
    finalizing,
  };
}
