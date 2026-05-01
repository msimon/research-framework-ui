import { z } from 'zod';

export const sourceTrustCategorySchema = z
  .enum([
    'gov',
    'regulator',
    'standards-body',
    'peer-reviewed',
    'major-press',
    'trade-press',
    'company-primary',
    'company-marketing',
    'industry-blog',
    'social',
    'unknown',
  ])
  .catch('unknown');

export type SourceTrustCategory = z.infer<typeof sourceTrustCategorySchema>;

// Anthropic's structured-output schema rejects `minimum`/`maximum` on
// integer types, so the 0–5 bound for `trust_score` is enforced via the
// prompt and clamped at the service boundary instead of via Zod.
export const sourceTrustClassificationSchema = z.object({
  url: z.string().url(),
  category: sourceTrustCategorySchema,
  trust_score: z.number().int(),
  rationale: z.string().min(1).max(280),
});
export type SourceTrustClassification = z.infer<typeof sourceTrustClassificationSchema>;

export const sourceTrustBatchSchema = z.object({
  classifications: z.array(sourceTrustClassificationSchema).min(1),
});
export type SourceTrustBatch = z.infer<typeof sourceTrustBatchSchema>;
