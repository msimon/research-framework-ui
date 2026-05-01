import type { CitationEntry } from '@/shared/citation.type';
import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database, Json } from '@/shared/lib/supabase/supabase.types';
import type { SupportingSource } from '@/shared/supporting-source.type';

type SessionRow = Database['public']['Tables']['deep_research_sessions']['Row'];
type SessionInsert = Database['public']['Tables']['deep_research_sessions']['Insert'];
type SessionUpdate = Database['public']['Tables']['deep_research_sessions']['Update'];
type TurnRow = Database['public']['Tables']['deep_research_turns']['Row'];
type TurnInsert = Database['public']['Tables']['deep_research_turns']['Insert'];
type TurnUpdate = Database['public']['Tables']['deep_research_turns']['Update'];

// Domain Turn type — overrides the auto-generated `citation_map: Json` and
// `supporting_sources: Json` with their known shapes so call sites get typed
// arrays without per-call casts. Both columns are written from server-built
// arrays (see `deep-research.command.ts`), so the cast at the repo boundary is
// sound. Null is normalized to an empty array. `tool_calls` and `insights`
// stay as raw `Json` because they are produced and consumed via Zod schemas
// inside the command, not read directly by call sites.
export type Turn = Omit<TurnRow, 'citation_map' | 'supporting_sources'> & {
  citation_map: CitationEntry[];
  supporting_sources: SupportingSource[];
};
export type TurnPatch = Omit<TurnUpdate, 'citation_map' | 'supporting_sources'> & {
  citation_map?: CitationEntry[];
  supporting_sources?: SupportingSource[];
};

const SESSION_COLUMNS =
  'id, topic_id, seed_question, status, summary_md, turn_count, last_turn_at, closed_at, created_at, updated_at';
const TURN_COLUMNS =
  'id, session_id, turn_number, role, user_text, findings_md, my_read_md, followup_question, reasoning_md, tool_calls, insights, citation_map, supporting_sources, model_used, workflow_instance_id, status, error_message, created_at, updated_at';

function turnFromRow(row: TurnRow): Turn {
  return {
    ...row,
    citation_map: (row.citation_map as CitationEntry[] | null) ?? [],
    supporting_sources: (row.supporting_sources as SupportingSource[] | null) ?? [],
  };
}

function turnToUpdate(patch: TurnPatch): TurnUpdate {
  const { citation_map, supporting_sources, ...rest } = patch;
  const out: TurnUpdate = { ...rest };
  if (citation_map !== undefined) out.citation_map = citation_map as unknown as Json;
  if (supporting_sources !== undefined) out.supporting_sources = supporting_sources as unknown as Json;
  return out;
}

export async function findSessionById(sessionId: string): Promise<SessionRow | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load deep-research session: ${error.message}`);
  return data;
}

export async function getSessionById(sessionId: string): Promise<SessionRow> {
  const session = await findSessionById(sessionId);
  if (!session) throw new Error('Deep-research session not found');
  return session;
}

export async function listSessionsForTopic(topicId: string): Promise<SessionRow[]> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_sessions')
    .select(SESSION_COLUMNS)
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list deep-research sessions: ${error.message}`);
  return data ?? [];
}

export async function findTurnById(turnId: string): Promise<Turn | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_turns')
    .select(TURN_COLUMNS)
    .eq('id', turnId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load deep-research turn: ${error.message}`);
  return data ? turnFromRow(data) : null;
}

export async function getTurnById(turnId: string): Promise<Turn> {
  const turn = await findTurnById(turnId);
  if (!turn) throw new Error('Deep-research turn not found');
  return turn;
}

export async function listTurnsForSession(sessionId: string): Promise<Turn[]> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_turns')
    .select(TURN_COLUMNS)
    .eq('session_id', sessionId)
    .order('turn_number', { ascending: true });

  if (error) throw new Error(`Failed to list deep-research turns: ${error.message}`);
  return (data ?? []).map(turnFromRow);
}

export async function createSession(row: SessionInsert): Promise<SessionRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_sessions')
    .insert(row)
    .select(SESSION_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to create deep-research session: ${error.message}`);
  return data;
}

export async function createTurn(row: TurnInsert): Promise<Turn> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_turns')
    .insert(row)
    .select(TURN_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to create deep-research turn: ${error.message}`);
  return turnFromRow(data);
}

export async function updateSession(sessionId: string, patch: SessionUpdate): Promise<SessionRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select(SESSION_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update deep-research session: ${error.message}`);
  return data;
}

export async function updateTurn(turnId: string, patch: TurnPatch): Promise<Turn> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_turns')
    .update(turnToUpdate(patch))
    .eq('id', turnId)
    .select(TURN_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update deep-research turn: ${error.message}`);
  return turnFromRow(data);
}
