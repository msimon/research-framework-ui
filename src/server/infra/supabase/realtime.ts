import 'server-only';
import { createClient } from '@supabase/supabase-js';

import { serverConfig } from '@/shared/config/server.config';

/**
 * Supabase client specifically for server-side Realtime broadcasts.
 * Uses the secret key so writes to broadcast channels succeed regardless of RLS.
 * Keep one per request — each call opens a websocket.
 */
export function supabaseBroadcastClient() {
  return createClient(serverConfig.supabase.url, serverConfig.supabase.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
}

export type EntityChannelName =
  | `interview:${string}`
  | `subject:${string}`
  | `landscape:${string}`
  | `session:${string}`;
