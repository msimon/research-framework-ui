'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { z } from 'zod';

import { getOrCreateLandscape, runLandscape } from '@/server/domain/landscapes/landscapes.command';
import { getSubject } from '@/server/domain/subjects/subjects.command';
import { findTopicBySlug } from '@/server/domain/topics/topics.repository';
import { withAuth } from '@/server/lib/utils/auth';

const triggerSchema = z.object({
  subjectSlug: z.string().min(1),
  topicSlug: z.string().min(1),
});

export const triggerLandscapeAction = withAuth(async (userId: string, formData: FormData) => {
  const parsed = triggerSchema.safeParse({
    subjectSlug: formData.get('subjectSlug'),
    topicSlug: formData.get('topicSlug'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const subject = await getSubject(userId, parsed.data.subjectSlug);
  const topic = await findTopicBySlug(subject.id, parsed.data.topicSlug);
  if (!topic) return { error: 'Topic not found' };

  const landscape = await getOrCreateLandscape(topic.id);
  if (landscape.status === 'streaming') {
    return { ok: true as const, landscapeId: landscape.id, alreadyRunning: true };
  }

  const { ctx } = getCloudflareContext();
  ctx.waitUntil(
    runLandscape({
      userId,
      subjectId: subject.id,
      topicSlug: topic.slug,
      landscapeId: landscape.id,
    }).catch((error) => {
      console.error('[landscape] workflow failed', error);
    }),
  );

  return { ok: true as const, landscapeId: landscape.id };
});
