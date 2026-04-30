import { TopicView } from '@/ui/views/topics/topic.view';

type PageProps = {
  params: Promise<{ slug: string; topicSlug: string }>;
};

export default async function TopicLandscapePage({ params }: PageProps) {
  const { slug, topicSlug } = await params;
  return <TopicView slug={slug} topicSlug={topicSlug} />;
}
