import 'server-only';
import { generateText, hasToolCall, stepCountIs, tool } from 'ai';

import { DISCOVER_SYSTEM_PROMPT } from '@/prompts/discover/discover.prompt';
import { discoverResponseSchema } from '@/prompts/discover/discover.schema';
import type { LexiconEntry } from '@/prompts/landscape/landscape.schema';
import { getSubjectById } from '@/server/domain/subjects/subjects.repository';
import { createTopic, findTopicsBySubject } from '@/server/domain/topics/topics.repository';
import {
  anthropicModel,
  anthropicProviderOptions,
  anthropicWebSearchTool,
} from '@/server/infra/anthropic/anthropic.client';
import { type EntityChannelName, supabaseBroadcastClient } from '@/server/infra/supabase/realtime';

export type RunDiscoverInput = {
  userId: string;
  subjectId: string;
  narrowHint?: string;
};

export type RunDiscoverResult = {
  insertedCount: number;
  subjectSlug: string;
};

export async function runDiscover(input: RunDiscoverInput): Promise<RunDiscoverResult> {
  const subject = await getSubjectById(input.userId, input.subjectId);
  if (subject.status !== 'ready') {
    throw new Error(`Subject ${subject.slug} is not in ready state (status: ${subject.status})`);
  }

  const existingTopics = await findTopicsBySubject(subject.id);
  const existingSlugs = new Set(existingTopics.map((t) => t.slug));

  const channel: EntityChannelName = `subject:${subject.id}`;
  const client = supabaseBroadcastClient();
  const broadcast = client.channel(channel, { config: { private: true } });

  try {
    await new Promise<void>((resolve, reject) => {
      broadcast.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          reject(new Error(`Broadcast channel ${status}`));
        }
      });
    });
    broadcast.send({
      type: 'broadcast',
      event: 'event',
      payload: { subjectId: subject.id, type: 'discover:thinking' },
    });

    const result = await generateText({
      model: anthropicModel(),
      tools: {
        web_search: anthropicWebSearchTool({ maxUses: 5 }),
        emit_topics: tool({
          description:
            'Emit the final ranked list of discovered topics. Call this exactly once when enumeration is complete.',
          inputSchema: discoverResponseSchema,
        }),
      },
      stopWhen: [stepCountIs(15), hasToolCall('emit_topics')],
      system: {
        role: 'system',
        content: DISCOVER_SYSTEM_PROMPT,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      messages: buildDiscoverMessages({
        slug: subject.slug,
        seedProblemStatement: subject.seed_problem_statement,
        researchBriefMd: subject.research_brief_md,
        lexicon: subject.lexicon,
        openQuestionsMd: subject.open_questions_md,
        existingTopicSlugs: [...existingSlugs],
        narrowHint: input.narrowHint,
      }),
      providerOptions: { anthropic: anthropicProviderOptions },
    });

    const allToolCalls = result.steps.flatMap((step) => step.toolCalls);
    const webSearchCount = allToolCalls.filter((c) => c.toolName === 'web_search').length;
    const totalIn = result.totalUsage.inputTokens ?? 0;
    const totalOut = result.totalUsage.outputTokens ?? 0;
    const cachedIn = result.totalUsage.cachedInputTokens ?? 0;
    console.info(
      `[discover] subject=${subject.slug} steps=${result.steps.length} web_search=${webSearchCount} input_tokens=${totalIn} cached_input_tokens=${cachedIn} output_tokens=${totalOut}${input.narrowHint ? ` hint="${input.narrowHint}"` : ''}`,
    );

    const emitCall = allToolCalls.find((call) => call.toolName === 'emit_topics');
    if (!emitCall) {
      throw new Error('Discover model did not call emit_topics');
    }
    const response = discoverResponseSchema.parse(emitCall.input);

    let sortOrder = existingTopics.length;
    let insertedCount = 0;

    for (const topic of response.topics) {
      if (existingSlugs.has(topic.slug)) continue;
      existingSlugs.add(topic.slug);

      await createTopic({
        subject_id: subject.id,
        slug: topic.slug,
        title: topic.title,
        pitch: topic.pitch,
        rationale: topic.rationale,
        category: topic.category,
        status: 'discovered',
        sort_order: sortOrder,
        discover_hint: input.narrowHint ?? null,
      });
      sortOrder += 1;
      insertedCount += 1;
    }

    broadcast.send({
      type: 'broadcast',
      event: 'event',
      payload: {
        subjectId: subject.id,
        type: 'discover:complete',
        insertedCount,
      },
    });

    return { insertedCount, subjectSlug: subject.slug };
  } finally {
    await client.removeChannel(broadcast);
  }
}

function buildDiscoverMessages(input: {
  slug: string;
  seedProblemStatement: string | null;
  researchBriefMd: string;
  lexicon: LexiconEntry[];
  openQuestionsMd: string;
  existingTopicSlugs: string[];
  narrowHint?: string;
}) {
  const stable = [
    `Subject slug: \`${input.slug}\`.`,
    input.seedProblemStatement
      ? `Seed problem statement: "${input.seedProblemStatement}".`
      : 'No seed problem statement was provided.',
    '',
    '## Research brief',
    input.researchBriefMd || '_(empty)_',
    '',
    '## Lexicon',
    'Domain vocabulary already captured. JSON array of `{ kind, label, expansion?, definition }` entries.',
    '```json',
    JSON.stringify(input.lexicon, null, 2),
    '```',
    '',
    '## Open questions',
    input.openQuestionsMd || '_(empty)_',
  ].join('\n');

  const dynamicParts = [
    '## Already-discovered topic slugs (do not duplicate)',
    input.existingTopicSlugs.length > 0 ? input.existingTopicSlugs.join(', ') : '_(none)_',
    '',
  ];
  if (input.narrowHint) {
    dynamicParts.push(
      '## Narrow hint from the user',
      `The earlier pass missed topics around: "${input.narrowHint}". Bias this enumeration toward that hint and its neighborhood. Fewer topics is fine if they are more on-point.`,
      '',
    );
  }
  dynamicParts.push(
    input.narrowHint
      ? 'Enumerate candidate research topics focused on the narrow hint, ranked most-important-first, and return them by calling `emit_topics`.'
      : 'Enumerate up to 10 candidate research topics, ranked most-important-first, and return them by calling `emit_topics`.',
  );
  const dynamic = dynamicParts.join('\n');

  return [
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: stable,
          providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
        },
        { type: 'text' as const, text: dynamic },
      ],
    },
  ];
}
