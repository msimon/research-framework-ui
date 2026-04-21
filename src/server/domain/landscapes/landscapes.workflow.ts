import 'server-only';
import { hasToolCall, stepCountIs, streamText, tool } from 'ai';

import { LANDSCAPE_SYSTEM_PROMPT } from '@/prompts/landscape/landscape.prompt';
import { type LandscapeUpdates, landscapeUpdatesSchema } from '@/prompts/landscape/landscape.schema';
import {
  completeLandscape,
  failLandscape,
  startLandscape,
} from '@/server/domain/landscapes/landscapes.command';
import { findSourcesByTopic } from '@/server/domain/landscapes/landscapes.repository';
import { getSubjectById } from '@/server/domain/subjects/subjects.repository';
import { findTopicBySlug } from '@/server/domain/topics/topics.repository';
import {
  anthropicModel,
  anthropicProviderOptions,
  anthropicWebSearchTool,
} from '@/server/infra/anthropic/anthropic.client';
import { type EntityChannelName, supabaseBroadcastClient } from '@/server/infra/supabase/realtime';

export type LandscapeWorkflowInput = {
  userId: string;
  subjectId: string;
  topicSlug: string;
  landscapeId: string;
};

export type LandscapeWorkflowResult = {
  landscapeId: string;
  contentMd: string;
};

export async function runLandscapeWorkflow(input: LandscapeWorkflowInput): Promise<LandscapeWorkflowResult> {
  const subject = await getSubjectById(input.userId, input.subjectId);
  const topic = await findTopicBySlug(subject.id, input.topicSlug);
  if (!topic) throw new Error(`Topic ${input.topicSlug} not found`);

  const existingSources = await findSourcesByTopic(topic.id);
  await startLandscape(input.landscapeId);

  const channel: EntityChannelName = `landscape:${input.landscapeId}`;
  const client = supabaseBroadcastClient();
  const broadcast = client.channel(channel);
  let seq = 0;

  const send = (payload: Record<string, unknown>) => {
    broadcast.send({
      type: 'broadcast',
      event: 'event',
      payload: { landscapeId: input.landscapeId, seq: seq++, ...payload },
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

    let markdown = '';

    const result = streamText({
      model: anthropicModel(),
      tools: {
        web_search: anthropicWebSearchTool({ maxUses: 8 }),
        emit_updates: tool({
          description:
            'Emit structured updates to append to the subject brief, lexicon, and open questions, plus the canonical source list. Call exactly once when the landscape markdown is complete.',
          inputSchema: landscapeUpdatesSchema,
        }),
      },
      stopWhen: [stepCountIs(20), hasToolCall('emit_updates')],
      messages: buildLandscapeMessages({
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
        existingSourceUrls: existingSources.map((s) => s.url),
      }),
      providerOptions: { anthropic: anthropicProviderOptions },
      onChunk({ chunk }) {
        if (chunk.type === 'text-delta') {
          markdown += chunk.text;
          send({ type: 'text', delta: chunk.text });
        } else if (chunk.type === 'reasoning-delta') {
          send({ type: 'reasoning', delta: chunk.text });
        } else if (chunk.type === 'tool-call') {
          if (chunk.toolName === 'web_search') {
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
    const emitCall = allToolCalls.find((c) => c.toolName === 'emit_updates');
    if (!emitCall) {
      throw new Error('Landscape model did not call emit_updates');
    }
    const updates = emitCall.input as LandscapeUpdates;

    const totalUsage = await result.totalUsage;
    const webSearchCount = allToolCalls.filter((c) => c.toolName === 'web_search').length;
    console.info(
      `[landscape] subject=${subject.slug} topic=${topic.slug} steps=${steps.length} web_search=${webSearchCount} input_tokens=${totalUsage.inputTokens ?? 0} cached_input_tokens=${totalUsage.cachedInputTokens ?? 0} output_tokens=${totalUsage.outputTokens ?? 0}`,
    );

    await completeLandscape({
      landscapeId: input.landscapeId,
      topicId: topic.id,
      subjectId: subject.id,
      subject: {
        research_brief_md: subject.research_brief_md,
        lexicon_md: subject.lexicon_md,
        open_questions_md: subject.open_questions_md,
      },
      topicTitle: topic.title,
      topicSlug: topic.slug,
      contentMd: markdown,
      briefAppend: updates.research_brief_append,
      lexiconAdds: updates.lexicon_adds,
      openQuestionAdds: updates.open_questions_adds,
      sources: updates.sources,
    });

    send({ type: 'complete' });

    return { landscapeId: input.landscapeId, contentMd: markdown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failLandscape(input.landscapeId, message);
    send({ type: 'error', message });
    throw error;
  } finally {
    await client.removeChannel(broadcast);
  }
}

function buildLandscapeMessages(input: {
  subjectSlug: string;
  researchBriefMd: string;
  lexiconMd: string;
  openQuestionsMd: string;
  topic: { slug: string; title: string; pitch: string; rationale: string; category: string };
  existingSourceUrls: string[];
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
  ].join('\n');

  const topicBlock = [
    '## Topic to landscape',
    `- **slug**: \`${input.topic.slug}\``,
    `- **title**: ${input.topic.title}`,
    `- **category**: ${input.topic.category}`,
    `- **pitch**: ${input.topic.pitch}`,
    `- **rationale**: ${input.topic.rationale || '_(none)_'}`,
    '',
    input.existingSourceUrls.length > 0
      ? `Existing sources already on this topic (don't re-cite these unless substantively richer):\n${input.existingSourceUrls.map((u) => `- ${u}`).join('\n')}`
      : 'No sources have been captured on this topic yet.',
    '',
    'Write the full landscape markdown now. When the markdown is complete, call `emit_updates` exactly once with the structured payload.',
  ].join('\n');

  return [
    {
      role: 'system' as const,
      content: LANDSCAPE_SYSTEM_PROMPT,
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
        { type: 'text' as const, text: topicBlock },
      ],
    },
  ];
}
