import Link from 'next/link';

import { Button } from '@/ui/components/ui/button';

type SubjectSummary = {
  id: string;
  slug: string;
  title: string;
  status: string;
  seed_problem_statement: string | null;
  updated_at: string;
};

export function SubjectsListView({ subjects }: { subjects: SubjectSummary[] }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your subjects</h2>
          <p className="text-sm text-muted-foreground">
            Research subjects you&apos;ve framed. Pick one to continue or start a new one.
          </p>
        </div>
        <Button asChild>
          <Link href="/subjects/new">New subject</Link>
        </Button>
      </header>

      {subjects.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No subjects yet. Start with a problem statement.
        </div>
      ) : (
        <ul className="grid gap-3">
          {subjects.map((subject) => (
            <li key={subject.id}>
              <Link
                href={
                  subject.status === 'interviewing'
                    ? `/subjects/new?id=${subject.id}`
                    : `/subjects/${subject.slug}`
                }
                className="flex flex-col gap-1 rounded-md border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{subject.title}</span>
                  <StatusBadge status={subject.status} />
                </div>
                {subject.seed_problem_statement ? (
                  <span className="text-sm text-muted-foreground">{subject.seed_problem_statement}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(subject.updated_at).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === 'interviewing'
      ? 'Interviewing'
      : status === 'ready'
        ? 'Ready'
        : status === 'failed'
          ? 'Failed'
          : status;
  const className =
    status === 'ready'
      ? 'bg-primary/10 text-primary'
      : status === 'failed'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
