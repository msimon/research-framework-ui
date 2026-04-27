import Link from 'next/link';

import { getSubject } from '@/server/domain/subjects/subjects.command';
import { listTopicsForSubject } from '@/server/domain/topics/topics.command';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import { Markdown } from '@/ui/components/markdown';
import { SectionNav } from '@/ui/components/section-nav';
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

  const sections = [
    { id: 'topics', label: 'Topics' },
    ...(subject.research_brief_md ? [{ id: 'research-brief', label: 'Research brief' }] : []),
    ...(subject.open_questions_md ? [{ id: 'open-questions', label: 'Open questions' }] : []),
    ...(subject.lexicon_md ? [{ id: 'lexicon', label: 'Lexicon' }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/subjects" className="text-xs text-muted-foreground hover:underline">
          ← All subjects
        </Link>
        <h2 className="text-xl font-semibold">{subject.title}</h2>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{subject.slug}</p>
      </header>

      <SectionNav sections={sections} />

      <div id="topics" className="scroll-mt-16">
        <TopicsSection subjectId={subject.id} subjectSlug={subject.slug} initialTopics={initialTopics} />
      </div>

      {subject.research_brief_md ? (
        <section id="research-brief" className="flex scroll-mt-16 flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Research brief</h3>
          <div className="rounded-md border bg-muted/20 p-4">
            <Markdown>{subject.research_brief_md}</Markdown>
          </div>
        </section>
      ) : null}

      {subject.open_questions_md ? (
        <section id="open-questions" className="flex scroll-mt-16 flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Open questions</h3>
          <div className="rounded-md border bg-muted/20 p-4">
            <Markdown>{subject.open_questions_md}</Markdown>
          </div>
        </section>
      ) : null}

      {subject.lexicon_md ? (
        <section id="lexicon" className="flex scroll-mt-16 flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Lexicon</h3>
          <div className="rounded-md border bg-muted/20 p-4">
            <Markdown>{subject.lexicon_md}</Markdown>
          </div>
        </section>
      ) : null}
    </div>
  );
}
