'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { runDiscoverWorkflow } from '@/server/domain/discover/discover.workflow';
import { withAuth } from '@/server/lib/utils/auth';

const discoverSchema = z.object({
  subjectId: z.string().uuid(),
  hint: z.string().trim().min(1).max(500).optional(),
});

export const runDiscoverAction = withAuth(async (userId: string, formData: FormData) => {
  const rawHint = formData.get('hint');
  const parsed = discoverSchema.safeParse({
    subjectId: formData.get('subjectId'),
    hint: typeof rawHint === 'string' && rawHint.trim().length > 0 ? rawHint : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const result = await runDiscoverWorkflow({
    userId,
    subjectId: parsed.data.subjectId,
    narrowHint: parsed.data.hint,
  });
  revalidatePath(`/subjects/${result.subjectSlug}`);
  return { ok: true as const, insertedCount: result.insertedCount };
});
