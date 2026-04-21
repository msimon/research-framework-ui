import {
  createLandscape,
  findLandscapeByTopic,
  insertSources,
  updateLandscape,
} from '@/server/domain/landscapes/landscapes.repository';
import { updateSubject } from '@/server/domain/subjects/subjects.repository';
import { updateTopic } from '@/server/domain/topics/topics.repository';
import type { Database } from '@/shared/lib/supabase/supabase.types';

type LandscapeRow = Database['public']['Tables']['landscapes']['Row'];
type SubjectRow = Database['public']['Tables']['subjects']['Row'];
type SourceInsert = Database['public']['Tables']['sources']['Insert'];

export async function getOrCreateLandscape(topicId: string): Promise<LandscapeRow> {
  const existing = await findLandscapeByTopic(topicId);
  if (existing) return existing;
  return createLandscape({ topic_id: topicId, status: 'pending', content_md: '' });
}

export async function startLandscape(landscapeId: string): Promise<LandscapeRow> {
  return updateLandscape(landscapeId, {
    status: 'streaming',
    content_md: '',
    error_message: null,
  });
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
  lexiconAdds: Array<{ kind: 'abbreviation' | 'term' | 'entity'; label: string; expansion?: string; definition: string }>;
  openQuestionAdds: Array<{ topicSlug: string; question: string; section: 'key_unknowns' | 'contradictions' }>;
  sources: Array<{ url: string; title?: string; snippet?: string }>;
};

export async function completeLandscape(input: CompleteLandscapeInput): Promise<void> {
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
    status: 'complete',
    error_message: null,
  });

  await updateTopic(input.topicId, { status: 'landscape' });

  if (input.sources.length > 0) {
    const rows: SourceInsert[] = input.sources.map((s) => ({
      topic_id: input.topicId,
      landscape_id: input.landscapeId,
      url: s.url,
      title: s.title ?? null,
      snippet: s.snippet ?? null,
    }));
    await insertSources(rows);
  }
}

export async function failLandscape(landscapeId: string, errorMessage: string): Promise<void> {
  await updateLandscape(landscapeId, { status: 'failed', error_message: errorMessage });
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

function appendOpenQuestions(
  current: string,
  entries: CompleteLandscapeInput['openQuestionAdds'],
): string {
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
  const nextHeadingIdx = lines.findIndex(
    (line, idx) => idx > headingIdx && /^##\s/.test(line.trim()),
  );
  const insertIdx = nextHeadingIdx === -1 ? lines.length : nextHeadingIdx;

  const before = lines.slice(0, insertIdx);
  const after = lines.slice(insertIdx);
  const blockLines = trimmedBlock.split('\n');

  while (before.length > 0 && before[before.length - 1]?.trim() === '') before.pop();
  before.push('', ...blockLines, '');

  return [...before, ...after].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}
