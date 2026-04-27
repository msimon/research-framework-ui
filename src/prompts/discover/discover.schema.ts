import { z } from 'zod';

export const topicCategoryEnum = z.enum([
  'market',
  'clinical',
  'regulatory',
  'operations',
  'technology',
  'competitive',
  'economic',
  'other',
]);

export const discoveredTopicSchema = z.object({
  slug: z.string().describe('Short, lowercase, hyphen-separated. Max ~4 words. Unique within the subject.'),
  title: z.string().describe('Human-readable title, 3–8 words.'),
  category: topicCategoryEnum,
  pitch: z
    .string()
    .describe(
      'One-line hook that states WHY this topic is interesting, not what it is. ≤15 words. Specific (numbers, names, tensions). Flag uncertain claims with (?).',
    ),
  rationale: z
    .string()
    .describe(
      "1–2 sentences on why this topic matters given the user's framing (scope, angle, end goal, priors). Used later by the UI and by downstream skills.",
    ),
});

export type DiscoveredTopic = z.infer<typeof discoveredTopicSchema>;

export const discoverResponseSchema = z.object({
  topics: z
    .array(discoveredTopicSchema)
    .min(1)
    .max(10)
    .describe(
      'Ranked list of candidate research topics, most-important-first. Cap: 10. Fewer is fine — prefer quality over quantity.',
    ),
});

export type DiscoverResponse = z.infer<typeof discoverResponseSchema>;
