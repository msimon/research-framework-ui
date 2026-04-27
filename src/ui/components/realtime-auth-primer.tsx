'use client';

import { type ReactNode, useEffect, useRef } from 'react';

import { supabaseClient } from '@/shared/lib/supabase/client';

type Props = {
  initialAccessToken: string | null;
  children: ReactNode;
};

export function RealtimeAuthPrimer({ initialAccessToken, children }: Props) {
  const primed = useRef(false);

  if (!primed.current && initialAccessToken) {
    console.log('[rt:auth] priming realtime with access token');
    supabaseClient.realtime.setAuth(initialAccessToken);
    primed.current = true;
  }

  useEffect(() => {
    console.log('[rt:auth] primer mounted, initialAccessToken?', !!initialAccessToken);
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('[rt:auth] onAuthStateChange', event, 'hasToken?', !!session?.access_token);
      if (session?.access_token) {
        supabaseClient.realtime.setAuth(session.access_token);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [initialAccessToken]);

  return <>{children}</>;
}
