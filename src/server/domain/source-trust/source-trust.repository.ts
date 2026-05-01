import 'server-only';

import { supabaseAdmin, supabaseUser } from '@/shared/lib/supabase/server';
import type { Database } from '@/shared/lib/supabase/supabase.types';

export type SourceTrustRow = Database['public']['Tables']['source_trust']['Row'];
type SourceTrustInsert = Database['public']['Tables']['source_trust']['Insert'];

const SOURCE_TRUST_COLUMNS =
  'url, domain, category, trust_score, rationale, classified_by_model, classified_at, created_at, updated_at';

export async function findSourceTrustByUrls(urls: ReadonlyArray<string>): Promise<SourceTrustRow[]> {
  if (urls.length === 0) return [];
  const supabase = await supabaseUser();
  const { data, error } = await supabase
    .from('source_trust')
    .select(SOURCE_TRUST_COLUMNS)
    .in('url', [...urls]);

  if (error) throw new Error(`Failed to load source trust rows: ${error.message}`);
  return data ?? [];
}

export async function upsertSourceTrustRows(rows: ReadonlyArray<SourceTrustInsert>): Promise<void> {
  if (rows.length === 0) return;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('source_trust').upsert([...rows], { onConflict: 'url' });
  if (error) throw new Error(`Failed to upsert source trust rows: ${error.message}`);
}
