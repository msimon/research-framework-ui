import { findTopicsBySubject } from '@/server/domain/topics/topics.repository';

export async function listTopicsForSubject(subjectId: string) {
  return findTopicsBySubject(subjectId);
}
