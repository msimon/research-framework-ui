import {
  createSession,
  createTurn,
  getSessionById,
  getTurnById,
  listTurnsForSession,
  updateSession,
  updateTurn,
} from '@/server/domain/deep-research/deep-research.repository';
import { getSubjectById, updateSubject } from '@/server/domain/subjects/subjects.repository';
import { getTopicById, updateTopic } from '@/server/domain/topics/topics.repository';

export type StartSessionInput = {
  userId: string;
  topicId: string;
  seedQuestion: string;
};

export type StartSessionResult = {
  sessionId: string;
  turnId: string;
};

export async function startSession(input: StartSessionInput): Promise<StartSessionResult> {
  const topic = await getTopicById(input.topicId);
  const subject = await getSubjectById(input.userId, topic.subject_id);
  if (subject.user_id !== input.userId) throw new Error('Subject not owned by user');

  const session = await createSession({
    topic_id: input.topicId,
    seed_question: input.seedQuestion.trim(),
    status: 'active',
  });

  const turn = await createTurn({
    session_id: session.id,
    turn_number: 1,
    role: 'agent',
    user_text: input.seedQuestion.trim(),
    status: 'streaming',
  });

  return { sessionId: session.id, turnId: turn.id };
}

export type SubmitTurnInput = {
  userId: string;
  sessionId: string;
  userText: string;
};

export type SubmitTurnResult = {
  turnId: string;
};

export async function submitTurn(input: SubmitTurnInput): Promise<SubmitTurnResult> {
  const session = await getSessionById(input.sessionId);
  if (session.status !== 'active') throw new Error('Session is closed');

  const topic = await getTopicById(session.topic_id);
  const subject = await getSubjectById(input.userId, topic.subject_id);
  if (subject.user_id !== input.userId) throw new Error('Subject not owned by user');

  const existing = await listTurnsForSession(input.sessionId);
  const nextNumber = existing.length + 1;

  const turn = await createTurn({
    session_id: input.sessionId,
    turn_number: nextNumber,
    role: 'agent',
    user_text: input.userText.trim(),
    status: 'streaming',
  });

  return { turnId: turn.id };
}

type PersistedInsight = { text: string };

type LexiconEntry = {
  kind: 'abbreviation' | 'term' | 'entity';
  label: string;
  expansion?: string;
  definition: string;
};

function isInsight(value: unknown): value is PersistedInsight {
  return (
    typeof value === 'object' && value !== null && typeof (value as { text?: unknown }).text === 'string'
  );
}

export async function closeSession(userId: string, sessionId: string): Promise<void> {
  const session = await getSessionById(sessionId);
  if (session.status === 'closed') return;

  const topic = await getTopicById(session.topic_id);
  const subject = await getSubjectById(userId, topic.subject_id);
  if (subject.user_id !== userId) throw new Error('Subject not owned by user');

  const turns = await listTurnsForSession(sessionId);
  const completed = turns.filter((t) => t.status === 'complete');

  const insights: PersistedInsight[] = [];
  for (const t of completed) {
    const raw = t.insights;
    if (Array.isArray(raw)) {
      for (const entry of raw) if (isInsight(entry)) insights.push(entry);
    }
  }

  const summaryMd = buildSessionSummary({
    topicTitle: topic.title,
    seedQuestion: session.seed_question,
    turns: completed,
  });

  const updatedBrief = promoteInsightsToBrief({
    current: subject.research_brief_md,
    topicTitle: topic.title,
    seedQuestion: session.seed_question,
    insights,
  });

  await updateSubject(subject.id, { research_brief_md: updatedBrief });

  if (topic.status === 'landscape' || topic.status === 'discovered') {
    await updateTopic(topic.id, { status: 'deep' });
  }

  await updateSession(sessionId, {
    status: 'closed',
    summary_md: summaryMd,
    closed_at: new Date().toISOString(),
  });
}

type CompleteTurnInput = {
  turnId: string;
  findingsMd: string;
  myReadMd: string;
  followupQuestion: string;
  reasoningMd: string;
  toolCalls: unknown[];
  modelUsed: string;
  insights: PersistedInsight[];
  lexiconAdds: LexiconEntry[];
  subjectId: string;
  subjectLexiconMd: string;
  topicTitle: string;
};

export async function completeTurn(input: CompleteTurnInput): Promise<void> {
  const turn = await getTurnById(input.turnId);

  await updateTurn(input.turnId, {
    findings_md: input.findingsMd,
    my_read_md: input.myReadMd,
    followup_question: input.followupQuestion,
    reasoning_md: input.reasoningMd,
    tool_calls: input.toolCalls as never,
    model_used: input.modelUsed,
    insights: input.insights as never,
    status: 'complete',
    error_message: null,
  });

  await updateSession(turn.session_id, {
    turn_count: turn.turn_number,
    last_turn_at: new Date().toISOString(),
  });

  if (input.lexiconAdds.length > 0) {
    const merged = mergeDeepLexicon({
      current: input.subjectLexiconMd,
      topicTitle: input.topicTitle,
      entries: input.lexiconAdds,
    });
    if (merged !== input.subjectLexiconMd) {
      await updateSubject(input.subjectId, { lexicon_md: merged });
    }
  }
}

export async function failTurn(turnId: string, errorMessage: string): Promise<void> {
  await updateTurn(turnId, { status: 'failed', error_message: errorMessage });
}

function buildSessionSummary(input: {
  topicTitle: string;
  seedQuestion: string;
  turns: Array<{ turn_number: number; user_text: string | null; my_read_md: string | null }>;
}): string {
  const lines = [
    `# Deep research summary — ${input.topicTitle}`,
    '',
    `_Seed question: ${input.seedQuestion}_`,
    '',
    '## Turns',
  ];
  for (const t of input.turns) {
    const header = `### Turn ${t.turn_number}`;
    const prompt = t.user_text?.trim() || '_(no prompt)_';
    const read = t.my_read_md?.trim() || '_(no interpretation)_';
    lines.push(header, '', `**User:** ${prompt}`, '', `**My read:** ${read}`, '');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function promoteInsightsToBrief(input: {
  current: string;
  topicTitle: string;
  seedQuestion: string;
  insights: PersistedInsight[];
}): string {
  if (input.insights.length === 0) return input.current;

  const datestamp = new Date().toISOString().slice(0, 10);
  const heading = `## ${input.topicTitle}`;
  const subheading = `### Deep research ${datestamp} — ${input.seedQuestion}`;
  const block = input.insights.map((i) => `- ${i.text.trim()}`).join('\n');

  const base = input.current.trimEnd();
  return `${base}\n\n${heading}\n\n${subheading}\n\n${block}\n`;
}

function mergeDeepLexicon(input: { current: string; topicTitle: string; entries: LexiconEntry[] }): string {
  const existingLabels = new Set(
    [...input.current.matchAll(/(?:^|\n)-\s+\*\*([^*]+?)\*\*/g)].map((m) => m[1].trim().toLowerCase()),
  );
  const fresh = input.entries.filter((e) => !existingLabels.has(e.label.trim().toLowerCase()));
  if (fresh.length === 0) return input.current;

  const bullets = fresh.map((e) => {
    const expansion = e.expansion ? ` (${e.expansion.trim()})` : '';
    return `- **${e.label.trim()}**${expansion} — ${e.definition.trim()}`;
  });

  const heading = `## ${input.topicTitle} — deep research`;
  const lines = input.current.split('\n');
  const headingIdx = lines.findIndex((line) => line.trim() === heading);

  if (headingIdx === -1) {
    const base = input.current.trimEnd();
    return `${base}\n\n${heading}\n\n${bullets.join('\n')}\n`;
  }

  const nextHeadingIdx = lines.findIndex((line, idx) => idx > headingIdx && /^##\s/.test(line.trim()));
  const insertIdx = nextHeadingIdx === -1 ? lines.length : nextHeadingIdx;
  const before = lines.slice(0, insertIdx);
  const after = lines.slice(insertIdx);
  while (before.length > 0 && before[before.length - 1]?.trim() === '') before.pop();
  before.push('', ...bullets, '');

  return (
    [...before, ...after]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}
