'use client';

import { useState } from 'react';

import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';

type Props = {
  onSubmit: (hint: string) => void;
  disabled: boolean;
};

export function NarrowTopicsRow({ onSubmit, disabled }: Props) {
  const [hint, setHint] = useState('');

  function submit() {
    const trimmed = hint.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setHint('');
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        Missing a topic you had in mind? Describe it in a sentence and we'll dig for more.
      </span>
      <div className="flex items-center gap-2">
        <Input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. payer-side economics, pediatric edge cases"
          disabled={disabled}
          className="h-8"
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={disabled || hint.trim().length === 0}
          className="whitespace-nowrap"
        >
          Find more
        </Button>
      </div>
    </div>
  );
}
