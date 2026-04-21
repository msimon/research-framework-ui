'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { answerInterviewAction } from '@/app/_actions/subject.action';
import { Markdown } from '@/ui/components/markdown';
import { Button } from '@/ui/components/ui/button';
import { Textarea } from '@/ui/components/ui/textarea';
import { type InterviewTurn, useInterview } from '@/ui/views/subjects/hooks/useInterview.hook';

type InterviewViewProps = {
  subjectId: string;
  subjectSlug: string;
  initialTurns: InterviewTurn[];
  initialStatus: string;
};

export function InterviewView(props: InterviewViewProps) {
  const { turns, status, thinking, latestTurn, canAnswer, finalizing } = useInterview(props);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-semibold">Framing interview</h2>
        <p className="text-sm text-muted-foreground">
          Answer one question at a time. The interviewer decides which framing questions matter for this
          subject.
        </p>
      </header>

      <ol className="flex flex-col gap-6">
        {turns.map((turn) => (
          <li key={turn.id}>
            <TurnBlock turn={turn} />
          </li>
        ))}
      </ol>

      {finalizing ? <FinalizingScreen /> : thinking ? <ThinkingIndicator /> : null}

      {canAnswer && latestTurn && !finalizing ? (
        <AnswerComposer subjectId={props.subjectId} turn={latestTurn} />
      ) : status !== 'ready' && !thinking ? (
        <p className="text-sm text-muted-foreground">Waiting for the next step…</p>
      ) : null}

      {status === 'ready' ? (
        <p className="text-sm text-muted-foreground">Interview complete. Redirecting…</p>
      ) : null}
    </div>
  );
}

const QUESTION_LABELS: Record<string, string> = {
  scope: 'Scope',
  angle: 'Angle',
  end_goal: 'End goal',
  priors: 'Priors',
  synthesis: 'Ranking criteria',
};

function labelFor(id: string) {
  return QUESTION_LABELS[id] ?? id;
}

function TurnBlock({ turn }: { turn: InterviewTurn }) {
  const step = turn.agent_step;
  const answer = turn.user_answer?.text ?? null;

  if (step.type === 'plan') {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-sm">
        <p className="mb-2 font-medium">Before we start</p>
        <Markdown className="text-muted-foreground">{step.summary}</Markdown>
        {step.will_ask.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            I&apos;ll ask you about: {step.will_ask.map(labelFor).join(', ')}
          </p>
        ) : null}
        {step.will_skip.length > 0 ? (
          <ul className="mt-1 text-xs text-muted-foreground">
            {step.will_skip.map((s) => (
              <li key={s.question}>
                Skipping <span className="font-medium">{labelFor(s.question)}</span> — {s.reason}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (step.type === 'question' || step.type === 'pushback') {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-md border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {step.type === 'pushback'
              ? `Quick clarification · ${labelFor(step.question_id)}`
              : labelFor(step.question_id)}
          </p>
          <Markdown className="mt-1">{step.type === 'question' ? step.prompt : step.message}</Markdown>
          {step.type === 'question' && step.dimensions?.length ? (
            <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
              {step.dimensions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
          {step.type === 'question' && step.example ? (
            <p className="mt-2 text-xs text-muted-foreground">Example: {step.example}</p>
          ) : null}
          {step.type === 'pushback' ? (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {step.options.map((o) => (
                <li key={o.label}>
                  <span className="font-medium">{o.label}</span> — {o.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {answer ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your answer</p>
            <p className="mt-1 whitespace-pre-wrap">{answer}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (step.type === 'complete') {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium">Framing complete</p>
        <p className="mt-1 text-muted-foreground">Title: {step.title}</p>
      </div>
    );
  }

  return null;
}

function AnswerComposer({ subjectId, turn }: { subjectId: string; turn: InterviewTurn }) {
  const step = turn.agent_step;
  const choices = useMemo(
    () =>
      step.type === 'question' && step.choices
        ? step.choices
        : step.type === 'pushback'
          ? step.options.map((o) => o.label)
          : [],
    [step],
  );
  const hasChoices = choices.length > 0;

  const [mode, setMode] = useState<'select' | 'write'>(hasChoices ? 'select' : 'write');
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentAnswer = mode === 'select' ? selected.join(', ') : text;
  const canSubmit = currentAnswer.trim().length > 0;

  function toggleChoice(choice: string) {
    setSelected((prev) => (prev.includes(choice) ? prev.filter((c) => c !== choice) : [...prev, choice]));
  }

  function submit() {
    const value = currentAnswer.trim();
    if (!value) {
      setError(mode === 'select' ? 'Select at least one option.' : 'Write an answer.');
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set('subjectId', subjectId);
    formData.set('turnId', turn.id);
    formData.set('answer', value);
    startTransition(async () => {
      const result = await answerInterviewAction(formData);
      if (result && 'error' in result) setError(result.error ?? 'Something went wrong');
      else {
        setSelected([]);
        setText('');
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3"
    >
      {hasChoices ? (
        <div className="inline-flex gap-1 self-start rounded-md bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('select')}
            className={`rounded px-3 py-1 transition ${mode === 'select' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Select
          </button>
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`rounded px-3 py-1 transition ${mode === 'write' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Write my own
          </button>
        </div>
      ) : null}

      {mode === 'select' && hasChoices ? (
        <div className="flex flex-wrap gap-2">
          {choices.map((choice) => {
            const isSelected = selected.includes(choice);
            return (
              <Button
                key={choice}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                disabled={pending}
                onClick={() => toggleChoice(choice)}
              >
                {choice}
              </Button>
            );
          })}
        </div>
      ) : (
        <Textarea
          name="answer"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your answer…"
          rows={3}
          disabled={pending}
        />
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? 'Sending…' : 'Send answer'}
        </Button>
      </div>
    </form>
  );
}

function ThinkingIndicator() {
  const [tick, setTick] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, []);

  const dots = tick % 4;
  const elapsed = Math.floor((Date.now() - startRef.current) / 1000);

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
      <span className="tabular-nums">{elapsed}s</span>
      <span className="inline-block min-w-[5rem]">Thinking{'.'.repeat(dots)}</span>
    </div>
  );
}

function FinalizingScreen() {
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
        <p className="text-base font-medium">Putting it all together{'.'.repeat(dots)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Writing your research brief, the lexicon, and the open questions.
          <br />
          This usually takes 45–90 seconds.
        </p>
      </div>
    </div>
  );
}
