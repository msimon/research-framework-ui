import { supabaseUser } from '@/shared/lib/supabase/server';

export async function findUser(userId: string) {
  const supabase = await supabaseUser();
  const { data, error } = await supabase.from('users').select('name, email').eq('id', userId).maybeSingle();

  if (error) {
    throw new Error(`Failed to load user: ${error.message}`);
  }

  return data ?? null;
}

export async function getUser(userId: string) {
  const user = await findUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

export async function saveUserFullName(userId: string, fullName: string): Promise<void> {
  const supabase = await supabaseUser();
  const { error } = await supabase.from('users').update({ name: fullName }).eq('id', userId);

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }
}
