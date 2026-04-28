import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type LandscapeRow = Database['public']['Tables']['landscapes']['Row'];
type LandscapeInsert = Database['public']['Tables']['landscapes']['Insert'];
type LandscapeUpdate = Database['public']['Tables']['landscapes']['Update'];
type SourceRow = Database['public']['Tables']['sources']['Row'];
type SourceInsert = Database['public']['Tables']['sources']['Insert'];

const LANDSCAPE_COLUMNS =
  'id, topic_id, content_md, citation_map, status, workflow_instance_id, error_message, created_at, updated_at';
const SOURCE_COLUMNS =
  'id, topic_id, landscape_id, turn_id, session_id, url, title, retrieved_at, created_at, updated_at';

export async function findLandscapeByTopic(topicId: string): Promise<LandscapeRow | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('landscapes')
    .select(LANDSCAPE_COLUMNS)
    .eq('topic_id', topicId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load landscape: ${error.message}`);
  return data;
}

export async function createLandscape(row: LandscapeInsert): Promise<LandscapeRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('landscapes').insert(row).select(LANDSCAPE_COLUMNS).single();

  if (error) throw new Error(`Failed to create landscape: ${error.message}`);
  return data;
}

export async function updateLandscape(landscapeId: string, patch: LandscapeUpdate): Promise<LandscapeRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('landscapes')
    .update(patch)
    .eq('id', landscapeId)
    .select(LANDSCAPE_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update landscape: ${error.message}`);
  return data;
}

export async function findSourcesByTopic(topicId: string): Promise<SourceRow[]> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('sources')
    .select(SOURCE_COLUMNS)
    .eq('topic_id', topicId)
    .order('retrieved_at', { ascending: true });

  if (error) throw new Error(`Failed to load sources: ${error.message}`);
  return data ?? [];
}

export async function insertSources(rows: SourceInsert[]): Promise<SourceRow[]> {
  if (rows.length === 0) return [];
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('sources').insert(rows).select(SOURCE_COLUMNS);

  if (error) throw new Error(`Failed to insert sources: ${error.message}`);
  return data ?? [];
}
