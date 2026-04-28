'use client';

import { useState } from 'react';

import { Button } from '@/ui/components/ui/button';
import { Textarea } from '@/ui/components/ui/textarea';

type Props = {
  canSubmit: boolean;
  pending: boolean;
  hasActiveTurn: boolean;
  onSubmit: (text: string) => void;
};

export function Composer({ canSubmit, pending, hasActiveTurn, onSubmit }: Props) {
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim()) return;
    onSubmit(text);
    setText('');
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          hasActiveTurn
            ? 'Waiting for the current turn to finish…'
            : 'What other question or area of research are you looking into?'
        }
        rows={3}
        disabled={!canSubmit}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit || text.trim().length === 0}>
          {pending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </form>
  );
}
