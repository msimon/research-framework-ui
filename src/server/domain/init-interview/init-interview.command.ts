import {
  findInterviewTurns,
  findLatestInterviewTurn,
  saveInterviewTurnAnswer,
} from '@/server/domain/init-interview/init-interview.repository';
import { runInitInterviewStep } from '@/server/domain/init-interview/init-interview.workflow';
import { getSubjectById } from '@/server/domain/subjects/subjects.repository';

export async function loadInterviewState(userId: string, subjectId: string) {
  const subject = await getSubjectById(userId, subjectId);
  const turns = await findInterviewTurns(subjectId);
  return { subject, turns };
}

export async function triggerFirstInterviewStep(userId: string, subjectId: string) {
  const existing = await findInterviewTurns(subjectId);
  if (existing.length > 0) return existing[existing.length - 1];

  const planResult = await runInitInterviewStep({ userId, subjectId });
  if (planResult.step.type !== 'plan') {
    throw new Error('Expected plan step on first interview turn');
  }

  const next = await runInitInterviewStep({ userId, subjectId });
  if (next.step.type === 'plan') {
    throw new Error('Agent emitted a plan step after the initial plan');
  }
  return next.turn;
}

export async function saveInterviewAnswer(
  subjectId: string,
  params: { turnId: string; answer: string },
) {
  const latest = await findLatestInterviewTurn(subjectId);
  if (!latest) throw new Error('No interview turn to answer');
  if (latest.id !== params.turnId) throw new Error('Answer is for a stale turn');
  if (latest.user_answer != null) throw new Error('This turn has already been answered');

  await saveInterviewTurnAnswer(latest.id, { text: params.answer });
}

export async function advanceInterview(userId: string, subjectId: string) {
  return runInitInterviewStep({ userId, subjectId });
}
