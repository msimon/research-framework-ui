'use client';

import { useState, useTransition } from 'react';

import { createSubjectAction } from '@/app/_actions/subject.action';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { Label } from '@/ui/components/ui/label';
import { Textarea } from '@/ui/components/ui/textarea';

export function SubjectNewFormView() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createSubjectAction(formData);
      if (result && 'error' in result) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Start a new subject</h2>
        <p className="text-sm text-muted-foreground">
          Give a problem statement or a short slug. The interview will adapt to what you give it.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="raw">Problem statement or slug</Label>
        <Textarea
          id="raw"
          name="raw"
          placeholder="e.g. Cost of running an oncology clinic in Texas"
          rows={3}
          required
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slugOverride">Subject slug (optional)</Label>
        <Input
          id="slugOverride"
          name="slugOverride"
          placeholder="Leave blank to auto-derive"
          disabled={pending}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Start interview'}
        </Button>
      </div>
    </form>
  );
}
