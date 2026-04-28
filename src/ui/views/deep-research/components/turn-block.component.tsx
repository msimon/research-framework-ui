'use client';

import { CitationProvider } from '@/ui/components/citation.context';
import { Markdown } from '@/ui/components/markdown';
import { ReasoningBlock } from '@/ui/views/deep-research/components/reasoning-block.component';
import { StreamingHeader } from '@/ui/views/deep-research/components/streaming-header.component';
import type {
  DeepResearchSourceState,
  DeepResearchTurnState,
  LiveTurnBuffer,
} from '@/ui/views/deep-research/hooks/useDeepResearchSession.hook';

type Props = {
  turn: DeepResearchTurnState;
  live: LiveTurnBuffer | undefined;
  sources: DeepResearchSourceState[];
  isActive: boolean;
};

export function TurnBlock({ turn, live, sources, isActive }: Props) {
  const liveText = live?.text ?? '';
  const liveReasoning = live?.reasoning ?? '';
  const toolCalls = live?.toolCalls ?? [];
  const citationMap = isActive && live?.citations.length ? live.citations : turn.citation_map;

  const persistedFindings = turn.findings_md?.trim() ?? '';
  const findingsContent = persistedFindings || (isActive ? liveText : '');
  const showFindings = findingsContent.length > 0;

  return (
    <CitationProvider value={{ citationMap, sources }}>
      <div className="flex flex-col gap-3">
        {turn.user_text ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Turn {turn.turn_number} · You
            </p>
            <p className="mt-1 whitespace-pre-wrap">{turn.user_text}</p>
          </div>
        ) : null}

        {isActive ? <StreamingHeader toolCalls={toolCalls} /> : null}

        {isActive && liveReasoning.trim().length > 0 ? <ReasoningBlock text={liveReasoning} /> : null}

        {showFindings ? (
          <div className="flex flex-col gap-4 rounded-md border p-4">
            <section>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Findings</p>
              <Markdown className="mt-1">{findingsContent}</Markdown>
            </section>

            {turn.my_read_md ? (
              <section>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">My read</p>
                <Markdown className="mt-1">{turn.my_read_md}</Markdown>
              </section>
            ) : null}

            {turn.followup_question ? (
              <section className="rounded-md bg-primary/5 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up</p>
                <p className="mt-1 text-sm">{turn.followup_question}</p>
              </section>
            ) : null}
          </div>
        ) : null}

        {turn.status === 'failed' && turn.error_message ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {turn.error_message}
          </div>
        ) : null}
      </div>
    </CitationProvider>
  );
}
