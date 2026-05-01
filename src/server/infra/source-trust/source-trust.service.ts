import 'server-only';
import { generateText, Output } from 'ai';

import { SOURCE_TRUST_SYSTEM_PROMPT } from '@/prompts/source-trust/source-trust.prompt';
import {
  type SourceTrustClassification,
  sourceTrustBatchSchema,
  sourceTrustCategorySchema,
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
  let recoveredFromPollution = 0;
  for (const c of result.output.classifications) {
    const { url: cleanUrl, recoveredCategory } = cleanClassifierUrl(c.url);
    if (!dedupedByUrl.has(cleanUrl)) {
      hallucinatedUrls.push(c.url);
      continue;
    }
    let category = c.category;
    if (cleanUrl !== c.url) {
      recoveredFromPollution += 1;
      // The model leaked JSON syntax into the URL field — its own intended
      // category is in the suffix, while the `category` field fell back to
      // "unknown". Recover the suffix category when it parses cleanly.
      if (category === 'unknown' && recoveredCategory) {
        const parsed = sourceTrustCategorySchema.safeParse(recoveredCategory);
        if (parsed.success && parsed.data !== 'unknown') {
          category = parsed.data;
        }
      }
    }
    byUrl.set(cleanUrl, { ...c, url: cleanUrl, category });
  }
  if (recoveredFromPollution > 0) {
    console.warn(
      `[source-trust] recovered ${recoveredFromPollution} url(s) where the model leaked JSON syntax into the url field`,
    );
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

// The classifier occasionally emits the URL field with a JSON-syntax
// fragment glued onto the end, e.g. `https://example.com/foo/','category':'industry-blog`.
// The accompanying `category` field then falls back to "unknown". Strip
// the suffix so the URL matches the input batch, and surface the leaked
// category for recovery.
const POLLUTED_URL_SUFFIX_RE = /^(.+?)['"]?,\s*['"]category['"]\s*:\s*['"]([^'"]+)['"]?$/;

function cleanClassifierUrl(rawUrl: string): { url: string; recoveredCategory: string | null } {
  const match = POLLUTED_URL_SUFFIX_RE.exec(rawUrl);
  if (match?.[1]) {
    return { url: match[1], recoveredCategory: match[2] ?? null };
  }
  return { url: rawUrl, recoveredCategory: null };
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
