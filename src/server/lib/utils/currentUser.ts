import type { Session, User } from '@supabase/supabase-js';
import { cache } from 'react';
import { supabaseUser } from '@/shared/lib/supabase/server';

type CurrentAuth = { user: User; session: Session | null };

export const findCurrentAuth = cache(async (): Promise<CurrentAuth | null> => {
  const supabase = await supabaseUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { user, session };
});

export async function findCurrentUser(): Promise<User | null> {
  const auth = await findCurrentAuth();
  return auth?.user ?? null;
}

export async function getCurrentUser(): Promise<User> {
  const user = await findCurrentUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user;
}

export async function findCurrentUserId(): Promise<string | null> {
  const user = await findCurrentUser();
  return user?.id ?? null;
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}

export async function getCurrentUserEmail(): Promise<string> {
  const user = await getCurrentUser();
  return user.email ?? '';
}
