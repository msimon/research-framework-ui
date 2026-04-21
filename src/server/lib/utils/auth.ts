import type { UserRole } from '@/server/domain/auth/auth.types';
import { supabaseUser } from '@/shared/lib/supabase/server';

async function getUserOrThrow() {
  const supabase = await supabaseUser();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Not authenticated');
  }

  return user;
}

export async function requireAuth(allowedRoles?: UserRole | UserRole[]): Promise<string> {
  const user = await getUserOrThrow();
  const userRole = (user.app_metadata?.role as UserRole | undefined) ?? 'user';

  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(userRole)) {
      throw new Error('Not authorized');
    }
  }

  return user.id;
}

export function withAuth<TArgs extends unknown[], TReturn>(
  actionOrRoles: ((userId: string, ...args: TArgs) => Promise<TReturn>) | UserRole | UserRole[],
  action?: (userId: string, ...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  if (typeof actionOrRoles === 'function') {
    return async (...args: TArgs): Promise<TReturn> => {
      const userId = await requireAuth();
      return actionOrRoles(userId, ...args);
    };
  }

  if (!action) {
    throw new Error('Action is required when roles are provided');
  }

  return async (...args: TArgs): Promise<TReturn> => {
    const userId = await requireAuth(actionOrRoles);
    return action(userId, ...args);
  };
}
