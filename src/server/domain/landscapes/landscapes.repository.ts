import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type LandscapeRow = Database['public']['Tables']['landscapes']['Row'];
type LandscapeInsert = Database['public']['Tables']['landscapes']['Insert'];
type LandscapeUpdate = Database['public']['Tables']['landscapes']['Update'];

const LANDSCAPE_COLUMNS =
  'id, topic_id, content_md, citation_map, supporting_sources, status, workflow_instance_id, error_message, created_at, updated_at';

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
