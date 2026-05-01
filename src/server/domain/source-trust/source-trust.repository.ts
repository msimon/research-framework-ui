import 'server-only';

import { supabaseAdmin, supabaseUser } from '@/shared/lib/supabase/server';
import type { Database } from '@/shared/lib/supabase/supabase.types';

export type SourceTrustRow = Database['public']['Tables']['source_trust']['Row'];
type SourceTrustInsert = Database['public']['Tables']['source_trust']['Insert'];

const SOURCE_TRUST_COLUMNS =
  'url, domain, category, trust_score, rationale, classified_by_model, classified_at, created_at, updated_at';

// PostgREST encodes `.in('url', [...])` into the query string, so a long
// list of long URLs blows past the proxy's URI limit (~6KB). Chunked
// requests stay under the limit and run in parallel.
const URL_BATCH_SIZE = 30;

export async function findSourceTrustByUrls(urls: ReadonlyArray<string>): Promise<SourceTrustRow[]> {
  if (urls.length === 0) return [];
  const supabase = await supabaseUser();

  const unique = Array.from(new Set(urls));
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += URL_BATCH_SIZE) {
    batches.push(unique.slice(i, i + URL_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase
        .from('source_trust')
        .select(SOURCE_TRUST_COLUMNS)
        .in('url', batch);
      if (error) throw new Error(`Failed to load source trust rows: ${error.message}`);
      return data ?? [];
    }),
  );
  return results.flat();
}

export async function upsertSourceTrustRows(rows: ReadonlyArray<SourceTrustInsert>): Promise<void> {
  if (rows.length === 0) return;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('source_trust').upsert([...rows], { onConflict: 'url' });
  if (error) throw new Error(`Failed to upsert source trust rows: ${error.message}`);
}
