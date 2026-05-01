'use client';

export function AuthCodeErrorView() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Auth error</p>
      <h1 className="text-3xl font-semibold">We could not complete sign-in.</h1>
      <p className="text-sm text-muted-foreground">
        The OAuth callback code was missing or invalid. Try signing in again.
      </p>
      <a
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
      >
        Back to home
      </a>
    </main>
  );
}
