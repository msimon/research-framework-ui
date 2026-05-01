import { notFound } from 'next/navigation';

import { listSessionsForTopic } from '@/server/domain/deep-research/deep-research.repository';
import { getOrCreateLandscape } from '@/server/domain/landscapes/landscapes.command';
import { findSourceTrustByUrls } from '@/server/domain/source-trust/source-trust.repository';
import { getSubject } from '@/server/domain/subjects/subjects.command';
import { findTopicBySlug } from '@/server/domain/topics/topics.repository';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import type { SourceTrustMap } from '@/ui/types/source-trust.type';
import { TopicView } from '@/ui/views/topics/topic.view';
import type { LandscapeState } from '@/ui/views/topics/types/landscape-state.type';

type PageProps = {
  params: Promise<{ slug: string; topicSlug: string }>;
};

export default async function TopicLandscapePage({ params }: PageProps) {
  const { slug, topicSlug } = await params;

  const userId = await getCurrentUserId();
  const subject = await getSubject(userId, slug);
  const topic = await findTopicBySlug(subject.id, topicSlug);
  if (!topic) notFound();

  // Pre-create the landscape row so the page mounts with a known
  // landscape id and the realtime hook can subscribe to
  // `landscape:<id>` before the user clicks "Run landscape". Without
  // this, broadcasts emitted during the awaited `runLandscape` call
  // arrive before the client knows the id and are dropped (Realtime
  // is ephemeral — see the agent runtime section in DEVELOPMENT.md).
  const landscapeRow = await getOrCreateLandscape(topic.id);
  const sessions = await listSessionsForTopic(topic.id);

  const landscape: LandscapeState = {
    id: landscapeRow.id,
    content_md: landscapeRow.content_md,
    citation_map: landscapeRow.citation_map,
    supporting_sources: landscapeRow.supporting_sources,
    status: landscapeRow.status,
    error_message: landscapeRow.error_message,
    updated_at: landscapeRow.updated_at,
  };

  const trustUrls = Array.from(
    new Set([...landscape.citation_map.map((c) => c.url), ...landscape.supporting_sources.map((s) => s.url)]),
  );
  const trustRows = await findSourceTrustByUrls(trustUrls);
  const initialTrustMap: SourceTrustMap = Object.fromEntries(
    trustRows.map((row) => [
      row.url,
      {
        url: row.url,
        domain: row.domain,
        category: row.category,
        trust_score: row.trust_score,
        rationale: row.rationale,
      },
    ]),
  );

  return (
    <TopicView
      subject={subject}
      topic={topic}
      landscape={landscape}
      sessions={sessions}
      initialTrustMap={initialTrustMap}
    />
  );
}
