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

export const sourceTrustClassificationSchema = z.object({
  url: z.string().url(),
  category: sourceTrustCategorySchema,
  trust_score: z.number().int().min(0).max(5),
  rationale: z.string().min(1).max(280),
});
export type SourceTrustClassification = z.infer<typeof sourceTrustClassificationSchema>;

export const sourceTrustBatchSchema = z.object({
  classifications: z.array(sourceTrustClassificationSchema).min(1),
});
export type SourceTrustBatch = z.infer<typeof sourceTrustBatchSchema>;
