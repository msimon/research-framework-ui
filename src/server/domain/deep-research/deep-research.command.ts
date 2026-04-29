import 'server-only';
import { hasToolCall, stepCountIs, streamText, tool } from 'ai';

import { DEEP_RESEARCH_SYSTEM_PROMPT } from '@/prompts/deep-research/deep-research.prompt';
import { deepResearchTurnSchema } from '@/prompts/deep-research/deep-research.schema';
import type { LexiconEntry } from '@/prompts/landscape/landscape.schema';
import {
  createSession,
  createTurn,
  getSessionById,
  getTurnById,
  insertTurnSources,
  listTurnsForSession,
  updateSession,
  updateTurn,
} from '@/server/domain/deep-research/deep-research.repository';
import { findLandscapeByTopic } from '@/server/domain/landscapes/landscapes.repository';
import { getSubjectById, updateSubject } from '@/server/domain/subjects/subjects.repository';
import { getTopicById, updateTopic } from '@/server/domain/topics/topics.repository';
import {
  anthropicModel,
  anthropicProviderOptions,
  anthropicWebSearchTool,
} from '@/server/infra/anthropic/anthropic.client';
import { type EntityChannelName, supabaseBroadcastClient } from '@/server/infra/supabase/realtime';
import { waitForBroadcastSubscription } from '@/server/infra/supabase/realtime.utils';
import { buildCitationOutput, type CitationBlock } from '@/server/lib/utils/build-citation-output.util';
import { dedupSupportingAgainstCited } from '@/server/lib/utils/dedup-supporting-sources.util';
import { logCitationDebug } from '@/server/lib/utils/log-citation-debug.util';
import type { CitationEntry } from '@/shared/citation.type';
import { serverConfig } from '@/shared/config/server.config';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type TurnRow = Database['public']['Tables']['deep_research_turns']['Row'];

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
  sessionId: string;
  topicId: string;
  findingsMd: string;
  myReadMd: string;
  followupQuestion: string;
  reasoningMd: string;
  toolCalls: unknown[];
  citationMap: CitationEntry[];
  citedSources: Array<{ url: string; title: string | null }>;
  supportingSources: Array<{ url: string; title: string | null }>;
  modelUsed: string;
  insights: PersistedInsight[];
  lexiconAdds: LexiconEntry[];
  subjectId: string;
  subjectLexiconMd: string;
  topicTitle: string;
};

async function completeTurn(input: CompleteTurnInput): Promise<void> {
  const turn = await getTurnById(input.turnId);

  await updateTurn(input.turnId, {
    findings_md: input.findingsMd,
    my_read_md: input.myReadMd,
    followup_question: input.followupQuestion,
    reasoning_md: input.reasoningMd,
    tool_calls: input.toolCalls as never,
    citation_map: input.citationMap,
    supporting_sources: input.supportingSources,
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

  const sourceRows = [...input.citedSources, ...input.supportingSources].map((s) => ({
    topic_id: input.topicId,
    turn_id: input.turnId,
    session_id: input.sessionId,
    landscape_id: null,
    url: s.url,
    title: s.title,
  }));
  if (sourceRows.length > 0) {
    await insertTurnSources(sourceRows);
  }
}

export type RunDeepResearchTurnInput = {
  userId: string;
  sessionId: string;
  turnId: string;
};

export type RunDeepResearchTurnResult = {
  turnId: string;
};

export async function runDeepResearchTurn(
  input: RunDeepResearchTurnInput,
): Promise<RunDeepResearchTurnResult> {
  const session = await getSessionById(input.sessionId);
  const topic = await getTopicById(session.topic_id);
  const subject = await getSubjectById(input.userId, topic.subject_id);
  const landscape = await findLandscapeByTopic(topic.id);
  const turn = await getTurnById(input.turnId);
  const priorTurns = (await listTurnsForSession(session.id)).filter((t) => t.id !== input.turnId);

  const channel: EntityChannelName = `session:${input.sessionId}`;
  const client = supabaseBroadcastClient();
  const broadcast = client.channel(channel, { config: { private: true } });
  let seq = 0;

  const send = (payload: Record<string, unknown>) => {
    broadcast.send({
      type: 'broadcast',
      event: 'event',
      payload: { sessionId: input.sessionId, turnId: input.turnId, seq: seq++, ...payload },
    });
  };

  try {
    await waitForBroadcastSubscription(broadcast);

    send({ type: 'status', status: 'streaming' });

    const FINDINGS_MARKER = /(?:^|\n)# Findings\s*\n+/;
    let pending = '';
    let markerFound = false;
    let reasoningBuffer = '';
    const toolCallsLog: Array<{ id: string; name: string; input: unknown }> = [];
    // Per-block accumulators (see landscapes.command.ts for the rationale).
    const blocks: CitationBlock[] = [];
    const blockById = new Map<string, CitationBlock>();
    let currentBlockId: string | null = null;
    const supportingSources: Array<{ url: string; title: string | null }> = [];

    const result = streamText({
      model: anthropicModel(),
      tools: {
        web_search: anthropicWebSearchTool({ maxUses: 10 }),
        emit_turn: tool({
          description:
            'Emit structured byproducts: my read, follow-up question, lexicon adds, insights, sources. Call exactly once after the findings markdown is complete.',
          inputSchema: deepResearchTurnSchema,
        }),
      },
      stopWhen: [stepCountIs(15), hasToolCall('emit_turn')],
      messages: buildDeepResearchMessages({
        subjectSlug: subject.slug,
        researchBriefMd: subject.research_brief_md,
        lexiconMd: subject.lexicon_md,
        openQuestionsMd: subject.open_questions_md,
        topic: {
          slug: topic.slug,
          title: topic.title,
          pitch: topic.pitch,
          rationale: topic.rationale,
          category: topic.category,
        },
        landscapeMd: landscape?.content_md ?? '',
        seedQuestion: session.seed_question,
        priorTurns,
        currentUserText: turn.user_text ?? '',
      }),
      providerOptions: { anthropic: anthropicProviderOptions },
    });

    // Iterate fullStream directly so we receive text-start / text-end events
    // (block boundaries) — these aren't delivered via the narrower onChunk
    // callback in @ai-sdk/anthropic 4.0+.
    for await (const part of result.fullStream) {
      logCitationDebug(`deep-research:turn=${input.turnId}`, part);
      if (part.type === 'text-start') {
        const block: CitationBlock = { text: '', citations: [] };
        blocks.push(block);
        blockById.set(part.id, block);
        currentBlockId = part.id;
      } else if (part.type === 'text-end') {
        if (currentBlockId === part.id) currentBlockId = null;
      } else if (part.type === 'text-delta') {
        const block = blockById.get(part.id);
        if (block) block.text += part.text;
        if (markerFound) {
          send({ type: 'text', delta: part.text });
        } else {
          pending += part.text;
          const match = FINDINGS_MARKER.exec(pending);
          if (match) {
            markerFound = true;
            const after = pending.slice(match.index + match[0].length);
            pending = '';
            if (after.length > 0) send({ type: 'text', delta: after });
          }
        }
      } else if (part.type === 'reasoning-delta') {
        reasoningBuffer += part.text;
        send({ type: 'reasoning', delta: part.text });
      } else if (part.type === 'tool-call') {
        if (part.toolName === 'web_search') {
          toolCallsLog.push({ id: part.toolCallId, name: part.toolName, input: part.input });
          send({
            type: 'tool_call',
            id: part.toolCallId,
            name: part.toolName,
            input: part.input,
          });
        }
      } else if (part.type === 'tool-result') {
        if (part.toolName === 'web_search') {
          send({
            type: 'tool_result',
            id: part.toolCallId,
            name: part.toolName,
          });
        }
      } else if (part.type === 'source' && part.sourceType === 'url') {
        const citedText = (part.providerMetadata?.anthropic as { citedText?: unknown } | undefined)
          ?.citedText;
        if (typeof citedText === 'string' && currentBlockId !== null) {
          const block = blockById.get(currentBlockId);
          if (!block) continue;
          const entry: CitationEntry = {
            url: part.url,
            title: part.title ?? null,
            cited_text: citedText,
          };
          block.citations.push(entry);
          send({ type: 'citation', ...entry });
        } else {
          const entry = { url: part.url, title: part.title ?? null };
          supportingSources.push(entry);
          send({ type: 'supporting_source', ...entry });
        }
      }
    }

    const steps = await result.steps;
    const allToolCalls = steps.flatMap((s) => s.toolCalls);
    const emitCall = allToolCalls.find((c) => c.toolName === 'emit_turn');
    if (!emitCall) throw new Error('Deep-research model did not call emit_turn');
    const turnOutput = deepResearchTurnSchema.parse(emitCall.input);

    const totalUsage = await result.totalUsage;
    const webSearchCount = allToolCalls.filter((c) => c.toolName === 'web_search').length;
    console.info(
      `[deep-research] subject=${subject.slug} topic=${topic.slug} session=${session.id} turn=${turn.turn_number} steps=${steps.length} web_search=${webSearchCount} input_tokens=${totalUsage.inputTokens ?? 0} cached_input_tokens=${totalUsage.cachedInputTokens ?? 0} output_tokens=${totalUsage.outputTokens ?? 0}`,
    );

    // Per-turn Sources lists coexist on the same session page, so anchors
    // are turn-scoped to stay unique.
    const {
      markdown: assembledMd,
      sources: citedSources,
      citationMap,
    } = buildCitationOutput(blocks, `turn-${turn.turn_number}-`);
    const endMatch = FINDINGS_MARKER.exec(assembledMd);
    const findingsMd = endMatch ? assembledMd.slice(endMatch.index + endMatch[0].length) : assembledMd;
    const dedupedSupportingSources = dedupSupportingAgainstCited(supportingSources, citedSources);

    await completeTurn({
      turnId: input.turnId,
      sessionId: input.sessionId,
      topicId: topic.id,
      findingsMd,
      myReadMd: turnOutput.my_read_md,
      followupQuestion: turnOutput.followup_question,
      reasoningMd: reasoningBuffer,
      toolCalls: toolCallsLog,
      citationMap,
      citedSources,
      supportingSources: dedupedSupportingSources,
      modelUsed: serverConfig.llm.model,
      insights: turnOutput.insights,
      lexiconAdds: turnOutput.lexicon_adds,
      subjectId: subject.id,
      subjectLexiconMd: subject.lexicon_md,
      topicTitle: topic.title,
    });

    send({ type: 'complete' });

    return { turnId: input.turnId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateTurn(input.turnId, { status: 'failed', error_message: message });
    send({ type: 'error', message });
    throw error;
  } finally {
    await client.removeChannel(broadcast);
  }
}

function buildDeepResearchMessages(input: {
  subjectSlug: string;
  researchBriefMd: string;
  lexiconMd: string;
  openQuestionsMd: string;
  topic: { slug: string; title: string; pitch: string; rationale: string; category: string };
  landscapeMd: string;
  seedQuestion: string;
  priorTurns: TurnRow[];
  currentUserText: string;
}) {
  const stable = [
    `Subject slug: \`${input.subjectSlug}\`.`,
    '',
    '## Subject research brief',
    input.researchBriefMd || '_(empty)_',
    '',
    '## Subject lexicon',
    input.lexiconMd || '_(empty)_',
    '',
    '## Subject open questions',
    input.openQuestionsMd || '_(empty)_',
    '',
    '## Topic under investigation',
    `- **slug**: \`${input.topic.slug}\``,
    `- **title**: ${input.topic.title}`,
    `- **category**: ${input.topic.category}`,
    `- **pitch**: ${input.topic.pitch}`,
    `- **rationale**: ${input.topic.rationale || '_(none)_'}`,
    '',
    '## Topic landscape',
    input.landscapeMd || '_(no landscape run yet)_',
    '',
    '## Session seed question',
    input.seedQuestion,
  ].join('\n');

  const history = input.priorTurns
    .filter((t) => t.status === 'complete')
    .map((t) => {
      const blocks = [
        `### Turn ${t.turn_number}`,
        `**User:** ${t.user_text ?? '_(no prompt)_'}`,
        '',
        `**Findings:** ${t.findings_md ?? '_(no findings)_'}`,
        '',
        `**My read:** ${t.my_read_md ?? '_(no interpretation)_'}`,
        '',
        `**Follow-up:** ${t.followup_question ?? ''}`,
      ];
      return blocks.join('\n');
    })
    .join('\n\n');

  const historyBlock =
    input.priorTurns.length === 0
      ? 'This is the first turn of the session. Treat the seed question as the user message.'
      : `## Prior turns in this session\n\n${history}`;

  const currentBlock = [
    '## Current user message',
    input.currentUserText || '_(no message)_',
    '',
    'Respond for THIS turn only. Run web_search as needed, then call `emit_turn` EXACTLY ONCE with the structured payload.',
  ].join('\n');

  return [
    {
      role: 'system' as const,
      content: DEEP_RESEARCH_SYSTEM_PROMPT,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: stable,
          providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
        },
        { type: 'text' as const, text: historyBlock },
        { type: 'text' as const, text: currentBlock },
      ],
    },
  ];
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
