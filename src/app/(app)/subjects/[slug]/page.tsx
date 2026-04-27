import { SubjectDetailView } from '@/ui/views/subjects/subject-detail.view';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SubjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return <SubjectDetailView slug={slug} />;
}
