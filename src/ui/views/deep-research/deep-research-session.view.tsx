import Link from 'next/link';
import { notFound } from 'next/navigation';

import { findSessionById, listTurnsForSession } from '@/server/domain/deep-research/deep-research.repository';
import { getSubject } from '@/server/domain/subjects/subjects.command';
import { findTopicBySlug } from '@/server/domain/topics/topics.repository';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import type { CitationEntry } from '@/shared/citation.type';
import type { SupportingSource } from '@/ui/types/supporting-source.type';
import { CloseSessionButton } from '@/ui/views/deep-research/components/close-session-button.component';
import { SessionChat } from '@/ui/views/deep-research/components/session-chat.component';

type Props = {
  slug: string;
  topicSlug: string;
  sessionId: string;
};

export async function DeepResearchSessionView({ slug, topicSlug, sessionId }: Props) {
  const userId = await getCurrentUserId();
  const subject = await getSubject(userId, slug);
  const topic = await findTopicBySlug(subject.id, topicSlug);
  if (!topic) notFound();

  const session = await findSessionById(sessionId);
  if (!session || session.topic_id !== topic.id) notFound();

  const turns = await listTurnsForSession(sessionId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href={`/subjects/${subject.slug}/topics/${topic.slug}`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {topic.title}
          </Link>
          <h2 className="text-xl font-semibold">Deep research session</h2>
        </div>
        <CloseSessionButton
          sessionId={session.id}
          subjectSlug={subject.slug}
          topicSlug={topic.slug}
          initialStatus={session.status}
        />
      </header>

      <SessionChat
        subjectId={subject.id}
        subjectSlug={subject.slug}
        topicSlug={topic.slug}
        sessionId={session.id}
        initialStatus={session.status}
        initialLexiconMd={subject.lexicon_md}
        initialTurns={turns.map((t) => ({
          id: t.id,
          turn_number: t.turn_number,
          user_text: t.user_text,
          findings_md: t.findings_md,
          my_read_md: t.my_read_md,
          followup_question: t.followup_question,
          reasoning_md: t.reasoning_md,
          citation_map: (t.citation_map as CitationEntry[] | null) ?? [],
          supporting_sources: (t.supporting_sources as SupportingSource[] | null) ?? [],
          status: t.status,
          error_message: t.error_message,
        }))}
      />
    </div>
  );
}
