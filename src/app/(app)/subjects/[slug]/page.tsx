import Link from 'next/link';

import { getSubject } from '@/server/domain/subjects/subjects.command';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import { Markdown } from '@/ui/components/markdown';
import { Button } from '@/ui/components/ui/button';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SubjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const userId = await getCurrentUserId();
  const subject = await getSubject(userId, slug);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">{subject.title}</h2>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{subject.slug}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/subjects">All subjects</Link>
        </Button>
      </header>

      {subject.research_brief_md ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Research brief</h3>
          <div className="rounded-md border bg-muted/20 p-4">
            <Markdown>{subject.research_brief_md}</Markdown>
          </div>
        </section>
      ) : null}

      {subject.open_questions_md ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Open questions</h3>
          <div className="rounded-md border bg-muted/20 p-4">
            <Markdown>{subject.open_questions_md}</Markdown>
          </div>
        </section>
      ) : null}

      {subject.lexicon_md ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Lexicon</h3>
          <div className="rounded-md border bg-muted/20 p-4">
            <Markdown>{subject.lexicon_md}</Markdown>
          </div>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Landscape and deep research coming in the next milestones.
      </p>
    </div>
  );
}
