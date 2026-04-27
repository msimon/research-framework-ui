'use client';

import { useEffect, useRef, useState } from 'react';

import { Markdown } from '@/ui/components/markdown';
import { SectionNav } from '@/ui/components/section-nav';
import { Button } from '@/ui/components/ui/button';
import { Textarea } from '@/ui/components/ui/textarea';
import {
  type DeepResearchSourceState,
  type DeepResearchTurnState,
  type LiveTurnBuffer,
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
    </div>
  );
}

function TurnBlock({
  turn,
  live,
  isActive,
}: {
  turn: DeepResearchTurnState;
  live: LiveTurnBuffer | undefined;
  isActive: boolean;
}) {
  const liveText = live?.text ?? '';
  const liveReasoning = live?.reasoning ?? '';
  const toolCalls = live?.toolCalls ?? [];

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

function Composer({
  canSubmit,
  pending,
  hasActiveTurn,
  onSubmit,
}: {
  canSubmit: boolean;
  pending: boolean;
  hasActiveTurn: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');

  function submit() {
    if (!text.trim()) return;
    onSubmit(text);
    setText('');
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          hasActiveTurn
            ? 'Waiting for the current turn to finish…'
            : 'What other question or area of research are you looking into?'
        }
        rows={3}
        disabled={!canSubmit}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit || text.trim().length === 0}>
          {pending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </form>
  );
}

function StreamingHeader({
  toolCalls,
}: {
  toolCalls: Array<{ id: string; name: string; query: string; resolved: boolean }>;
}) {
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

function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"
    >
      <summary className="cursor-pointer select-none font-medium">Thinking…</summary>
      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{text}</pre>
    </details>
  );
}
