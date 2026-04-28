import { z } from 'zod';

import { lexiconEntrySchema } from '@/prompts/landscape/landscape.schema';

export const deepResearchInsightSchema = z.object({
  text: z
    .string()
    .describe(
      'A firm-enough-to-stand-alone belief surfaced by this turn. Not just an answer to the turn question.',
    ),
});

export type DeepResearchInsight = z.infer<typeof deepResearchInsightSchema>;

export const deepResearchTurnSchema = z.object({
  my_read_md: z
    .string()
    .describe(
      'Your interpretation for this turn. Flagged as interpretation, not fact. Never mix with findings.',
    ),
  followup_question: z
    .string()
    .describe(
      'Exactly ONE follow-up question that sharpens the inquiry. Always prefix with "Follow-up Question:".',
    ),
  lexicon_adds: z
    .array(lexiconEntrySchema)
    .default([])
    .describe('New abbreviations / terms / entities surfaced this turn. Skip duplicates.'),
  insights: z
    .array(deepResearchInsightSchema)
    .default([])
    .describe('Firm-enough-to-stand-alone beliefs. 0–2 per turn typically. Do not inflate.'),
});

export type DeepResearchTurn = z.infer<typeof deepResearchTurnSchema>;
