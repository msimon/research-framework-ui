import { getCurrentUser } from '@/server/lib/utils/currentUser';

export default async function SubjectsPage() {
  const user = await getCurrentUser();

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Signed in as</p>
      <p className="text-lg font-medium">{user.email}</p>
      <p className="text-sm text-muted-foreground">
        Scaffold is alive. Milestone 1 (subjects + generative interview) is next.
      </p>
    </section>
  );
}
