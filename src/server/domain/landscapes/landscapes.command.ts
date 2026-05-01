import 'server-only';
import { hasToolCall, stepCountIs, streamText, tool } from 'ai';

import { LANDSCAPE_SYSTEM_PROMPT } from '@/prompts/landscape/landscape.prompt';
import {
  type LexiconEntry,
  landscapeUpdatesSchema,
  type OpenQuestionEntry,
} from '@/prompts/landscape/landscape.schema';
import {
  createLandscape,
  findLandscapeByTopic,
  updateLandscape,
} from '@/server/domain/landscapes/landscapes.repository';
import {
  findSourceTrustByUrls,
  upsertSourceTrustRows,
} from '@/server/domain/source-trust/source-trust.repository';
import { getSubjectById, updateSubject } from '@/server/domain/subjects/subjects.repository';
import { findTopicBySlug, updateTopic } from '@/server/domain/topics/topics.repository';
import {
  anthropicModel,
  anthropicProviderOptions,
  anthropicWebSearchTool,
} from '@/server/infra/anthropic/anthropic.client';
import { classifySources, type SourceTrustInput } from '@/server/infra/source-trust/source-trust.service';
import { type EntityChannelName, supabaseBroadcastClient } from '@/server/infra/supabase/realtime';
import { buildCitationOutput, type CitationBlock } from '@/server/lib/utils/build-citation-output.util';
import { dedupSupportingAgainstCited } from '@/server/lib/utils/dedup-supporting-sources.util';
import { mergeLexicon } from '@/server/lib/utils/merge-lexicon.util';
import { uniqueByUrl } from '@/server/lib/utils/unique-by-url.util';
import { waitForBroadcastSubscription } from '@/server/lib/utils/wait-for-broadcast-subscription.util';
import type { CitationEntry } from '@/shared/citation.type';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type LandscapeRow = Database['public']['Tables']['landscapes']['Row'];

export type RunLandscapeInput = {
  userId: string;
  subjectId: string;
  topicSlug: string;
  landscapeId: string;
};

export type RunLandscapeResult = {
  landscapeId: string;
  contentMd: string;
};

export async function getOrCreateLandscape(topicId: string): Promise<LandscapeRow> {
  const existing = await findLandscapeByTopic(topicId);
  if (existing) return existing;
  return createLandscape({ topic_id: topicId, status: 'pending', content_md: '' });
}

export async function runLandscape(input: RunLandscapeInput): Promise<RunLandscapeResult> {
  const subject = await getSubjectById(input.userId, input.subjectId);
  const topic = await findTopicBySlug(subject.id, input.topicSlug);
  if (!topic) throw new Error(`Topic ${input.topicSlug} not found`);

  await updateLandscape(input.landscapeId, {
    status: 'streaming',
    content_md: '',
    error_message: null,
  });

  const channel: EntityChannelName = `landscape:${input.landscapeId}`;
  const client = supabaseBroadcastClient();
  const broadcast = client.channel(channel, { config: { private: true } });
  let seq = 0;

  const send = (payload: Record<string, unknown>) => {
    broadcast.send({
      type: 'broadcast',
      event: 'event',
      payload: { landscapeId: input.landscapeId, seq: seq++, ...payload },
    });
  };

  try {
    await waitForBroadcastSubscription(broadcast);

    send({ type: 'status', status: 'streaming' });

    const blocks: CitationBlock[] = [];
    const blockById = new Map<string, CitationBlock>();
    let currentBlockId: string | null = null;
    // Search-result URLs returned by web_search but never attached as a
    // citation. Surfaced to the UI as "supporting material" under the cited
    // sources list.
    const supportingSources: Array<{ url: string; title: string | null }> = [];

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
      system: {
        role: 'system',
        content: LANDSCAPE_SYSTEM_PROMPT,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      messages: buildLandscapeMessages({
        subjectSlug: subject.slug,
        researchBriefMd: subject.research_brief_md,
        lexicon: subject.lexicon,
        openQuestionsMd: subject.open_questions_md,
        topic: {
          slug: topic.slug,
          title: topic.title,
          pitch: topic.pitch,
          rationale: topic.rationale,
          category: topic.category,
        },
      }),
      providerOptions: { anthropic: anthropicProviderOptions },
    });

    for await (const part of result.fullStream) {
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
        send({ type: 'text', delta: part.text });
      } else if (part.type === 'reasoning-delta') {
        send({ type: 'reasoning', delta: part.text });
      } else if (part.type === 'tool-call') {
        if (part.toolName === 'web_search') {
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
          // Citation-flavored: attach to the current text block.
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
          // Search-result-flavored: track for the supporting-material list.
          const entry = { url: part.url, title: part.title ?? null };
          supportingSources.push(entry);
          send({ type: 'supporting_source', ...entry });
        }
      }
    }

    const steps = await result.steps;
    const allToolCalls = steps.flatMap((s) => s.toolCalls);
    const emitCall = allToolCalls.find((c) => c.toolName === 'emit_updates');
    if (!emitCall) {
      throw new Error('Landscape model did not call emit_updates');
    }
    const updates = landscapeUpdatesSchema.parse(emitCall.input);

    const totalUsage = await result.totalUsage;
    const webSearchCount = allToolCalls.filter((c) => c.toolName === 'web_search').length;
    console.info(
      `[landscape] subject=${subject.slug} topic=${topic.slug} steps=${steps.length} web_search=${webSearchCount} input_tokens=${totalUsage.inputTokens ?? 0} cached_input_tokens=${totalUsage.cachedInputTokens ?? 0} output_tokens=${totalUsage.outputTokens ?? 0}`,
    );

    const { markdown, sources: citedSources, citationMap } = buildCitationOutput(blocks);
    const dedupedSupporting = dedupSupportingAgainstCited(supportingSources, citedSources);

    await completeLandscape({
      landscapeId: input.landscapeId,
      topicId: topic.id,
      subjectId: subject.id,
      subject: {
        research_brief_md: subject.research_brief_md,
        lexicon: subject.lexicon,
        open_questions_md: subject.open_questions_md,
      },
      topicTitle: topic.title,
      topicSlug: topic.slug,
      contentMd: markdown,
      briefAppend: updates.research_brief_append,
      lexiconAdds: updates.lexicon_adds,
      openQuestionAdds: updates.open_questions_adds,
      citationMap,
      supportingSources: dedupedSupporting,
    });

    send({ type: 'complete' });

    // Hydrate the source-trust cache for any URLs not yet classified. Runs
    // after `complete` is broadcast so the streaming UI hides immediately;
    // badges then fade in via postgres_changes on `source_trust` as rows are
    // upserted. The trailing work stays inside the parent `ctx.waitUntil`
    // task, so the worker is kept alive until it resolves.
    const sources: SourceTrustInput[] = [
      ...citationMap.map((c) => ({ url: c.url, title: c.title })),
      ...dedupedSupporting.map((s) => ({ url: s.url, title: s.title })),
    ];
    try {
      const cached = await findSourceTrustByUrls(sources.map((s) => s.url));
      const cachedUrls = new Set(cached.map((row) => row.url));
      const missing = uniqueByUrl(sources).filter((s) => !cachedUrls.has(s.url));
      if (missing.length > 0) {
        const rows = await classifySources(missing);
        if (rows.length > 0) await upsertSourceTrustRows(rows);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[landscape] source-trust classification failed: ${message}`);
    }

    return { landscapeId: input.landscapeId, contentMd: markdown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateLandscape(input.landscapeId, { status: 'failed', error_message: message });
    send({ type: 'error', message });
    throw error;
  } finally {
    await client.removeChannel(broadcast);
  }
}

type CompleteLandscapeInput = {
  landscapeId: string;
  topicId: string;
  subjectId: string;
  subject: { research_brief_md: string; lexicon: LexiconEntry[]; open_questions_md: string };
  topicTitle: string;
  topicSlug: string;
  contentMd: string;
  briefAppend: string;
  lexiconAdds: LexiconEntry[];
  openQuestionAdds: OpenQuestionEntry[];
  citationMap: CitationEntry[];
  supportingSources: Array<{ url: string; title: string | null }>;
};

async function completeLandscape(input: CompleteLandscapeInput): Promise<void> {
  const now = new Date();
  const datestamp = now.toISOString().slice(0, 10);
  const heading = `## ${input.topicTitle}`;
  const datedHeading = `${heading}\n_landscape run ${datestamp}_`;

  const brief = appendTopicSection(input.subject.research_brief_md, datedHeading, input.briefAppend);
  const lexicon = mergeLexicon(input.subject.lexicon, input.lexiconAdds);
  const openQuestions = appendOpenQuestions(input.subject.open_questions_md, input.openQuestionAdds);

  await updateSubject(input.subjectId, {
    research_brief_md: brief,
    lexicon,
    open_questions_md: openQuestions,
  });

  await updateLandscape(input.landscapeId, {
    content_md: input.contentMd,
    citation_map: input.citationMap,
    supporting_sources: input.supportingSources,
    status: 'complete',
    error_message: null,
  });

  await updateTopic(input.topicId, { status: 'landscape' });
}

function buildLandscapeMessages(input: {
  subjectSlug: string;
  researchBriefMd: string;
  lexicon: LexiconEntry[];
  openQuestionsMd: string;
  topic: { slug: string; title: string; pitch: string; rationale: string; category: string };
}) {
  const stable = [
    `Subject slug: \`${input.subjectSlug}\`.`,
    '',
    '## Subject research brief',
    input.researchBriefMd || '_(empty)_',
    '',
    '## Subject lexicon',
    'Same shape as `lexicon_adds` below. Use it for first-mention discipline and to skip duplicates when emitting `lexicon_adds`.',
    '```json',
    JSON.stringify(input.lexicon, null, 2),
    '```',
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
    'Write the full landscape markdown now. When the markdown is complete, call `emit_updates` exactly once with the structured payload.',
  ].join('\n');

  return [
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

function appendTopicSection(current: string, heading: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return current;
  const base = current.trimEnd();
  return `${base}\n\n${heading}\n\n${trimmed}\n`;
}

function appendOpenQuestions(current: string, entries: CompleteLandscapeInput['openQuestionAdds']): string {
  if (entries.length === 0) return current;

  const keyUnknowns = entries.filter((e) => e.section === 'key_unknowns');
  const contradictions = entries.filter((e) => e.section === 'contradictions');

  let next = current;
  if (keyUnknowns.length > 0) {
    const block = keyUnknowns.map((e) => `- [${e.topicSlug}] ${e.question}`).join('\n');
    next = appendUnderSection(next, '## Key unknowns', block);
  }
  if (contradictions.length > 0) {
    const block = contradictions.map((e) => `- [${e.topicSlug}] ${e.question}`).join('\n');
    next = appendUnderSection(next, '## Contradictions', block);
  }
  return next;
}

function appendUnderSection(current: string, heading: string, block: string): string {
  const trimmedBlock = block.trim();
  if (!trimmedBlock) return current;

  if (!current.includes(heading)) {
    return `${current.trimEnd()}\n\n${heading}\n\n${trimmedBlock}\n`;
  }

  const lines = current.split('\n');
  const headingIdx = lines.findIndex((line) => line.trim() === heading);
  const nextHeadingIdx = lines.findIndex((line, idx) => idx > headingIdx && /^##\s/.test(line.trim()));
  const insertIdx = nextHeadingIdx === -1 ? lines.length : nextHeadingIdx;

  const before = lines.slice(0, insertIdx);
  const after = lines.slice(insertIdx);
  const blockLines = trimmedBlock.split('\n');

  while (before.length > 0 && before[before.length - 1]?.trim() === '') before.pop();
  before.push('', ...blockLines, '');

  return (
    [...before, ...after]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}
