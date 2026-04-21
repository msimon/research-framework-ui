import { TopicLandscapeView } from '@/ui/views/topics/topic-landscape.view';

type PageProps = {
  params: Promise<{ slug: string; topicSlug: string }>;
};

export default async function TopicLandscapePage({ params }: PageProps) {
  const { slug, topicSlug } = await params;
  return <TopicLandscapeView slug={slug} topicSlug={topicSlug} />;
}
