'use client';

import type { LexiconEntry } from '@/prompts/landscape/landscape.schema';
import { LexiconView } from '@/ui/components/lexicon-view.component';
import { SectionNav } from '@/ui/components/section-nav';
import { Composer } from '@/ui/views/deep-research/components/composer.component';
import { TurnBlock } from '@/ui/views/deep-research/components/turn-block.component';
import { useDeepResearchSession } from '@/ui/views/deep-research/hooks/useDeepResearchSession.hook';
import type { DeepResearchTurnState } from '@/ui/views/deep-research/types/deep-research-turn-state.type';

type Props = {
  subjectId: string;
  subjectSlug: string;
  topicSlug: string;
  sessionId: string;
  initialStatus: string;
  initialLexicon: LexiconEntry[];
  initialTurns: DeepResearchTurnState[];
};

export function SessionChat(props: Props) {
  const { turns, live, sessionStatus, lexicon, error, pending, activeTurn, canSubmit, submit } =
    useDeepResearchSession(props);

  const sections = turns.map((t) => ({ id: `turn-${t.turn_number}`, label: `Turn ${t.turn_number}` }));

  return (
    <div className="flex flex-col gap-6">
      {sections.length > 0 ? <SectionNav sections={sections} /> : null}

      <ol className="flex flex-col gap-6">
        {turns.map((turn) => (
          <li key={turn.id} id={`turn-${turn.turn_number}`} className="scroll-mt-16">
            <TurnBlock turn={turn} live={live[turn.id]} isActive={activeTurn?.id === turn.id} />
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

      {lexicon.length > 0 ? (
        <details className="rounded-md border bg-muted/20 p-3 text-sm">
          <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground">
            Lexicon
          </summary>
          <LexiconView className="mt-3" entries={lexicon} />
        </details>
      ) : null}
    </div>
  );
}
