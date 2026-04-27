'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { z } from 'zod';

import {
  closeSession,
  runDeepResearchTurn,
  startSession,
  submitTurn,
} from '@/server/domain/deep-research/deep-research.command';
import { getSessionById } from '@/server/domain/deep-research/deep-research.repository';
import { getSubject } from '@/server/domain/subjects/subjects.command';
import { findTopicBySlug } from '@/server/domain/topics/topics.repository';
import { withAuth } from '@/server/lib/utils/auth';

const startSchema = z.object({
  subjectSlug: z.string().min(1),
  topicSlug: z.string().min(1),
  seedQuestion: z.string().trim().min(1, 'Seed question is required'),
});

export const startSessionAction = withAuth(async (userId: string, formData: FormData) => {
  const parsed = startSchema.safeParse({
    subjectSlug: formData.get('subjectSlug'),
    topicSlug: formData.get('topicSlug'),
    seedQuestion: formData.get('seedQuestion'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const subject = await getSubject(userId, parsed.data.subjectSlug);
  const topic = await findTopicBySlug(subject.id, parsed.data.topicSlug);
  if (!topic) return { error: 'Topic not found' };

  const { sessionId, turnId } = await startSession({
    userId,
    topicId: topic.id,
    seedQuestion: parsed.data.seedQuestion,
  });

  const { ctx } = getCloudflareContext();
  ctx.waitUntil(
    runDeepResearchTurn({ userId, sessionId, turnId }).catch((error) => {
      console.error('[deep-research] workflow failed (start)', error);
    }),
  );

  return { ok: true as const, sessionId, turnId, subjectSlug: subject.slug, topicSlug: topic.slug };
});

const submitSchema = z.object({
  sessionId: z.string().uuid(),
  userText: z.string().trim().min(1, 'Write a message'),
});

export const submitTurnAction = withAuth(async (userId: string, formData: FormData) => {
  const parsed = submitSchema.safeParse({
    sessionId: formData.get('sessionId'),
    userText: formData.get('userText'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { turnId } = await submitTurn({
    userId,
    sessionId: parsed.data.sessionId,
    userText: parsed.data.userText,
  });

  const { ctx } = getCloudflareContext();
  ctx.waitUntil(
    runDeepResearchTurn({ userId, sessionId: parsed.data.sessionId, turnId }).catch((error) => {
      console.error('[deep-research] workflow failed (submit)', error);
    }),
  );

  return { ok: true as const, turnId };
});

const closeSchema = z.object({
  sessionId: z.string().uuid(),
});

export const closeSessionAction = withAuth(async (userId: string, formData: FormData) => {
  const parsed = closeSchema.safeParse({
    sessionId: formData.get('sessionId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await closeSession(userId, parsed.data.sessionId);

  const session = await getSessionById(parsed.data.sessionId);
  return { ok: true as const, topicId: session.topic_id };
});
