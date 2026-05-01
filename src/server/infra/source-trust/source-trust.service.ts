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

  const ordered = [...dedupedByUrl.values()];
  const userMessage = buildClassifierUserMessage(ordered);

  console.info(
    `[source-trust] classifying ${ordered.length} url(s):\n${ordered.map((e, i) => `  ${i + 1}. ${e.url} — ${e.title ?? '(no title)'}`).join('\n')}`,
  );

  const result = await generateText({
    model: anthropicClassifierModel(),
    output: Output.object({ schema: sourceTrustBatchSchema }),
    system: SOURCE_TRUST_SYSTEM_PROMPT,
    messages: [{ role: 'user' as const, content: userMessage }],
    providerOptions: { anthropic: anthropicClassifierProviderOptions },
  });

  console.info(
    `[source-trust] classifier returned ${result.output.classifications.length} row(s):\n${JSON.stringify(result.output.classifications, null, 2)}`,
  );

  const byUrl = new Map<string, SourceTrustClassification>();
  const hallucinatedUrls: string[] = [];
  for (const c of result.output.classifications) {
    if (dedupedByUrl.has(c.url)) {
      byUrl.set(c.url, c);
    } else {
      hallucinatedUrls.push(c.url);
    }
  }
  if (hallucinatedUrls.length > 0) {
    console.warn(
      `[source-trust] classifier returned ${hallucinatedUrls.length} url(s) not in the input batch:\n${hallucinatedUrls.map((u) => `  - ${u}`).join('\n')}`,
    );
  }
  if (byUrl.size === 0) {
    console.warn(`[source-trust] classifier returned no usable rows for ${ordered.length} url(s)`);
    return [];
  }

  const rows: SourceTrustClassificationRow[] = [];
  const droppedNoClassification: string[] = [];
  const droppedBadDomain: string[] = [];
  for (const entry of ordered) {
    const c = byUrl.get(entry.url);
    if (!c) {
      droppedNoClassification.push(entry.url);
      continue;
    }
    const domain = extractDomain(entry.url);
    if (!domain) {
      droppedBadDomain.push(entry.url);
      continue;
    }
    rows.push({
      url: entry.url,
      domain,
      category: c.category,
      rationale: c.rationale,
      trust_score: clampScore(c.trust_score),
      classified_by_model: serverConfig.llm.classifierModel,
    });
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
  console.info(
    `[source-trust] kept ${rows.length}/${ordered.length} classifications (dropped: no-class=${droppedNoClassification.length}, bad-domain=${droppedBadDomain.length}, hallucinated=${hallucinatedUrls.length})`,
  );

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
