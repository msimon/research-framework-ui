'use client';

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { triggerLandscapeAction } from '@/app/_actions/landscape.action';
import type { CitationEntry } from '@/shared/citation.type';
import { supabaseClient } from '@/shared/lib/supabase/client';

type SupportingSource = { url: string; title: string | null };

export type LandscapeState = {
  id: string;
  content_md: string;
  citation_map: CitationEntry[];
  supporting_sources: SupportingSource[];
  status: 'pending' | 'streaming' | 'complete' | 'failed' | string;
  error_message: string | null;
  updated_at: string;
};

export type SourceItem = {
  id: string;
  url: string;
  title: string | null;
};

export type ToolCallChip = {
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
  | { type: 'citation'; url: string; title: string | null; cited_text: string }
  | { type: 'supporting_source'; url: string; title: string | null }
  | { type: 'complete' }
  | { type: 'error'; message: string };

type Args = {
  subjectSlug: string;
  topicSlug: string;
  initialLandscape: LandscapeState | null;
  initialSources: SourceItem[];
};

export function useLandscape({ subjectSlug, topicSlug, initialLandscape, initialSources }: Args) {
  const router = useRouter();
  const [landscape, setLandscape] = useState<LandscapeState | null>(initialLandscape);
  const [sources, setSources] = useState<SourceItem[]>(initialSources);
  const [streaming, setStreaming] = useState(initialLandscape?.status === 'streaming');
  const [liveContent, setLiveContent] = useState('');
  const [liveReasoning, setLiveReasoning] = useState('');
  const [liveCitations, setLiveCitations] = useState<CitationEntry[]>([]);
  const [liveSupporting, setLiveSupporting] = useState<SupportingSource[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallChip[]>([]);
  const [error, setError] = useState<string | null>(initialLandscape?.error_message ?? null);
  const [reasoningOpen, setReasoningOpen] = useState(true);

  const landscapeId = landscape?.id ?? null;

  useEffect(() => {
    if (!landscapeId) return;

    const channel = supabaseClient
      .channel(`landscape:${landscapeId}`, { config: { private: true } })
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
            setToolCalls((prev) => prev.map((c) => (c.id === payload.id ? { ...c, resolved: true } : c)));
            break;
          case 'citation':
            setLiveCitations((prev) => [
              ...prev,
              { url: payload.url, title: payload.title, cited_text: payload.cited_text },
            ]);
            break;
          case 'supporting_source':
            setLiveSupporting((prev) => [...prev, { url: payload.url, title: payload.title }]);
            break;
          case 'complete':
            setStreaming(false);
            setReasoningOpen(false);
            router.refresh();
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
  }, [landscapeId, router]);

  useEffect(() => {
    if (!landscapeId) return;

    const rows = supabaseClient
      .channel(`landscapes:row:${landscapeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'landscapes',
          filter: `id=eq.${landscapeId}`,
        },
        (payload: RealtimePostgresChangesPayload<LandscapeState>) => {
          if (payload.eventType !== 'UPDATE') return;
          const next = payload.new;
          setLandscape(next);
          if (next.status === 'complete' || next.status === 'failed') {
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
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sources',
          filter: `landscape_id=eq.${landscapeId}`,
        },
        (payload: RealtimePostgresChangesPayload<SourceItem>) => {
          if (payload.eventType !== 'INSERT') return;
          const next = payload.new;
          setSources((prev) => (prev.some((s) => s.id === next.id) ? prev : [...prev, next]));
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(rows);
    };
  }, [landscapeId, topicSlug]);

  async function trigger() {
    setError(null);
    setLiveContent('');
    setLiveReasoning('');
    setLiveCitations([]);
    setLiveSupporting([]);
    setToolCalls([]);
    setStreaming(true);
    setReasoningOpen(true);

    const formData = new FormData();
    formData.set('subjectSlug', subjectSlug);
    formData.set('topicSlug', topicSlug);

    const result = await triggerLandscapeAction(formData);
    if (result && 'error' in result) {
      setStreaming(false);
      setError(result.error ?? 'Landscape failed');
      return;
    }
    if (result && 'landscapeId' in result && result.landscapeId) {
      const newId = result.landscapeId;
      setLandscape((prev) =>
        prev && prev.id === newId
          ? prev
          : {
              id: newId,
              content_md: '',
              citation_map: [],
              supporting_sources: [],
              status: 'streaming',
              error_message: null,
              updated_at: new Date().toISOString(),
            },
      );
    }
  }

  const persistedContent = landscape?.content_md ?? '';
  const showStreamed = streaming || (!persistedContent && liveContent.length > 0);
  const displayContent = showStreamed ? liveContent : persistedContent;
  const hasContent = displayContent.trim().length > 0;
  const isWorking = streaming;

  const citationMap = streaming ? liveCitations : (landscape?.citation_map ?? []);
  const supportingSources = streaming ? liveSupporting : (landscape?.supporting_sources ?? []);
  // Single Sources list shown to the user: cited URLs first (with bracket
  // anchors), then supporting URLs (no anchors). Both deduped by URL.
  const displaySources = useMemo(() => {
    const cited = dedupByUrl(citationMap);
    const citedUrls = new Set(cited.map((s) => s.url));
    const supporting: Array<{ url: string; title: string | null; cited: boolean }> = [];
    for (const s of supportingSources) {
      if (citedUrls.has(s.url)) continue;
      if (supporting.some((existing) => existing.url === s.url)) continue;
      supporting.push({ url: s.url, title: s.title, cited: false });
    }
    return [...cited.map((s) => ({ ...s, cited: true })), ...supporting];
  }, [citationMap, supportingSources]);

  return {
    landscape,
    sources,
    displaySources,
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
  };
}

function dedupByUrl(entries: ReadonlyArray<CitationEntry>): Array<{ url: string; title: string | null }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; title: string | null }> = [];
  for (const e of entries) {
    if (seen.has(e.url)) continue;
    seen.add(e.url);
    out.push({ url: e.url, title: e.title });
  }
  return out;
}
