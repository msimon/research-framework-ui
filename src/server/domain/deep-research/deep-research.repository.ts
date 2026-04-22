import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type SessionRow = Database['public']['Tables']['deep_research_sessions']['Row'];
type SessionInsert = Database['public']['Tables']['deep_research_sessions']['Insert'];
type SessionUpdate = Database['public']['Tables']['deep_research_sessions']['Update'];
type TurnRow = Database['public']['Tables']['deep_research_turns']['Row'];
type TurnInsert = Database['public']['Tables']['deep_research_turns']['Insert'];
type TurnUpdate = Database['public']['Tables']['deep_research_turns']['Update'];
type SourceRow = Database['public']['Tables']['sources']['Row'];
type SourceInsert = Database['public']['Tables']['sources']['Insert'];

const SESSION_COLUMNS =
  'id, topic_id, seed_question, status, summary_md, turn_count, last_turn_at, closed_at, created_at, updated_at';
const TURN_COLUMNS =
  'id, session_id, turn_number, role, user_text, findings_md, my_read_md, followup_question, reasoning_md, tool_calls, insights, model_used, workflow_instance_id, status, error_message, created_at, updated_at';
const SOURCE_COLUMNS =
  'id, topic_id, landscape_id, turn_id, url, title, snippet, retrieved_at, created_at, updated_at';

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

export async function findTurnById(turnId: string): Promise<TurnRow | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_turns')
    .select(TURN_COLUMNS)
    .eq('id', turnId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load deep-research turn: ${error.message}`);
  return data;
}

export async function getTurnById(turnId: string): Promise<TurnRow> {
  const turn = await findTurnById(turnId);
  if (!turn) throw new Error('Deep-research turn not found');
  return turn;
}

export async function listTurnsForSession(sessionId: string): Promise<TurnRow[]> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_turns')
    .select(TURN_COLUMNS)
    .eq('session_id', sessionId)
    .order('turn_number', { ascending: true });

  if (error) throw new Error(`Failed to list deep-research turns: ${error.message}`);
  return data ?? [];
}

export async function listSourcesForSession(sessionId: string): Promise<SourceRow[]> {
  const supabase = await supabaseUser();
  const { data: turns, error: turnsError } = await supabase
    .from('deep_research_turns')
    .select('id')
    .eq('session_id', sessionId);
  if (turnsError) throw new Error(`Failed to load turn ids: ${turnsError.message}`);

  const turnIds = (turns ?? []).map((t) => t.id);
  if (turnIds.length === 0) return [];

  const { data, error } = await supabase
    .from('sources')
    .select(SOURCE_COLUMNS)
    .in('turn_id', turnIds)
    .order('retrieved_at', { ascending: true });

  if (error) throw new Error(`Failed to load session sources: ${error.message}`);
  return data ?? [];
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

export async function createTurn(row: TurnInsert): Promise<TurnRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_turns')
    .insert(row)
    .select(TURN_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to create deep-research turn: ${error.message}`);
  return data;
}

export async function insertTurnSources(rows: SourceInsert[]): Promise<SourceRow[]> {
  if (rows.length === 0) return [];
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('sources').insert(rows).select(SOURCE_COLUMNS);

  if (error) throw new Error(`Failed to insert turn sources: ${error.message}`);
  return data ?? [];
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

export async function updateTurn(turnId: string, patch: TurnUpdate): Promise<TurnRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('deep_research_turns')
    .update(patch)
    .eq('id', turnId)
    .select(TURN_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to update deep-research turn: ${error.message}`);
  return data;
}
