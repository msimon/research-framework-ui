'use client';

import Link from 'next/link';

import type { Subject } from '@/server/domain/subjects/subjects.repository';
import type { Database } from '@/shared/lib/supabase/supabase.types';
import { LexiconView } from '@/ui/components/lexicon-view.component';
import { Markdown } from '@/ui/components/markdown';
import { SectionNav } from '@/ui/components/section-nav';
import { TopicsSection } from '@/ui/views/subjects/topics-section.view';

type TopicRow = Database['public']['Tables']['topics']['Row'];

type Props = {
  subject: Subject;
  topics: TopicRow[];
};

export function SubjectDetailView({ subject, topics }: Props) {
  const sections = [
    { id: 'topics', label: 'Topics' },
    ...(subject.research_brief_md ? [{ id: 'research-brief', label: 'Research brief' }] : []),
    ...(subject.open_questions_md ? [{ id: 'open-questions', label: 'Open questions' }] : []),
    ...(subject.lexicon.length > 0 ? [{ id: 'lexicon', label: 'Lexicon' }] : []),
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
        <TopicsSection subjectId={subject.id} subjectSlug={subject.slug} initialTopics={topics} />
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

      {subject.lexicon.length > 0 ? (
        <section id="lexicon" className="flex scroll-mt-16 flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Lexicon</h3>
          <div className="rounded-md border bg-muted/20 p-4">
            <LexiconView entries={subject.lexicon} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
