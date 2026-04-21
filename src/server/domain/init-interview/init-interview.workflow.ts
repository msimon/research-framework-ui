import 'server-only';
import { generateObject } from 'ai';
import { INIT_SUBJECT_SYSTEM_PROMPT } from '@/prompts/init-subject/init-subject.prompt';
import { type AgentStep, agentStepResponseSchema } from '@/prompts/init-subject/init-subject.schema';
import {
  createInterviewTurn,
  findInterviewTurns,
} from '@/server/domain/init-interview/init-interview.repository';
import { finalizeSubject } from '@/server/domain/subjects/subjects.command';
import { getSubjectById } from '@/server/domain/subjects/subjects.repository';
import { anthropicModel, anthropicProviderOptions } from '@/server/infra/anthropic/anthropic.client';
import { type EntityChannelName, supabaseBroadcastClient } from '@/server/infra/supabase/realtime';
import type { Database, Json } from '@/shared/lib/supabase/supabase.types';

type TurnRow = Database['public']['Tables']['init_interview_turns']['Row'];

type InterviewHistoryEntry = {
  turnNumber: number;
  agentStep: AgentStep;
  userAnswer: string | null;
};

export type StepInterviewInput = {
  userId: string;
  subjectId: string;
};

export type StepInterviewResult = {
  turn: TurnRow;
  step: AgentStep;
  done: boolean;
};

export async function runInitInterviewStep(input: StepInterviewInput): Promise<StepInterviewResult> {
  const subject = await getSubjectById(input.userId, input.subjectId);
  if (subject.status !== 'interviewing') {
    throw new Error(`Subject ${subject.slug} is not in interviewing state`);
  }

  const turns = await findInterviewTurns(subject.id);
  const history = toHistory(turns);

  const channel: EntityChannelName = `interview:${subject.id}`;
  const client = supabaseBroadcastClient();
  const broadcast = client.channel(channel);

  try {
    await new Promise<void>((resolve, reject) => {
      broadcast.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          reject(new Error(`Broadcast channel ${status}`));
        }
      });
    });
    broadcast.send({
      type: 'broadcast',
      event: 'event',
      payload: { subjectId: subject.id, type: 'thinking' },
    });

    const { object } = await generateObject({
      model: anthropicModel(),
      schema: agentStepResponseSchema,
      messages: buildInterviewMessages({
        seedProblemStatement: subject.seed_problem_statement,
        slug: subject.slug,
        history,
      }),
      providerOptions: { anthropic: anthropicProviderOptions },
    });

    const step = enforcePriorsChoices(object.step);
    const nextTurnNumber = turns.length + 1;
    const turn = await createInterviewTurn({
      subjectId: subject.id,
      turnNumber: nextTurnNumber,
      agentStep: step as unknown as Json,
    });

    broadcast.send({
      type: 'broadcast',
      event: 'event',
      payload: {
        subjectId: subject.id,
        turnId: turn.id,
        turnNumber: nextTurnNumber,
        type: 'step',
        step,
      },
    });

    if (step.type === 'complete') {
      await finalizeSubject(subject.id, step.framing as unknown as Json, {
        research_brief_md: step.research_brief_md,
        lexicon_md: step.lexicon_md,
        open_questions_md: step.open_questions_md,
        title: step.title,
      });
      broadcast.send({
        type: 'broadcast',
        event: 'event',
        payload: { subjectId: subject.id, turnId: turn.id, type: 'complete' },
      });
    }

    return { turn, step, done: step.type === 'complete' };
  } finally {
    await client.removeChannel(broadcast);
  }
}

function buildInterviewMessages(input: {
  seedProblemStatement: string | null;
  slug: string;
  history: InterviewHistoryEntry[];
}) {
  const seedLine = input.seedProblemStatement
    ? `Seed problem statement: "${input.seedProblemStatement}".`
    : 'No seed problem statement — the user gave a slug only.';

  const header = [
    `Subject slug: \`${input.slug}\`.`,
    seedLine,
    'Proceed with the adaptive interview. Emit ONE structured step for this turn.',
  ].join('\n');

  const historyLines =
    input.history.length === 0
      ? 'No prior turns. This is the first turn — emit your plan.'
      : input.history
          .map((entry) => {
            const stepLine = `Turn ${entry.turnNumber} — agent: ${JSON.stringify(entry.agentStep)}`;
            const answerLine = entry.userAnswer
              ? `Turn ${entry.turnNumber} — user answer: ${entry.userAnswer}`
              : `Turn ${entry.turnNumber} — user has not answered yet`;
            return `${stepLine}\n${answerLine}`;
          })
          .join('\n\n');

  return [
    {
      role: 'system' as const,
      content: INIT_SUBJECT_SYSTEM_PROMPT,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    },
    { role: 'user' as const, content: `${header}\n\n---\nInterview history:\n${historyLines}` },
  ];
}

const STARTING_FRESH_CHOICE = "I'm starting fresh";

function enforcePriorsChoices(step: AgentStep): AgentStep {
  if (step.type !== 'question' || step.question_id !== 'priors') return step;
  const existing = step.choices ?? [];
  const withoutFresh = existing.filter((c) => c.trim().toLowerCase() !== STARTING_FRESH_CHOICE.toLowerCase());
  return {
    ...step,
    choices: [...withoutFresh, STARTING_FRESH_CHOICE],
    allow_free_text: true,
  };
}

function toHistory(turns: TurnRow[]): InterviewHistoryEntry[] {
  return turns.map((turn) => ({
    turnNumber: turn.turn_number,
    agentStep: turn.agent_step as unknown as AgentStep,
    userAnswer: readAnswer(turn.user_answer),
  }));
}

function readAnswer(raw: Json | null): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && 'text' in raw && typeof (raw as { text: unknown }).text === 'string') {
    return (raw as { text: string }).text;
  }
  return JSON.stringify(raw);
}
