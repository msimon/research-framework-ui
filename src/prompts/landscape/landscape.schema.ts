import { z } from 'zod';

export const lexiconEntrySchema = z.object({
  kind: z.enum(['abbreviation', 'term', 'entity']),
  label: z.string().describe('The abbreviation, term, or entity name.'),
  expansion: z
    .string()
    .optional()
    .describe('For abbreviations: the spelled-out form. Omit for terms and entities.'),
  definition: z.string().describe('One-line definition. No judgment calls — flat factual.'),
});

export type LexiconEntry = z.infer<typeof lexiconEntrySchema>;

export const openQuestionEntrySchema = z.object({
  topicSlug: z
    .string()
    .describe('Slug of the topic this question belongs to. Used to tag it [<slug>] in the open-questions file.'),
  question: z.string().describe('One-line open question. Concrete enough that a researcher could chase it.'),
  section: z
    .enum(['key_unknowns', 'contradictions'])
    .default('key_unknowns')
    .describe('Where to file it. Contradictions = where sources disagree.'),
});

export type OpenQuestionEntry = z.infer<typeof openQuestionEntrySchema>;

export const landscapeSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  snippet: z
    .string()
    .optional()
    .describe('One-line summary of what this source told you. Mirror the "what it told me" line in the markdown.'),
});

export type LandscapeSource = z.infer<typeof landscapeSourceSchema>;

export const landscapeUpdatesSchema = z.object({
  research_brief_append: z
    .string()
    .describe(
      "5–8 line block to append to the subject's research brief under a `## <topic title>` heading. Firm claims, no hedges. Note stress-tested priors inline.",
    ),
  lexicon_adds: z
    .array(lexiconEntrySchema)
    .default([])
    .describe('New abbreviations, terms, and entities surfaced during this landscape. Skip duplicates of existing lexicon.'),
  open_questions_adds: z
    .array(openQuestionEntrySchema)
    .default([])
    .describe('New unknowns and contradictions surfaced.'),
  sources: z
    .array(landscapeSourceSchema)
    .default([])
    .describe('Every URL you actually relied on while writing the landscape. This is the canonical citation list — do not omit sources just because they are referenced inline in prose.'),
});

export type LandscapeUpdates = z.infer<typeof landscapeUpdatesSchema>;
