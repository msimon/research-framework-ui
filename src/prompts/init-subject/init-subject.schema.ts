import { z } from 'zod';

import { lexiconEntrySchema } from '@/prompts/landscape/landscape.schema';

export const agentStepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('plan'),
    summary: z
      .string()
      .describe(
        'Shown to the user. 2–3 short sentences addressing them directly in the second person ("your seed points at…", "I\'ll focus on…"). What you picked up from their seed, what you\'ll focus on. No "the user".',
      ),
    will_ask: z
      .array(z.enum(['scope', 'angle', 'end_goal', 'priors', 'synthesis']))
      .describe('Questions you will ask, in order.'),
    will_skip: z
      .array(
        z.object({
          question: z.enum(['scope', 'angle', 'end_goal', 'priors', 'synthesis']),
          reason: z.string().describe('Shown to the user. One short sentence, second person. No "the user".'),
        }),
      )
      .describe('Questions you are skipping.'),
  }),
  z.object({
    type: z.literal('question'),
    question_id: z.enum(['scope', 'angle', 'end_goal', 'priors', 'synthesis']),
    prompt: z
      .string()
      .describe(
        'The question text shown to the user. Address them directly (second person). Markdown OK. Keep to ~3 short lines.',
      ),
    dimensions: z
      .array(z.string())
      .optional()
      .describe('Optional list of dimensions/axes the user should cover in their answer.'),
    choices: z
      .array(z.string().max(85))
      .optional()
      .describe(
        'Optional pre-baked choices the user can click instead of typing. 2–6 items. Aim for ≤ 65 characters per choice; stretch to 85 only if really needed — they render as buttons.',
      ),
    example: z.string().optional().describe('Optional one-line example answer in the user’s likely domain.'),
    allow_free_text: z.boolean().describe('Whether free-text input is allowed in addition to choices.'),
  }),
  z.object({
    type: z.literal('pushback'),
    question_id: z.enum(['scope', 'angle', 'end_goal', 'priors', 'synthesis']),
    message: z
      .string()
      .describe(
        'One-sentence clarification shown to the user, addressing them directly (second person). Explain the ambiguity that matters.',
      ),
    options: z
      .array(z.object({ label: z.string(), reason: z.string() }))
      .min(2)
      .max(4),
  }),
  z.object({
    type: z.literal('complete'),
    title: z.string().describe('Short human-readable title for the subject (not the slug).'),
    framing: z.object({
      scope: z.string().optional(),
      angle: z.string().optional(),
      end_goal: z.string().optional(),
      priors: z.array(z.string()).default([]),
      synthesis_criteria: z.array(z.string()).optional(),
    }),
    research_brief_md: z.string().describe('Fully populated research brief markdown.'),
    lexicon: z
      .array(lexiconEntrySchema)
      .default([])
      .describe(
        'Initial lexicon entries (abbreviations, terms, entities) for this domain. Pre-populate from domain knowledge — see the lexicon section of the prompt.',
      ),
    open_questions_md: z
      .string()
      .describe('Initial 00-open-questions.md markdown with the biggest open questions.'),
  }),
]);

export type AgentStep = z.infer<typeof agentStepSchema>;

export const agentStepResponseSchema = z.object({
  step: agentStepSchema,
});
