import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { serverConfig } from '@/shared/config/server.config';
import type { Database } from '@/shared/lib/supabase/supabase.types';

const supabaseUrl = serverConfig.supabase.url;
const supabaseKey = serverConfig.supabase.publishableKey;
const supabaseSecretKey = serverConfig.supabase.secretKey;

export async function supabaseUser() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // setAll is called from a Server Component when Supabase refreshes the auth token.
          // This can be safely ignored — the token will be refreshed on the next
          // Server Action or Route Handler call.
        }
      },
    },
  });
}

/**
 * Admin client that bypasses RLS (Row Level Security).
 * Use only for backend operations that need full database access.
 * NEVER expose this client or its results directly to the frontend.
 */
export function supabaseAdmin() {
  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
