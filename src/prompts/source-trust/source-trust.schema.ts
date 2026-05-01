import { z } from 'zod';

export const sourceTrustCategorySchema = z
  .enum([
    'gov',
    'regulator',
    'standards-body',
    'peer-reviewed',
    'major-press',
    'trade-press',
    'company',
    'industry-blog',
    'social',
    'unknown',
  ])
  .catch('unknown');

export type SourceTrustCategory = z.infer<typeof sourceTrustCategorySchema>;

// Anthropic's structured-output schema rejects `minimum`/`maximum` on
// integer types, so the 0–5 bound for `trust_score` is enforced via the
// prompt and clamped at the service boundary instead of via Zod.
//
// Output is index-based: the model references each input by its 1-based
// position in the numbered list, never re-emitting the URL string. This
// makes URL-shape hallucinations (JSON-syntax leaks, suffix bleed from
// adjacent entries) physically impossible.
//
// `domain` is a diagnostic echo: the model writes the host it sees for
// this index, and we cross-check against the actual domain to confirm
// the index↔entry alignment is intact. Mismatches are logged but the
// index still drives the mapping.
export const sourceTrustClassificationSchema = z.object({
  index: z.number().int(),
  domain: z.string(),
  category: sourceTrustCategorySchema,
  trust_score: z.number().int(),
  rationale: z.string().min(1).max(280),
});
export type SourceTrustClassification = z.infer<typeof sourceTrustClassificationSchema>;

export const sourceTrustBatchSchema = z.object({
  classifications: z.array(sourceTrustClassificationSchema).min(1),
});
export type SourceTrustBatch = z.infer<typeof sourceTrustBatchSchema>;
