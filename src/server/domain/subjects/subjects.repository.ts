import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type SubjectRow = Database['public']['Tables']['subjects']['Row'];
type SubjectInsert = Database['public']['Tables']['subjects']['Insert'];
type SubjectUpdate = Database['public']['Tables']['subjects']['Update'];

const LIST_COLUMNS = 'id, slug, title, status, seed_problem_statement, created_at, updated_at';
const DETAIL_COLUMNS =
  'id, user_id, slug, title, seed_problem_statement, framing, research_brief_md, lexicon_md, open_questions_md, status, created_at, updated_at';

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

export async function findSubjectById(userId: string, subjectId: string) {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('subjects')
    .select(DETAIL_COLUMNS)
    .eq('user_id', userId)
    .eq('id', subjectId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load subject: ${error.message}`);
  return data;
}

export async function getSubjectById(userId: string, subjectId: string) {
  const subject = await findSubjectById(userId, subjectId);
  if (!subject) throw new Error('Subject not found');
  return subject;
}

export async function findSubjectBySlug(userId: string, slug: string) {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('subjects')
    .select(DETAIL_COLUMNS)
    .eq('user_id', userId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load subject: ${error.message}`);
  return data;
}

export async function getSubjectBySlug(userId: string, slug: string) {
  const subject = await findSubjectBySlug(userId, slug);
  if (!subject) throw new Error('Subject not found');
  return subject;
}

export async function createSubject(row: SubjectInsert): Promise<SubjectRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('subjects').insert(row).select(DETAIL_COLUMNS).single();

  if (error) throw new Error(`Failed to create subject: ${error.message}`);
  return data;
}

export async function updateSubject(subjectId: string, patch: SubjectUpdate): Promise<SubjectRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('subjects')
    .update(patch)
    .eq('id', subjectId)
    .select(DETAIL_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update subject: ${error.message}`);
  return data;
}
