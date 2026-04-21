'use client';

import '@/app/globals.css';
import { geistMono, geistSans } from '@/app/fonts';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground`}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Something went wrong
          </p>
          <h1 className="text-3xl font-semibold">We couldn&apos;t load this page.</h1>
          {error?.message ? <p className="text-sm text-muted-foreground">{error.message}</p> : null}
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
