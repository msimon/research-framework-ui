-- Replace the freeform lexicon_md text column with structured lexicon entries.
-- Existing lexicon data is intentionally discarded — the prior shape (per-topic
-- markdown blocks duplicated across landscape/deep-research runs) is the bug
-- being fixed. New entries refill on the next landscape / deep-research run.

ALTER TABLE public.subjects
  DROP COLUMN lexicon_md,
  ADD COLUMN lexicon jsonb NOT NULL DEFAULT '[]'::jsonb;
