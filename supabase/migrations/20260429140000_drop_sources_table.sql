-- Drop public.sources entirely. Source data now lives in `citation_map`
-- and `supporting_sources` JSONB columns on `deep_research_turns` and
-- `landscapes`. The table became vestigial after the citation_maps
-- migration — its only meaningful read was a prompt-context "don't
-- re-cite these" lookup, which we've also removed.
--
-- If we ever want a topic-level aggregated source view, it can be
-- derived at read time from the JSONB columns of all the topic's
-- landscapes + deep-research turns.

ALTER PUBLICATION supabase_realtime DROP TABLE public.sources;
DROP TABLE IF EXISTS public.sources;
