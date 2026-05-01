import 'server-only';
import { generateText, Output } from 'ai';

import { SOURCE_TRUST_SYSTEM_PROMPT } from '@/prompts/source-trust/source-trust.prompt';
import {
  type SourceTrustClassification,
  sourceTrustBatchSchema,
} from '@/prompts/source-trust/source-trust.schema';
import {
  anthropicClassifierModel,
  anthropicClassifierProviderOptions,
} from '@/server/infra/anthropic/anthropic.client';
import { serverConfig } from '@/shared/config/server.config';

export type SourceTrustInput = {
  url: string;
  title: string | null;
};

export type SourceTrustClassificationRow = {
  url: string;
  domain: string;
  category: SourceTrustClassification['category'];
  rationale: string;
  trust_score: number;
  classified_by_model: string;
};

export async function classifySources(
  inputs: ReadonlyArray<SourceTrustInput>,
): Promise<SourceTrustClassificationRow[]> {
  const dedupedByUrl = new Map<string, SourceTrustInput>();
  for (const entry of inputs) {
    if (!entry.url) continue;
    if (!dedupedByUrl.has(entry.url)) dedupedByUrl.set(entry.url, entry);
  }
  if (dedupedByUrl.size === 0) return [];

  // 1-based index → input entry. The model references entries by index,
  // never by URL, so URL-shape hallucinations (JSON-syntax leaks, suffix
  // bleed across adjacent entries) are physically impossible.
  const ordered = [...dedupedByUrl.values()];
  const userMessage = buildClassifierUserMessage(ordered);

  const result = await generateText({
    model: anthropicClassifierModel(),
    output: Output.object({ schema: sourceTrustBatchSchema }),
    system: SOURCE_TRUST_SYSTEM_PROMPT,
    messages: [{ role: 'user' as const, content: userMessage }],
    providerOptions: { anthropic: anthropicClassifierProviderOptions },
  });

  const byIndex = new Map<number, SourceTrustClassification>();
  const outOfRangeIndices: number[] = [];
  for (const c of result.output.classifications) {
    if (c.index >= 1 && c.index <= ordered.length) {
      if (!byIndex.has(c.index)) byIndex.set(c.index, c);
    } else {
      outOfRangeIndices.push(c.index);
    }
  }
  if (outOfRangeIndices.length > 0) {
    console.warn(
      `[source-trust] classifier returned ${outOfRangeIndices.length} out-of-range index(es) for an input of ${ordered.length}: ${outOfRangeIndices.join(', ')}`,
    );
  }
  if (byIndex.size === 0) {
    console.warn(`[source-trust] classifier returned no usable rows for ${ordered.length} url(s)`);
    return [];
  }

  const rows: SourceTrustClassificationRow[] = [];
  const droppedNoClassification: string[] = [];
  const droppedBadDomain: string[] = [];
  const domainMismatches: Array<{ index: number; expected: string; got: string }> = [];
  ordered.forEach((entry, i) => {
    const c = byIndex.get(i + 1);
    if (!c) {
      droppedNoClassification.push(entry.url);
      return;
    }
    const domain = extractDomain(entry.url);
    if (!domain) {
      droppedBadDomain.push(entry.url);
      return;
    }
    const echoedDomain = c.domain
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');
    if (echoedDomain !== domain) {
      domainMismatches.push({ index: i + 1, expected: domain, got: c.domain });
      return;
    }
    rows.push({
      url: entry.url,
      domain,
      category: c.category,
      rationale: c.rationale,
      trust_score: clampScore(c.trust_score),
      classified_by_model: serverConfig.llm.classifierModel,
    });
  });

  if (domainMismatches.length > 0) {
    console.warn(
      `[source-trust] ${domainMismatches.length} entry/entries dropped because the model's echoed domain disagreed with the input host (likely index↔URL misalignment in the model's output):\n${domainMismatches
        .map(({ index, expected, got }) => `  - #${index}: expected "${expected}", model wrote "${got}"`)
        .join('\n')}`,
    );
  }
  if (droppedNoClassification.length > 0) {
    console.warn(
      `[source-trust] ${droppedNoClassification.length} input url(s) not classified by the model:\n${droppedNoClassification.map((u) => `  - ${u}`).join('\n')}`,
    );
  }
  if (droppedBadDomain.length > 0) {
    console.warn(
      `[source-trust] ${droppedBadDomain.length} url(s) dropped due to unparseable host:\n${droppedBadDomain.map((u) => `  - ${u}`).join('\n')}`,
    );
  }

  return rows;
}

function buildClassifierUserMessage(inputs: ReadonlyArray<SourceTrustInput>): string {
  // Each entry is explicitly labeled with `index: N` so the model copies
  // the integer rather than inferring its position by counting.
  const blocks = inputs.map((entry, i) => {
    const trimmed = entry.title?.trim();
    const title = trimmed || '_(no title)_';
    return `index: ${i + 1}\nurl: ${entry.url}\ntitle: ${title}`;
  });
  return [
    `Classify the authority of each URL below for research-grade citation. Each entry is labeled with an explicit \`index:\` integer — copy that integer back into the \`index\` field of the matching output entry. There are ${inputs.length} entries.`,
    '',
    ...blocks,
  ].join('\n\n');
}

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 5) return 5;
  return score;
}

function extractDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}
