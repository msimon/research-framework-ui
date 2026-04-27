'use client';

import { useState } from 'react';
import { supabaseClient } from '@/shared/lib/supabase/client';
import { Button } from '@/ui/components/ui/button';

export function AuthRequiredView() {
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/subjects`;
      const { data, error: signInError } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (signInError) setError(signInError.message);
      else if (!data?.url) setError('No redirect URL returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Research Framework</h1>
      <p className="text-sm text-muted-foreground">Sign in to start a new research subject.</p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Button onClick={handleSignIn}>Continue with Google</Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </main>
  );
}
