'use client';

import { useEffect, useRef, useState } from 'react';

export function DiscoverThinking() {
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
        <p className="text-base font-medium">Mapping the research space{'.'.repeat(dots)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Surfacing candidate research topics tailored to your scope, angle, and end goal.
          <br />
          You'll get a ranked list — each with a title, a short pitch, and a rationale for why it matters —
          and you pick which ones to explore next.
          <br />
          This usually takes 60–120 seconds.
        </p>
      </div>
    </div>
  );
}
