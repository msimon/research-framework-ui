export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold">This page doesn&apos;t exist.</h1>
      <p className="max-w-md text-muted-foreground">Check the URL or head back to the home page.</p>
      <a
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
      >
        Back to home
      </a>
    </main>
  );
}
