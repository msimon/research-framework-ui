'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { triggerLandscapeAction } from '@/app/_actions/landscape.action';
import { supabaseClient } from '@/shared/lib/supabase/client';
import { Markdown } from '@/ui/components/markdown';
import { Button } from '@/ui/components/ui/button';

type LandscapeState = {
  id: string;
  content_md: string;
  status: 'pending' | 'streaming' | 'complete' | 'failed' | string;
  error_message: string | null;
  updated_at: string;
};

type SourceItem = {
  id: string;
  url: string;
  title: string | null;
  snippet: string | null;
};

type ToolCallChip = {
  id: string;
  name: string;
  query: string;
  resolved: boolean;
};

type LandscapeEvent =
  | { type: 'status'; status: string }
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input?: { query?: string } }
  | { type: 'tool_result'; id: string; name: string }
  | { type: 'complete' }
  | { type: 'error'; message: string };

type Props = {
  subjectSlug: string;
  topicSlug: string;
  topicId: string;
  initialLandscape: LandscapeState | null;
  initialSources: SourceItem[];
};

export function LandscapeView({ subjectSlug, topicSlug, initialLandscape, initialSources }: Props) {
  const [landscape, setLandscape] = useState<LandscapeState | null>(initialLandscape);
  const [sources, setSources] = useState<SourceItem[]>(initialSources);
  const [streaming, setStreaming] = useState(initialLandscape?.status === 'streaming');
  const [liveContent, setLiveContent] = useState('');
  const [liveReasoning, setLiveReasoning] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCallChip[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialLandscape?.error_message ?? null);
  const [reasoningOpen, setReasoningOpen] = useState(true);

  const landscapeId = landscape?.id ?? null;

  useEffect(() => {
    if (!landscapeId) return;

    const channel = supabaseClient
      .channel(`landscape:${landscapeId}`)
      .on('broadcast', { event: 'event' }, ({ payload }: { payload: LandscapeEvent }) => {
        if (!payload || typeof payload !== 'object' || !('type' in payload)) return;
        switch (payload.type) {
          case 'status':
            if (payload.status === 'streaming') setStreaming(true);
            break;
          case 'text':
            setLiveContent((prev) => prev + payload.delta);
            break;
          case 'reasoning':
            setLiveReasoning((prev) => prev + payload.delta);
            break;
          case 'tool_call': {
            const query = typeof payload.input?.query === 'string' ? payload.input.query : '…';
            setToolCalls((prev) => [...prev, { id: payload.id, name: payload.name, query, resolved: false }]);
            break;
          }
          case 'tool_result':
            setToolCalls((prev) =>
              prev.map((c) => (c.id === payload.id ? { ...c, resolved: true } : c)),
            );
            break;
          case 'complete':
            setStreaming(false);
            setReasoningOpen(false);
            break;
          case 'error':
            setStreaming(false);
            setError(payload.message);
            break;
        }
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [landscapeId]);

  useEffect(() => {
    if (!landscapeId) return;

    const rows = supabaseClient
      .channel(`landscapes:row:${landscapeId}`)
      .on(
        // biome-ignore lint/suspicious/noExplicitAny: Supabase channel generic is awkward for postgres_changes
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'landscapes',
          filter: `id=eq.${landscapeId}`,
        },
        (payload: { new: LandscapeState | null }) => {
          if (!payload.new) return;
          setLandscape(payload.new);
          if (payload.new.status === 'complete' || payload.new.status === 'failed') {
            setStreaming(false);
          }
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(rows);
    };
  }, [landscapeId]);

  useEffect(() => {
    if (!landscapeId) return;

    const rows = supabaseClient
      .channel(`sources:topic:${topicSlug}`)
      .on(
        // biome-ignore lint/suspicious/noExplicitAny: Supabase channel generic is awkward for postgres_changes
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sources',
          filter: `landscape_id=eq.${landscapeId}`,
        },
        (payload: { new: SourceItem | null }) => {
          if (!payload.new) return;
          setSources((prev) => (prev.some((s) => s.id === payload.new?.id) ? prev : [...prev, payload.new!]));
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(rows);
    };
  }, [landscapeId, topicSlug]);

  function trigger() {
    setError(null);
    setLiveContent('');
    setLiveReasoning('');
    setToolCalls([]);
    setStreaming(true);
    setReasoningOpen(true);

    const formData = new FormData();
    formData.set('subjectSlug', subjectSlug);
    formData.set('topicSlug', topicSlug);

    startTransition(async () => {
      const result = await triggerLandscapeAction(formData);
      if (result && 'error' in result) {
        setStreaming(false);
        setError(result.error ?? 'Landscape failed');
      }
    });
  }

  const persistedContent = landscape?.content_md ?? '';
  const showStreamed = streaming || (!persistedContent && liveContent.length > 0);
  const displayContent = showStreamed ? liveContent : persistedContent;
  const hasContent = displayContent.trim().length > 0;
  const isWorking = pending || streaming;

  return (
    <div className="flex flex-col gap-6">
      {!landscape || (landscape.status === 'pending' && !isWorking) ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          <p>
            No landscape yet. Landscape runs a substantive overview of this topic — structured sections
            (players, economics, dynamics), and updates to the subject brief, lexicon, and open questions.
          </p>
          <Button onClick={trigger} disabled={isWorking}>
            Run landscape
          </Button>
        </div>
      ) : null}

      {isWorking ? <StreamingHeader toolCalls={toolCalls} /> : null}

      {isWorking && liveReasoning.trim().length > 0 ? (
        <ReasoningBlock text={liveReasoning} open={reasoningOpen} onToggle={() => setReasoningOpen((v) => !v)} />
      ) : null}

      {hasContent ? (
        <section className="rounded-md border bg-card p-6">
          <Markdown>{displayContent}</Markdown>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={trigger} disabled={isWorking}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {sources.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Sources</h3>
          <ul className="flex flex-col divide-y divide-border/40 rounded-md border bg-muted/20">
            {sources.map((source, idx) => (
              <li key={source.id} className="p-3 text-sm">
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
                {source.snippet ? (
                  <p className="ml-6 mt-1 text-xs text-muted-foreground">{source.snippet}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {landscape?.status === 'complete' && !isWorking ? (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={trigger} disabled={isWorking}>
            Refresh landscape
          </Button>
        </div>
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
                call.resolved
                  ? 'bg-muted text-foreground/80'
                  : 'bg-primary/10 text-primary animate-pulse'
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
    <details open={open} onToggle={onToggle} className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium">Thinking…</summary>
      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{text}</pre>
    </details>
  );
}
