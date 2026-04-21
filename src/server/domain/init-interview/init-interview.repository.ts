import { supabaseUser } from '@/shared/lib/supabase/server';
import type { Database, Json } from '@/shared/lib/supabase/supabase.types';

type TurnRow = Database['public']['Tables']['init_interview_turns']['Row'];

const COLUMNS = 'id, subject_id, turn_number, agent_step, user_answer, created_at, updated_at';

export async function findInterviewTurns(subjectId: string): Promise<TurnRow[]> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('init_interview_turns')
    .select(COLUMNS)
    .eq('subject_id', subjectId)
    .order('turn_number', { ascending: true });

  if (error) throw new Error(`Failed to load interview turns: ${error.message}`);
  return data ?? [];
}

export async function findLatestInterviewTurn(subjectId: string): Promise<TurnRow | null> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('init_interview_turns')
    .select(COLUMNS)
    .eq('subject_id', subjectId)
    .order('turn_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load latest interview turn: ${error.message}`);
  return data;
}

export async function createInterviewTurn(input: {
  subjectId: string;
  turnNumber: number;
  agentStep: Json;
}): Promise<TurnRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('init_interview_turns')
    .insert({
      subject_id: input.subjectId,
      turn_number: input.turnNumber,
      agent_step: input.agentStep,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`Failed to create interview turn: ${error.message}`);
  return data;
}

export async function saveInterviewTurnAnswer(turnId: string, answer: Json): Promise<TurnRow> {
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('init_interview_turns')
    .update({ user_answer: answer })
    .eq('id', turnId)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`Failed to save interview answer: ${error.message}`);
  return data;
}
