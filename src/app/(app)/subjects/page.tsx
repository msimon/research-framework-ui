import { listSubjectsForUser } from '@/server/domain/subjects/subjects.command';
import { getCurrentUserId } from '@/server/lib/utils/currentUser';
import { SubjectsListView } from '@/ui/views/subjects/subjects-list.view';

export default async function SubjectsPage() {
  const userId = await getCurrentUserId();
  const subjects = await listSubjectsForUser(userId);
  return <SubjectsListView subjects={subjects} />;
}
