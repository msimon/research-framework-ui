import Link from 'next/link';
import { notFound } from 'next/navigation';

import { listSessionsForTopic } from '@/server/domain/deep-research/deep-research.repository';
import { findLandscapeByTopic } from '@/server/domain/landscapes/landscapes.repository';
import { getSubject } from '@/server/domain/subjects/subjects.command';
import { findTopicBySlug } from '@/server/domain/topics/topics.repository';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import type { CitationEntry } from '@/shared/citation.type';
import { SectionNav } from '@/ui/components/section-nav';
import { DeepResearchSection } from '@/ui/views/topics/components/deep-research-section.component';
import { LandscapeComponent } from '@/ui/views/topics/components/landscape.component';

type Props = {
  slug: string;
  topicSlug: string;
};

export async function TopicView({ slug, topicSlug }: Props) {
  const userId = await getCurrentUserId();
  const subject = await getSubject(userId, slug);
  const topic = await findTopicBySlug(subject.id, topicSlug);
  if (!topic) notFound();

  const landscape = await findLandscapeByTopic(topic.id);
  const sessions = await listSessionsForTopic(topic.id);

  const sections = [
    { id: 'landscape', label: 'Landscape' },
    ...(landscape?.status === 'complete' ? [{ id: 'deep-research', label: 'Deep research' }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href={`/subjects/${subject.slug}`} className="text-xs text-muted-foreground hover:underline">
          ← {subject.title}
        </Link>
        <h2 className="text-xl font-semibold">{topic.title}</h2>
        <p className="text-sm text-muted-foreground">{topic.pitch}</p>
      </header>

      <SectionNav sections={sections} />

      <div id="landscape" className="scroll-mt-16">
        <LandscapeComponent
          subjectSlug={subject.slug}
          topicSlug={topic.slug}
          topicId={topic.id}
          initialLandscape={
            landscape
              ? {
                  id: landscape.id,
                  content_md: landscape.content_md,
                  citation_map: (landscape.citation_map as CitationEntry[] | null) ?? [],
                  supporting_sources:
                    (landscape.supporting_sources as Array<{ url: string; title: string | null }> | null) ??
                    [],
                  status: landscape.status,
                  error_message: landscape.error_message,
                  updated_at: landscape.updated_at,
                }
              : null
          }
        />
      </div>

      {landscape?.status === 'complete' ? (
        <div id="deep-research" className="scroll-mt-16">
          <DeepResearchSection
            subjectSlug={subject.slug}
            topicSlug={topic.slug}
            sessions={sessions.map((s) => ({
              id: s.id,
              seed_question: s.seed_question,
              status: s.status,
              turn_count: s.turn_count,
              last_turn_at: s.last_turn_at,
              created_at: s.created_at,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}
