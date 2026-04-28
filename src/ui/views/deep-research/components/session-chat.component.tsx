'use client';

import { Markdown } from '@/ui/components/markdown';
import { SectionNav } from '@/ui/components/section-nav';
import { Composer } from '@/ui/views/deep-research/components/composer.component';
import { TurnBlock } from '@/ui/views/deep-research/components/turn-block.component';
import {
  type DeepResearchSourceState,
  type DeepResearchTurnState,
  useDeepResearchSession,
} from '@/ui/views/deep-research/hooks/useDeepResearchSession.hook';

type Props = {
  subjectId: string;
  subjectSlug: string;
  topicSlug: string;
  sessionId: string;
  initialStatus: string;
  initialLexiconMd: string;
  initialTurns: DeepResearchTurnState[];
  initialSources: DeepResearchSourceState[];
};

export function SessionChat(props: Props) {
  const { turns, sources, live, sessionStatus, lexiconMd, error, pending, activeTurn, canSubmit, submit } =
    useDeepResearchSession(props);

  const sections = [
    ...turns.map((t) => ({ id: `turn-${t.turn_number}`, label: `Turn ${t.turn_number}` })),
    ...(sources.length > 0 ? [{ id: 'sources', label: 'Sources' }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {sections.length > 0 ? <SectionNav sections={sections} /> : null}

      <ol className="flex flex-col gap-6">
        {turns.map((turn) => (
          <li key={turn.id} id={`turn-${turn.turn_number}`} className="scroll-mt-16">
            <TurnBlock
              turn={turn}
              live={live[turn.id]}
              sources={sources}
              isActive={activeTurn?.id === turn.id}
            />
          </li>
        ))}
      </ol>

      {sessionStatus === 'active' ? (
        <Composer
          canSubmit={canSubmit}
          pending={pending}
          hasActiveTurn={activeTurn !== null}
          onSubmit={submit}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Session closed.</p>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {lexiconMd.trim().length > 0 ? (
        <details className="rounded-md border bg-muted/20 p-3 text-sm">
          <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground">
            Lexicon
          </summary>
          <Markdown className="mt-3">{lexiconMd}</Markdown>
        </details>
      ) : null}

      {sources.length > 0 ? (
        <section id="sources" className="flex scroll-mt-16 flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Sources</h3>
          <ul className="flex flex-col divide-y divide-border/40 rounded-md border bg-muted/20">
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
        </section>
      ) : null}
    </div>
  );
}
