import type { User } from '@supabase/supabase-js';
import { cache } from 'react';
import { supabaseUser } from '@/shared/lib/supabase/server';

export const findCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await supabaseUser();
  const { data } = await supabase.auth.getUser();

  return data.user ?? null;
});

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
