import 'server-only';
import { generateText, Output } from 'ai';

import { SOURCE_TRUST_SYSTEM_PROMPT } from '@/prompts/source-trust/source-trust.prompt';
import {
  type SourceTrustClassification,
  sourceTrustBatchSchema,
} from '@/prompts/source-trust/source-trust.schema';
import { anthropicClassifierModel } from '@/server/infra/anthropic/anthropic.client';
import { serverConfig } from '@/shared/config/server.config';
import { extractDomain } from '@/shared/lib/utils/extract-domain.util';

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

  const ordered = [...dedupedByUrl.values()];
  const userMessage = buildClassifierUserMessage(ordered);

  const result = await generateText({
    model: anthropicClassifierModel(),
    output: Output.object({ schema: sourceTrustBatchSchema }),
    system: SOURCE_TRUST_SYSTEM_PROMPT,
    messages: [{ role: 'user' as const, content: userMessage }],
  });

  const byUrl = new Map<string, SourceTrustClassification>();
  for (const c of result.output.classifications) {
    if (dedupedByUrl.has(c.url)) byUrl.set(c.url, c);
  }
  if (byUrl.size === 0) {
    console.warn(`[source-trust] classifier returned no usable rows for ${ordered.length} url(s)`);
    return [];
  }

  const rows: SourceTrustClassificationRow[] = [];
  for (const entry of ordered) {
    const c = byUrl.get(entry.url);
    if (!c) continue;
    const domain = extractDomain(entry.url);
    if (!domain) continue;
    rows.push({
      url: entry.url,
      domain,
      category: c.category,
      rationale: c.rationale,
      trust_score: c.trust_score,
      classified_by_model: serverConfig.llm.classifierModel,
    });
  }
  return rows;
}

function buildClassifierUserMessage(inputs: ReadonlyArray<SourceTrustInput>): string {
  const lines = inputs.map((entry, idx) => {
    const trimmed = entry.title?.trim();
    const title = trimmed || '_(no title)_';
    return `${idx + 1}. url: ${entry.url}\n   title: ${title}`;
  });
  return [
    'Classify the authority of each URL below for research-grade citation. Return one entry per URL in the same order, preserving each URL exactly as given.',
    '',
    ...lines,
  ].join('\n');
}
