import { getSubject } from '@/server/domain/subjects/subjects.command';
import { listTopicsForSubject } from '@/server/domain/topics/topics.command';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import { SubjectDetailView } from '@/ui/views/subjects/subject-detail.view';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SubjectDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const userId = await getCurrentUserId();
  const subject = await getSubject(userId, slug);
  const topics = await listTopicsForSubject(subject.id);

  return <SubjectDetailView subject={subject} topics={topics} />;
}
