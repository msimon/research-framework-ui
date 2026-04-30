'use client';

import { useEffect, useRef, useState } from 'react';

type ToolCall = { id: string; name: string; query: string; resolved: boolean };

export function StreamingHeader({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [tick, setTick] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, []);

  const dots = tick % 4;
  const elapsed = Math.floor((Date.now() - startRef.current) / 1000);

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="tabular-nums">{elapsed}s</span>
        <span>Researching{'.'.repeat(dots)}</span>
      </div>
      {toolCalls.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
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
