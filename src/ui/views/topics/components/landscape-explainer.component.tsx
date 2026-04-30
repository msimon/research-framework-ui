'use client';

import { useEffect, useRef, useState } from 'react';

import type { ToolCallChip } from '@/ui/views/topics/types/tool-call-chip.type';

export function LandscapeExplainer({ toolCalls }: { toolCalls: ToolCallChip[] }) {
  const [tick, setTick] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, []);

  const dots = tick % 4;
  const elapsed = Math.floor((Date.now() - startRef.current) / 1000);

  return (
    <div className="flex flex-col items-center gap-4 rounded-md border bg-muted/20 p-8 text-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="tabular-nums">{elapsed}s</span>
      </div>
      <div>
        <p className="text-base font-medium">Mapping the topic landscape{'.'.repeat(dots)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Researching players, economics, current dynamics, and contested narratives for this topic.
          <br />
          You'll get a structured overview with sections and cited sources, plus updates to your subject
          brief, lexicon, and open questions.
          <br />
          This usually takes 90–180 seconds.
        </p>
      </div>
      {toolCalls.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-1.5">
          {toolCalls.map((call) => (
            <li
              key={call.id}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                call.resolved ? 'bg-muted text-foreground/80' : 'bg-primary/10 text-primary animate-pulse'
              }`}
            >
              {call.name === 'web_search' ? '🔎 ' : ''}
              {call.query.length > 60 ? `${call.query.slice(0, 60)}…` : call.query}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
