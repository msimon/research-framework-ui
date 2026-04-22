'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { closeSessionAction } from '@/app/_actions/deep-research.action';
import { Button } from '@/ui/components/ui/button';

type Props = {
  sessionId: string;
  subjectSlug: string;
  topicSlug: string;
  initialStatus: string;
};

export function CloseSessionButton({ sessionId, subjectSlug, topicSlug, initialStatus }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(initialStatus);

  if (status !== 'active') return null;

  function onClick() {
    const formData = new FormData();
    formData.set('sessionId', sessionId);
    start(async () => {
      const result = await closeSessionAction(formData);
      if (result && 'error' in result) {
        console.error(result.error);
        return;
      }
      setStatus('closed');
      router.push(`/subjects/${subjectSlug}/topics/${topicSlug}`);
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 whitespace-nowrap"
      disabled={pending}
      onClick={onClick}
    >
      {pending ? 'Closing…' : 'Close deep research'}
    </Button>
  );
}
