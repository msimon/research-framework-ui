'use client';

import Link from 'next/link';

import type { Subject } from '@/server/domain/subjects/subjects.repository';
import type { Database } from '@/shared/lib/supabase/supabase.types';
import { SectionNav } from '@/ui/components/section-nav';
import type { SourceTrustMap } from '@/ui/types/source-trust.type';
import { DeepResearchSection } from '@/ui/views/topics/components/deep-research-section.component';
import { Landscape } from '@/ui/views/topics/components/landscape.component';
import type { LandscapeState } from '@/ui/views/topics/types/landscape-state.type';

type TopicRow = Database['public']['Tables']['topics']['Row'];
type SessionRow = Database['public']['Tables']['deep_research_sessions']['Row'];

type Props = {
  subject: Subject;
  topic: TopicRow;
  landscape: LandscapeState | null;
  sessions: SessionRow[];
  initialTrustMap: SourceTrustMap;
};

export function TopicView({ subject, topic, landscape, sessions, initialTrustMap }: Props) {
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
        <Landscape
          subjectSlug={subject.slug}
          topicSlug={topic.slug}
          initialLandscape={landscape}
          initialTrustMap={initialTrustMap}
        />
      </div>

      {landscape?.status === 'complete' ? (
        <div id="deep-research" className="scroll-mt-16">
          <DeepResearchSection subjectSlug={subject.slug} topicSlug={topic.slug} sessions={sessions} />
        </div>
      ) : null}
    </div>
  );
}
