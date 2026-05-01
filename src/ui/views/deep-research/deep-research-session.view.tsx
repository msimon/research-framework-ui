'use client';

import Link from 'next/link';

import type { Subject } from '@/server/domain/subjects/subjects.repository';
import type { Database } from '@/shared/lib/supabase/supabase.types';
import type { SourceTrustMap } from '@/ui/types/source-trust.type';
import { CloseSessionButton } from '@/ui/views/deep-research/components/close-session-button.component';
import { SessionChat } from '@/ui/views/deep-research/components/session-chat.component';
import type { DeepResearchTurnState } from '@/ui/views/deep-research/types/deep-research-turn-state.type';

type TopicRow = Database['public']['Tables']['topics']['Row'];
type SessionRow = Database['public']['Tables']['deep_research_sessions']['Row'];

type Props = {
  subject: Subject;
  topic: TopicRow;
  session: SessionRow;
  turnEntries: DeepResearchTurnState[];
  initialTrustMap: SourceTrustMap;
};

export function DeepResearchSessionView({ subject, topic, session, turnEntries, initialTrustMap }: Props) {
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
        initialLexicon={subject.lexicon}
        initialTurns={turnEntries}
        initialTrustMap={initialTrustMap}
      />
    </div>
  );
}
