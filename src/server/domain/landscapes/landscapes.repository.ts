import type { CitationEntry } from '@/shared/citation.type';
import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database, Json } from '@/shared/lib/supabase/supabase.types';
import type { SupportingSource } from '@/shared/supporting-source.type';

type LandscapeRow = Database['public']['Tables']['landscapes']['Row'];
type LandscapeInsert = Database['public']['Tables']['landscapes']['Insert'];
type LandscapeUpdate = Database['public']['Tables']['landscapes']['Update'];

// Domain Landscape type — overrides the auto-generated `citation_map: Json` and
// `supporting_sources: Json` with their known shapes so call sites get typed
// arrays without per-call casts. Both columns are written from server-built
// arrays (see `landscapes.command.ts`), so the cast at the repo boundary is
// sound. Null is normalized to an empty array.
export type Landscape = Omit<LandscapeRow, 'citation_map' | 'supporting_sources'> & {
  citation_map: CitationEntry[];
  supporting_sources: SupportingSource[];
};
export type LandscapePatch = Omit<LandscapeUpdate, 'citation_map' | 'supporting_sources'> & {
  citation_map?: CitationEntry[];
  supporting_sources?: SupportingSource[];
};

const LANDSCAPE_COLUMNS =
  'id, topic_id, content_md, citation_map, supporting_sources, status, workflow_instance_id, error_message, created_at, updated_at';

function fromRow(row: LandscapeRow): Landscape {
  return {
    ...row,
    citation_map: (row.citation_map as CitationEntry[] | null) ?? [],
    supporting_sources: (row.supporting_sources as SupportingSource[] | null) ?? [],
  };
}

function toUpdate(patch: LandscapePatch): LandscapeUpdate {
  const { citation_map, supporting_sources, ...rest } = patch;
  const out: LandscapeUpdate = { ...rest };
  if (citation_map !== undefined) out.citation_map = citation_map as unknown as Json;
  if (supporting_sources !== undefined) out.supporting_sources = supporting_sources as unknown as Json;
  return out;
}

export async function findLandscapeByTopic(topicId: string): Promise<Landscape | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('landscapes')
    .select(LANDSCAPE_COLUMNS)
    .eq('topic_id', topicId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load landscape: ${error.message}`);
  return data ? fromRow(data) : null;
}

export async function createLandscape(row: LandscapeInsert): Promise<Landscape> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('landscapes').insert(row).select(LANDSCAPE_COLUMNS).single();

  if (error) throw new Error(`Failed to create landscape: ${error.message}`);
  return fromRow(data);
}

export async function updateLandscape(landscapeId: string, patch: LandscapePatch): Promise<Landscape> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('landscapes')
    .update(toUpdate(patch))
    .eq('id', landscapeId)
    .select(LANDSCAPE_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update landscape: ${error.message}`);
  return fromRow(data);
}
