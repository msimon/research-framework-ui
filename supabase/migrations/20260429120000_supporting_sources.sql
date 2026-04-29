-- Search-result URLs that the model considered but did not directly cite.
-- These are the `web_search_result` entries returned by the web_search tool
-- but never attached as `web_search_result_location` citations on a text
-- block. The UI lists them under cited sources as "supporting material" so
-- the user can see the full context of what the model researched.
--
-- Stored as an ordered JSONB array of `{ url, title }` (deduped against
-- citation_map at insert time, so URLs that appear in citation_map are NOT
-- duplicated here).

ALTER TABLE public.deep_research_turns
  ADD COLUMN IF NOT EXISTS supporting_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.landscapes
  ADD COLUMN IF NOT EXISTS supporting_sources jsonb NOT NULL DEFAULT '[]'::jsonb;
