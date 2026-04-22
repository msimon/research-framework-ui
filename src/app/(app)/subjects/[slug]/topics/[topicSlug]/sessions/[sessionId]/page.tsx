import { DeepResearchSessionView } from '@/ui/views/deep-research/deep-research-session.view';

type PageProps = {
  params: Promise<{ slug: string; topicSlug: string; sessionId: string }>;
};

export default async function DeepResearchSessionPage({ params }: PageProps) {
  const { slug, topicSlug, sessionId } = await params;
  return <DeepResearchSessionView slug={slug} topicSlug={topicSlug} sessionId={sessionId} />;
}
