import 'server-only';
import { hasToolCall, stepCountIs, streamText, tool } from 'ai';

import { DEEP_RESEARCH_SYSTEM_PROMPT } from '@/prompts/deep-research/deep-research.prompt';
import { type DeepResearchTurn, deepResearchTurnSchema } from '@/prompts/deep-research/deep-research.schema';
import { completeTurn, failTurn } from '@/server/domain/deep-research/deep-research.command';
import {
  getSessionById,
  getTurnById,
  insertTurnSources,
  listTurnsForSession,
} from '@/server/domain/deep-research/deep-research.repository';
import { findLandscapeByTopic } from '@/server/domain/landscapes/landscapes.repository';
import { getSubjectById } from '@/server/domain/subjects/subjects.repository';
import { getTopicById } from '@/server/domain/topics/topics.repository';
import {
  anthropicModel,
  anthropicProviderOptions,
  anthropicWebSearchTool,
} from '@/server/infra/anthropic/anthropic.client';
import { type EntityChannelName, supabaseBroadcastClient } from '@/server/infra/supabase/realtime';
import { serverConfig } from '@/shared/config/server.config';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type TurnRow = Database['public']['Tables']['deep_research_turns']['Row'];

export type DeepResearchWorkflowInput = {
  userId: string;
  sessionId: string;
  turnId: string;
};

export type DeepResearchWorkflowResult = {
  turnId: string;
};

export async function runDeepResearchTurnWorkflow(
  input: DeepResearchWorkflowInput,
): Promise<DeepResearchWorkflowResult> {
  const session = await getSessionById(input.sessionId);
  const topic = await getTopicById(session.topic_id);
  const subject = await getSubjectById(input.userId, topic.subject_id);
  const landscape = await findLandscapeByTopic(topic.id);
  const turn = await getTurnById(input.turnId);
  const priorTurns = (await listTurnsForSession(session.id)).filter((t) => t.id !== input.turnId);

  const channel: EntityChannelName = `session:${input.sessionId}`;
  const client = supabaseBroadcastClient();
  const broadcast = client.channel(channel);
  let seq = 0;

  const send = (payload: Record<string, unknown>) => {
    broadcast.send({
      type: 'broadcast',
      event: 'event',
      payload: { sessionId: input.sessionId, turnId: input.turnId, seq: seq++, ...payload },
    });
  };

  try {
    await new Promise<void>((resolve, reject) => {
      broadcast.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          reject(new Error(`Broadcast channel ${status}`));
        }
      });
    });

    send({ type: 'status', status: 'streaming' });

    const FINDINGS_MARKER = /(?:^|\n)# Findings\s*\n+/;
    let pending = '';
    let markerFound = false;
    let reasoningBuffer = '';
    const toolCallsLog: Array<{ id: string; name: string; input: unknown }> = [];

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
      onChunk({ chunk }) {
        if (chunk.type === 'text-delta') {
          if (markerFound) {
            send({ type: 'text', delta: chunk.text });
          } else {
            pending += chunk.text;
            const match = FINDINGS_MARKER.exec(pending);
            if (match) {
              markerFound = true;
              const after = pending.slice(match.index + match[0].length);
              pending = '';
              if (after.length > 0) send({ type: 'text', delta: after });
            }
          }
        } else if (chunk.type === 'reasoning-delta') {
          reasoningBuffer += chunk.text;
          send({ type: 'reasoning', delta: chunk.text });
        } else if (chunk.type === 'tool-call') {
          if (chunk.toolName === 'web_search') {
            toolCallsLog.push({ id: chunk.toolCallId, name: chunk.toolName, input: chunk.input });
            send({
              type: 'tool_call',
              id: chunk.toolCallId,
              name: chunk.toolName,
              input: chunk.input,
            });
          }
        } else if (chunk.type === 'tool-result') {
          if (chunk.toolName === 'web_search') {
            send({
              type: 'tool_result',
              id: chunk.toolCallId,
              name: chunk.toolName,
            });
          }
        }
      },
    });

    await result.consumeStream();

    const steps = await result.steps;
    const allToolCalls = steps.flatMap((s) => s.toolCalls);
    const emitCall = allToolCalls.find((c) => c.toolName === 'emit_turn');
    if (!emitCall) throw new Error('Deep-research model did not call emit_turn');
    const turnOutput = emitCall.input as DeepResearchTurn;

    const totalUsage = await result.totalUsage;
    const webSearchCount = allToolCalls.filter((c) => c.toolName === 'web_search').length;
    console.info(
      `[deep-research] subject=${subject.slug} topic=${topic.slug} session=${session.id} turn=${turn.turn_number} steps=${steps.length} web_search=${webSearchCount} input_tokens=${totalUsage.inputTokens ?? 0} cached_input_tokens=${totalUsage.cachedInputTokens ?? 0} output_tokens=${totalUsage.outputTokens ?? 0}`,
    );

    const finalText = await result.text;
    const endMatch = FINDINGS_MARKER.exec(finalText);
    const findingsMd = endMatch ? finalText.slice(endMatch.index + endMatch[0].length) : finalText;

    await completeTurn({
      turnId: input.turnId,
      findingsMd,
      myReadMd: turnOutput.my_read_md,
      followupQuestion: turnOutput.followup_question,
      reasoningMd: reasoningBuffer,
      toolCalls: toolCallsLog,
      modelUsed: serverConfig.llm.model,
      insights: turnOutput.insights,
      lexiconAdds: turnOutput.lexicon_adds,
      subjectId: subject.id,
      subjectLexiconMd: subject.lexicon_md,
      topicTitle: topic.title,
    });

    if (turnOutput.sources.length > 0) {
      await insertTurnSources(
        turnOutput.sources.map((s) => ({
          topic_id: topic.id,
          turn_id: input.turnId,
          landscape_id: null,
          url: s.url,
          title: s.title ?? null,
          snippet: s.snippet ?? null,
        })),
      );
    }

    send({ type: 'complete' });

    return { turnId: input.turnId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failTurn(input.turnId, message);
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
