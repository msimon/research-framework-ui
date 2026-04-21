import { redirect } from 'next/navigation';
import { findCurrentUser } from '@/server/lib/utils/currentUser';
import { AuthRequiredView } from '@/ui/views/auth/auth-required.view';

export default async function LandingPage() {
  const user = await findCurrentUser();
  if (user) redirect('/subjects');
  return <AuthRequiredView />;
}
