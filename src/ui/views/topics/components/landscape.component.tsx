'use client';

import { useEffect, useRef, useState } from 'react';

import { CitationProvider } from '@/ui/components/citation.context';
import { Markdown } from '@/ui/components/markdown';
import { Button } from '@/ui/components/ui/button';
import {
  type LandscapeState,
  type SourceItem,
  type ToolCallChip,
  useLandscape,
} from '@/ui/views/topics/hooks/useLandscape.hook';

type Props = {
  subjectSlug: string;
  topicSlug: string;
  topicId: string;
  initialLandscape: LandscapeState | null;
  initialSources: SourceItem[];
};

export function LandscapeView({ subjectSlug, topicSlug, initialLandscape, initialSources }: Props) {
  const {
    landscape,
    sources,
    liveReasoning,
    toolCalls,
    error,
    reasoningOpen,
    setReasoningOpen,
    trigger,
    displayContent,
    hasContent,
    isWorking,
    citationMap,
  } = useLandscape({ subjectSlug, topicSlug, initialLandscape, initialSources });

  const showExplainer = isWorking && !hasContent;

  return (
    <div className="flex flex-col gap-6">
      {(!landscape || landscape.status === 'pending') && !isWorking ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          <p>
            No landscape yet. Landscape runs a substantive overview of this topic — structured sections
            (players, economics, dynamics), and updates to the subject brief, lexicon, and open questions.
          </p>
          <Button
            onClick={() => {
              void trigger();
            }}
            disabled={isWorking}
          >
            Run landscape
          </Button>
        </div>
      ) : null}

      {showExplainer ? <LandscapeExplainer toolCalls={toolCalls} /> : null}

      {isWorking && hasContent ? <StreamingHeader toolCalls={toolCalls} /> : null}

      {isWorking && liveReasoning.trim().length > 0 ? (
        <ReasoningBlock
          text={liveReasoning}
          open={reasoningOpen}
          onToggle={() => setReasoningOpen((v) => !v)}
        />
      ) : null}

      {hasContent ? (
        <CitationProvider value={{ citationMap, sources }}>
          <section className="rounded-md border bg-card p-6">
            <Markdown>{displayContent}</Markdown>
          </section>
        </CitationProvider>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void trigger();
              }}
              disabled={isWorking}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {sources.length > 0 ? (
        <details id="sources" open className="scroll-mt-16 rounded-md border bg-muted/20">
          <summary className="cursor-pointer select-none p-3 text-sm font-medium text-muted-foreground">
            Sources ({sources.length})
          </summary>
          <ul className="flex flex-col divide-y divide-border/40 border-t">
            {sources.map((source, idx) => (
              <li key={source.id} id={`source-${idx + 1}`} className="scroll-mt-16 p-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}.</span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    {source.title || source.url}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function LandscapeExplainer({ toolCalls }: { toolCalls: ToolCallChip[] }) {
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

function StreamingHeader({ toolCalls }: { toolCalls: ToolCallChip[] }) {
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
        <span>Researching and writing the landscape{'.'.repeat(dots)}</span>
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

function ReasoningBlock({ text, open, onToggle }: { text: string; open: boolean; onToggle: () => void }) {
  return (
    <details
      open={open}
      onToggle={onToggle}
      className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"
    >
      <summary className="cursor-pointer select-none font-medium">Thinking…</summary>
      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{text}</pre>
    </details>
  );
}
