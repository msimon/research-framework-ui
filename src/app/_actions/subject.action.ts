'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  advanceInterview,
  saveInterviewAnswer,
  triggerFirstInterviewStep,
} from '@/server/domain/init-interview/init-interview.command';
import { createSubjectDraft } from '@/server/domain/subjects/subjects.command';
import { withAuth } from '@/server/lib/utils/auth';

const createSchema = z.object({
  raw: z.string().trim().min(1, 'Type a problem statement or slug'),
  slugOverride: z.string().trim().optional(),
});

export const createSubjectAction = withAuth(async (userId: string, formData: FormData) => {
  const parsed = createSchema.safeParse({
    raw: formData.get('raw'),
    slugOverride: formData.get('slugOverride') ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const subject = await createSubjectDraft(userId, {
    raw: parsed.data.raw,
    slugOverride: parsed.data.slugOverride || null,
  });

  const { ctx } = getCloudflareContext();
  ctx.waitUntil(
    triggerFirstInterviewStep(userId, subject.id).catch((error) => {
      console.error('[interview] first step failed', error);
    }),
  );
  redirect(`/subjects/new?id=${subject.id}`);
});

const answerSchema = z.object({
  subjectId: z.string().uuid(),
  turnId: z.string().uuid(),
  answer: z.string().trim().min(1, 'Write an answer'),
});

export const answerInterviewAction = withAuth(async (userId: string, formData: FormData) => {
  const parsed = answerSchema.safeParse({
    subjectId: formData.get('subjectId'),
    turnId: formData.get('turnId'),
    answer: formData.get('answer'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  await saveInterviewAnswer(parsed.data.subjectId, {
    turnId: parsed.data.turnId,
    answer: parsed.data.answer,
  });

  const { ctx } = getCloudflareContext();
  ctx.waitUntil(
    advanceInterview(userId, parsed.data.subjectId).catch((error) => {
      console.error('[interview] advance failed', error);
    }),
  );

  return { ok: true as const };
});
