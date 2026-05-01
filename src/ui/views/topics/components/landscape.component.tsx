'use client';

import { Markdown } from '@/ui/components/markdown';
import { SourceRow } from '@/ui/components/source-row.component';
import { Button } from '@/ui/components/ui/button';
import type { SourceTrustMap } from '@/ui/types/source-trust.type';
import { LandscapeExplainer } from '@/ui/views/topics/components/landscape-explainer.component';
import { ReasoningBlock } from '@/ui/views/topics/components/reasoning-block.component';
import { StreamingHeader } from '@/ui/views/topics/components/streaming-header.component';
import { useLandscape } from '@/ui/views/topics/hooks/useLandscape.hook';
import type { LandscapeState } from '@/ui/views/topics/types/landscape-state.type';

type Props = {
  subjectSlug: string;
  topicSlug: string;
  initialLandscape: LandscapeState | null;
  initialTrustMap: SourceTrustMap;
};

export function Landscape({ subjectSlug, topicSlug, initialLandscape, initialTrustMap }: Props) {
  const {
    landscape,
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
    trustMap,
  } = useLandscape({ subjectSlug, topicSlug, initialLandscape, initialTrustMap });

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
        <section className="rounded-md border bg-card p-6">
          <Markdown>{displayContent}</Markdown>
        </section>
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

      {displaySources.length > 0 ? (
        <details id="sources" open className="scroll-mt-16 rounded-md border bg-muted/20">
          <summary className="cursor-pointer select-none p-3 text-sm font-medium text-muted-foreground">
            Sources ({displaySources.length})
          </summary>
          <ul className="flex flex-col divide-y divide-border/40 border-t">
            {displaySources.map((source, idx) => {
              // Cited URLs come first in the list and get bracket-anchor ids
              // matching the [N] links baked into content_md. Supporting URLs
              // are listed below without anchor ids — they're context, not
              // referenced inline.
              const citedPosition = source.cited
                ? displaySources.slice(0, idx + 1).filter((s) => s.cited).length
                : null;
              return (
                <SourceRow
                  key={source.url}
                  url={source.url}
                  title={source.title}
                  citedPosition={citedPosition}
                  anchorId={citedPosition !== null ? `source-${citedPosition}` : undefined}
                  trust={trustMap[source.url]}
                />
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
