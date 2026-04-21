import Link from 'next/link';

import { getSubject } from '@/server/domain/subjects/subjects.command';
import { listTopicsForSubject } from '@/server/domain/topics/topics.command';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import { Markdown } from '@/ui/components/markdown';
import { Button } from '@/ui/components/ui/button';
import { TopicsSection } from '@/ui/views/subjects/topics-section.view';

type Props = {
  slug: string;
};

export async function SubjectDetailView({ slug }: Props) {
  const userId = await getCurrentUserId();
  const subject = await getSubject(userId, slug);
  const topics = await listTopicsForSubject(subject.id);

  const initialTopics = topics.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    pitch: t.pitch,
    rationale: t.rationale,
    category: t.category,
    status: t.status,
    sort_order: t.sort_order,
    discover_hint: t.discover_hint,
    created_at: t.created_at,
  }));

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

      <TopicsSection subjectId={subject.id} subjectSlug={subject.slug} initialTopics={initialTopics} />

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
    </div>
  );
}
