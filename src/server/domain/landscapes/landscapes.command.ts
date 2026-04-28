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
  findSourcesByTopic,
  insertSources,
  updateLandscape,
} from '@/server/domain/landscapes/landscapes.repository';
import { getSubjectById, updateSubject } from '@/server/domain/subjects/subjects.repository';
import { findTopicBySlug, updateTopic } from '@/server/domain/topics/topics.repository';
import {
  anthropicModel,
  anthropicProviderOptions,
  anthropicWebSearchTool,
} from '@/server/infra/anthropic/anthropic.client';
import { type EntityChannelName, supabaseBroadcastClient } from '@/server/infra/supabase/realtime';
import { dedupeCitations } from '@/server/lib/utils/dedupe-citations.util';
import { logCitationDebug } from '@/server/lib/utils/log-citation-debug.util';
import type { CitationEntry } from '@/shared/citation.type';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type LandscapeRow = Database['public']['Tables']['landscapes']['Row'];
type SubjectRow = Database['public']['Tables']['subjects']['Row'];
type SourceInsert = Database['public']['Tables']['sources']['Insert'];

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

  const existingSources = await findSourcesByTopic(topic.id);
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
    const citationsLog: Array<{ url: string; title: string | null; cited_text: string }> = [];

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
        logCitationDebug(`landscape:${input.landscapeId}`, chunk);
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
        } else if (chunk.type === 'source' && chunk.sourceType === 'url') {
          const citedText = (chunk.providerMetadata?.anthropic as { citedText?: unknown } | undefined)
            ?.citedText;
          if (typeof citedText !== 'string') return;
          const entry = {
            url: chunk.url,
            title: chunk.title ?? null,
            cited_text: citedText,
          };
          citationsLog.push(entry);
          send({ type: 'citation', ...entry });
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
    const updates = landscapeUpdatesSchema.parse(emitCall.input);

    const totalUsage = await result.totalUsage;
    const webSearchCount = allToolCalls.filter((c) => c.toolName === 'web_search').length;
    console.info(
      `[landscape] subject=${subject.slug} topic=${topic.slug} steps=${steps.length} web_search=${webSearchCount} input_tokens=${totalUsage.inputTokens ?? 0} cached_input_tokens=${totalUsage.cachedInputTokens ?? 0} output_tokens=${totalUsage.outputTokens ?? 0}`,
    );

    const dedupedSources = dedupeCitations(citationsLog);
    const citationMap: CitationEntry[] = citationsLog.map((c) => ({
      url: c.url,
      cited_text: c.cited_text,
    }));

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
      sources: dedupedSources,
      citationMap,
    });

    send({ type: 'complete' });

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
  subject: Pick<SubjectRow, 'research_brief_md' | 'lexicon_md' | 'open_questions_md'>;
  topicTitle: string;
  topicSlug: string;
  contentMd: string;
  briefAppend: string;
  lexiconAdds: LexiconEntry[];
  openQuestionAdds: OpenQuestionEntry[];
  sources: Array<{ url: string; title: string | null }>;
  citationMap: CitationEntry[];
};

async function completeLandscape(input: CompleteLandscapeInput): Promise<void> {
  const now = new Date();
  const datestamp = now.toISOString().slice(0, 10);
  const heading = `## ${input.topicTitle}`;
  const datedHeading = `${heading}\n_landscape run ${datestamp}_`;

  const brief = appendTopicSection(input.subject.research_brief_md, datedHeading, input.briefAppend);
  const lexicon = appendLexicon(input.subject.lexicon_md, heading, input.lexiconAdds);
  const openQuestions = appendOpenQuestions(input.subject.open_questions_md, input.openQuestionAdds);

  await updateSubject(input.subjectId, {
    research_brief_md: brief,
    lexicon_md: lexicon,
    open_questions_md: openQuestions,
  });

  await updateLandscape(input.landscapeId, {
    content_md: input.contentMd,
    citation_map: input.citationMap,
    status: 'complete',
    error_message: null,
  });

  await updateTopic(input.topicId, { status: 'landscape' });

  if (input.sources.length > 0) {
    const rows: SourceInsert[] = input.sources.map((s) => ({
      topic_id: input.topicId,
      landscape_id: input.landscapeId,
      url: s.url,
      title: s.title,
    }));
    await insertSources(rows);
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

function appendTopicSection(current: string, heading: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return current;
  const base = current.trimEnd();
  return `${base}\n\n${heading}\n\n${trimmed}\n`;
}

function appendLexicon(
  current: string,
  topicHeading: string,
  entries: CompleteLandscapeInput['lexiconAdds'],
): string {
  if (entries.length === 0) return current;

  const abbreviations = entries.filter((e) => e.kind === 'abbreviation');
  const terms = entries.filter((e) => e.kind === 'term');
  const entities = entries.filter((e) => e.kind === 'entity');

  const blocks: string[] = [];

  if (abbreviations.length > 0) {
    blocks.push(
      '### Abbreviations',
      '| Abbrev | Expansion | One-line meaning |',
      '|---|---|---|',
      ...abbreviations.map(
        (e) => `| ${escapeCell(e.label)} | ${escapeCell(e.expansion ?? '')} | ${escapeCell(e.definition)} |`,
      ),
    );
  }

  if (terms.length > 0) {
    if (blocks.length > 0) blocks.push('');
    blocks.push(
      '### Terms & concepts',
      '| Term | One-line meaning |',
      '|---|---|',
      ...terms.map((e) => `| ${escapeCell(e.label)} | ${escapeCell(e.definition)} |`),
    );
  }

  if (entities.length > 0) {
    if (blocks.length > 0) blocks.push('');
    blocks.push(
      '### Entities',
      '| Name | What it is / what it does |',
      '|---|---|',
      ...entities.map((e) => `| ${escapeCell(e.label)} | ${escapeCell(e.definition)} |`),
    );
  }

  const body = blocks.join('\n');
  return appendTopicSection(current, topicHeading, body);
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

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}
