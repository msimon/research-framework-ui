import type { LexiconEntry } from '@/prompts/landscape/landscape.schema';
import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database, Json } from '@/shared/lib/supabase/supabase.types';

type SubjectRow = Database['public']['Tables']['subjects']['Row'];
type SubjectInsert = Database['public']['Tables']['subjects']['Insert'];
type SubjectUpdate = Database['public']['Tables']['subjects']['Update'];

// Domain Subject type — overrides the auto-generated `lexicon: Json` with the
// known shape so call sites get typed entries without per-call casts. Every
// write goes through `mergeLexicon` (or init-subject's Zod-validated
// `step.lexicon`), so the cast at the repo boundary is sound.
export type Subject = Omit<SubjectRow, 'lexicon'> & { lexicon: LexiconEntry[] };
export type SubjectPatch = Omit<SubjectUpdate, 'lexicon'> & { lexicon?: LexiconEntry[] };

const LIST_COLUMNS = 'id, slug, title, status, seed_problem_statement, created_at, updated_at';
const DETAIL_COLUMNS =
  'id, user_id, slug, title, seed_problem_statement, framing, research_brief_md, lexicon, open_questions_md, status, created_at, updated_at';

function fromRow(row: SubjectRow): Subject {
  return { ...row, lexicon: row.lexicon as LexiconEntry[] };
}

function toUpdate(patch: SubjectPatch): SubjectUpdate {
  if (!('lexicon' in patch) || patch.lexicon === undefined) return patch as SubjectUpdate;
  const { lexicon, ...rest } = patch;
  return { ...rest, lexicon: lexicon as unknown as Json };
}

export async function findSubjectsByUser(userId: string) {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('subjects')
    .select(LIST_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to list subjects: ${error.message}`);
  return data ?? [];
}

export async function findSubjectById(userId: string, subjectId: string): Promise<Subject | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('subjects')
    .select(DETAIL_COLUMNS)
    .eq('user_id', userId)
    .eq('id', subjectId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load subject: ${error.message}`);
  return data ? fromRow(data) : null;
}

export async function getSubjectById(userId: string, subjectId: string): Promise<Subject> {
  const subject = await findSubjectById(userId, subjectId);
  if (!subject) throw new Error('Subject not found');
  return subject;
}

export async function findSubjectBySlug(userId: string, slug: string): Promise<Subject | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('subjects')
    .select(DETAIL_COLUMNS)
    .eq('user_id', userId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load subject: ${error.message}`);
  return data ? fromRow(data) : null;
}

export async function getSubjectBySlug(userId: string, slug: string): Promise<Subject> {
  const subject = await findSubjectBySlug(userId, slug);
  if (!subject) throw new Error('Subject not found');
  return subject;
}

export async function createSubject(row: SubjectInsert): Promise<Subject> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('subjects').insert(row).select(DETAIL_COLUMNS).single();

  if (error) throw new Error(`Failed to create subject: ${error.message}`);
  return fromRow(data);
}

export async function updateSubject(subjectId: string, patch: SubjectPatch): Promise<Subject> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('subjects')
    .update(toUpdate(patch))
    .eq('id', subjectId)
    .select(DETAIL_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update subject: ${error.message}`);
  return fromRow(data);
}
