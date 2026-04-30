import 'server-only';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function waitForBroadcastSubscription(channel: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        reject(new Error(`Broadcast channel ${status}`));
      }
    });
  });
}
