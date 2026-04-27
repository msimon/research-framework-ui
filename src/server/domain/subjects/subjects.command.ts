import { deriveSlug, isLikelyProblemStatement } from '@/server/domain/subjects/slug';
import {
  createSubject,
  findSubjectBySlug,
  findSubjectsByUser,
  updateSubject,
} from '@/server/domain/subjects/subjects.repository';
import type { Json } from '@/shared/lib/supabase/supabase.types';

export type CreateSubjectDraftInput = {
  raw: string;
  slugOverride?: string | null;
};

export async function listSubjectsForUser(userId: string) {
  return findSubjectsByUser(userId);
}

export async function getSubject(userId: string, slug: string) {
  const subject = await findSubjectBySlug(userId, slug);
  if (!subject) throw new Error('Subject not found');
  return subject;
}

export async function createSubjectDraft(userId: string, input: CreateSubjectDraftInput) {
  const raw = input.raw.trim();
  if (!raw) throw new Error('Subject input is empty');

  const seed = isLikelyProblemStatement(raw) ? raw : null;
  const title = seed ?? raw;

  const baseSlug = input.slugOverride?.trim() ? deriveSlug(input.slugOverride) : deriveSlug(raw);
  const slug = await ensureUniqueSlug(userId, baseSlug);

  return createSubject({
    user_id: userId,
    slug,
    title,
    seed_problem_statement: seed,
    status: 'interviewing',
  });
}

export async function finalizeSubject(
  subjectId: string,
  framing: Json,
  docs: { research_brief_md: string; lexicon_md: string; open_questions_md: string; title?: string },
) {
  const patch = {
    framing,
    research_brief_md: docs.research_brief_md,
    lexicon_md: docs.lexicon_md,
    open_questions_md: docs.open_questions_md,
    status: 'ready' as const,
    ...(docs.title ? { title: docs.title } : {}),
  };
  return updateSubject(subjectId, patch);
}

export async function failSubjectInterview(subjectId: string) {
  return updateSubject(subjectId, { status: 'failed' });
}

async function ensureUniqueSlug(userId: string, baseSlug: string): Promise<string> {
  let candidate = baseSlug;
  let attempt = 1;
  while (await findSubjectBySlug(userId, candidate)) {
    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
    if (attempt > 50) throw new Error('Could not derive unique slug');
  }
  return candidate;
}
