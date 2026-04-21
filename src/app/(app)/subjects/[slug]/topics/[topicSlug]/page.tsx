import Link from 'next/link';
import { notFound } from 'next/navigation';

import { findLandscapeByTopic, findSourcesByTopic } from '@/server/domain/landscapes/landscapes.repository';
import { getSubject } from '@/server/domain/subjects/subjects.command';
import { findTopicBySlug } from '@/server/domain/topics/topics.repository';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import { Button } from '@/ui/components/ui/button';
import { LandscapeView } from '@/ui/views/topics/landscape.view';

type PageProps = {
  params: Promise<{ slug: string; topicSlug: string }>;
};

export default async function TopicLandscapePage({ params }: PageProps) {
  const { slug, topicSlug } = await params;
  const userId = await getCurrentUserId();
  const subject = await getSubject(userId, slug);
  const topic = await findTopicBySlug(subject.id, topicSlug);
  if (!topic) notFound();

  const landscape = await findLandscapeByTopic(topic.id);
  const sources = landscape ? await findSourcesByTopic(topic.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href={`/subjects/${subject.slug}`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {subject.title}
          </Link>
          <h2 className="text-xl font-semibold">{topic.title}</h2>
          <p className="text-sm text-muted-foreground">{topic.pitch}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 whitespace-nowrap">
          <Link href={`/subjects/${subject.slug}`}>Back to subject</Link>
        </Button>
      </header>

      <LandscapeView
        subjectSlug={subject.slug}
        topicSlug={topic.slug}
        topicId={topic.id}
        initialLandscape={
          landscape
            ? {
                id: landscape.id,
                content_md: landscape.content_md,
                status: landscape.status,
                error_message: landscape.error_message,
                updated_at: landscape.updated_at,
              }
            : null
        }
        initialSources={sources.map((s) => ({
          id: s.id,
          url: s.url,
          title: s.title,
          snippet: s.snippet,
        }))}
      />
    </div>
  );
}
