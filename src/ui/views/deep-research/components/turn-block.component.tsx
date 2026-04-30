'use client';

import type { CitationEntry } from '@/shared/citation.type';
import { Markdown } from '@/ui/components/markdown';
import type { SupportingSource } from '@/ui/types/supporting-source.type';
import { ReasoningBlock } from '@/ui/views/deep-research/components/reasoning-block.component';
import { StreamingHeader } from '@/ui/views/deep-research/components/streaming-header.component';
import type { DeepResearchTurnState } from '@/ui/views/deep-research/types/deep-research-turn-state.type';
import type { LiveTurnBuffer } from '@/ui/views/deep-research/types/live-turn-buffer.type';

type Props = {
  turn: DeepResearchTurnState;
  live: LiveTurnBuffer | undefined;
  isActive: boolean;
};

export function TurnBlock({ turn, live, isActive }: Props) {
  const liveText = live?.text ?? '';
  const liveReasoning = live?.reasoning ?? '';
  const toolCalls = live?.toolCalls ?? [];
  // Sources displayed under THIS turn. Cited URLs first (with anchor ids
  // that match the turn-scoped bracket links baked into findings_md), then
  // supporting URLs (no anchor ids — context, not referenced inline).
  const citationMap = isActive && live?.citations.length ? live.citations : turn.citation_map;
  const supportingSources: ReadonlyArray<SupportingSource> =
    isActive && live?.supporting.length ? live.supporting : turn.supporting_sources;
  const turnSources = buildCombined(citationMap, supportingSources);

  const persistedFindings = turn.findings_md?.trim() ?? '';
  const findingsContent = persistedFindings || (isActive ? liveText : '');
  const showFindings = findingsContent.length > 0;

  return (
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

          {turnSources.length > 0 ? (
            <section>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sources</p>
              <ul className="mt-1 flex flex-col divide-y divide-border/40 rounded-md border bg-muted/20">
                {turnSources.map((source, idx) => {
                  const citedPosition = source.cited
                    ? turnSources.slice(0, idx + 1).filter((s) => s.cited).length
                    : null;
                  return (
                    <li
                      key={source.url}
                      id={
                        citedPosition !== null
                          ? `turn-${turn.turn_number}-source-${citedPosition}`
                          : undefined
                      }
                      className="scroll-mt-16 p-3 text-sm"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {citedPosition !== null ? `${citedPosition}.` : '·'}
                        </span>
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
                  );
                })}
              </ul>
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
  );
}

function buildCombined(
  citations: ReadonlyArray<CitationEntry>,
  supporting: ReadonlyArray<SupportingSource>,
): Array<{ url: string; title: string | null; cited: boolean }> {
  const seen = new Set<string>();
  const cited: Array<{ url: string; title: string | null; cited: true }> = [];
  for (const c of citations) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    cited.push({ url: c.url, title: c.title, cited: true });
  }
  const supportingOut: Array<{ url: string; title: string | null; cited: false }> = [];
  for (const s of supporting) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    supportingOut.push({ url: s.url, title: s.title, cited: false });
  }
  return [...cited, ...supportingOut];
}
