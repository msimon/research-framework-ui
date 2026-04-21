import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { findCurrentUser } from '@/server/lib/utils/currentUser';

export default async function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await findCurrentUser();

  if (!user) {
    redirect('/');
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Research Framework</h1>
        <a href="/auth/signout" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Sign out
        </a>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
