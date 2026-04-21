'use client';

import { useState } from 'react';
import { supabaseClient } from '@/shared/lib/supabase/client';
import { Button } from '@/ui/components/ui/button';

export function AuthRequiredView() {
  const [status, setStatus] = useState<string | null>(null);

  const handleSignIn = async () => {
    setStatus('Redirecting...');

    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/subjects`,
      },
    });
  };

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Research Framework</h1>
      <p className="text-sm text-muted-foreground">Sign in to start a new research subject.</p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Button onClick={handleSignIn}>Continue with Google</Button>
      </div>
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </main>
  );
}
