import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type TopicRow = Database['public']['Tables']['topics']['Row'];
type TopicInsert = Database['public']['Tables']['topics']['Insert'];
type TopicUpdate = Database['public']['Tables']['topics']['Update'];

const COLUMNS =
  'id, subject_id, parent_topic_id, slug, title, pitch, rationale, category, status, sort_order, discover_hint, created_at, updated_at';

export async function findTopicsBySubject(subjectId: string): Promise<TopicRow[]> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('topics')
    .select(COLUMNS)
    .eq('subject_id', subjectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to load topics: ${error.message}`);
  return data ?? [];
}

export async function findTopicById(topicId: string): Promise<TopicRow | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('topics').select(COLUMNS).eq('id', topicId).maybeSingle();

  if (error) throw new Error(`Failed to load topic: ${error.message}`);
  return data;
}

export async function getTopicById(topicId: string): Promise<TopicRow> {
  const topic = await findTopicById(topicId);
  if (!topic) throw new Error('Topic not found');
  return topic;
}

export async function findTopicBySlug(subjectId: string, slug: string): Promise<TopicRow | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('topics')
    .select(COLUMNS)
    .eq('subject_id', subjectId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load topic: ${error.message}`);
  return data;
}

export async function createTopic(row: TopicInsert): Promise<TopicRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('topics').insert(row).select(COLUMNS).single();

  if (error) throw new Error(`Failed to create topic: ${error.message}`);
  return data;
}

export async function updateTopic(topicId: string, patch: TopicUpdate): Promise<TopicRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('topics')
    .update(patch)
    .eq('id', topicId)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update topic: ${error.message}`);
  return data;
}
