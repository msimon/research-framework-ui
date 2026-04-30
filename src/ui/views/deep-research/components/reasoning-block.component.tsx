'use client';

import { useState } from 'react';

export function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"
    >
      <summary className="cursor-pointer select-none font-medium">Thinking…</summary>
      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{text}</pre>
    </details>
  );
}
