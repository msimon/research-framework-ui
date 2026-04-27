import { redirect } from 'next/navigation';

import type { AgentStep } from '@/prompts/init-subject/init-subject.schema';
import { loadInterviewState } from '@/server/domain/init-interview/init-interview.command';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import { InterviewView } from '@/ui/views/subjects/interview.view';
import { SubjectNewFormView } from '@/ui/views/subjects/subject-new-form.view';

type PageProps = {
  searchParams: Promise<{ id?: string }>;
};

export default async function NewSubjectPage({ searchParams }: PageProps) {
  const { id } = await searchParams;

  if (!id) return <SubjectNewFormView />;

  const userId = await getCurrentUserId();
  const { subject, turns } = await loadInterviewState(userId, id);

  if (subject.status === 'ready') redirect(`/subjects/${subject.slug}`);

  const initialTurns = turns.map((t) => ({
    id: t.id,
    turn_number: t.turn_number,
    agent_step: t.agent_step as unknown as AgentStep,
    user_answer: t.user_answer as { text?: string } | null,
  }));

  return (
    <InterviewView
      subjectId={subject.id}
      subjectSlug={subject.slug}
      initialTurns={initialTurns}
      initialStatus={subject.status}
    />
  );
}
