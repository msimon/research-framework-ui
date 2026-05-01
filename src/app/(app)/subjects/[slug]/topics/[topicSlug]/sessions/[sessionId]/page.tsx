import { notFound } from 'next/navigation';

import { findSessionById, listTurnsForSession } from '@/server/domain/deep-research/deep-research.repository';
import { findSourceTrustByUrls } from '@/server/domain/source-trust/source-trust.repository';
import { getSubject } from '@/server/domain/subjects/subjects.command';
import { findTopicBySlug } from '@/server/domain/topics/topics.repository';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import type { SourceTrustMap } from '@/ui/types/source-trust.type';
import { DeepResearchSessionView } from '@/ui/views/deep-research/deep-research-session.view';
import type { DeepResearchTurnState } from '@/ui/views/deep-research/types/deep-research-turn-state.type';

type PageProps = {
  params: Promise<{ slug: string; topicSlug: string; sessionId: string }>;
};

export default async function DeepResearchSessionPage({ params }: PageProps) {
  const { slug, topicSlug, sessionId } = await params;

  const userId = await getCurrentUserId();
  const subject = await getSubject(userId, slug);
  const topic = await findTopicBySlug(subject.id, topicSlug);
  if (!topic) notFound();

  const session = await findSessionById(sessionId);
  if (!session || session.topic_id !== topic.id) notFound();

  const turns = await listTurnsForSession(sessionId);

  const turnEntries: DeepResearchTurnState[] = turns.map((t) => ({
    id: t.id,
    turn_number: t.turn_number,
    user_text: t.user_text,
    findings_md: t.findings_md,
    my_read_md: t.my_read_md,
    followup_question: t.followup_question,
    reasoning_md: t.reasoning_md,
    citation_map: t.citation_map,
    supporting_sources: t.supporting_sources,
    status: t.status,
    error_message: t.error_message,
  }));

  const trustUrls = Array.from(
    new Set(
      turnEntries.flatMap((t) => [
        ...t.citation_map.map((c) => c.url),
        ...t.supporting_sources.map((s) => s.url),
      ]),
    ),
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
    <DeepResearchSessionView
      subject={subject}
      topic={topic}
      session={session}
      turnEntries={turnEntries}
      initialTrustMap={initialTrustMap}
    />
  );
}
