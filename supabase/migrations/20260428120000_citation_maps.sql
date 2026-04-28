-- Per-citation metadata for inline `[N]` bracket rendering.
-- `citation_map` is an ordered JSONB array of `{ url, cited_text }` events
-- captured from Anthropic's `web_search_result_location` citations during
-- streaming. The bracket number is computed client-side at render time by
-- looking up the citation's URL in the entity-scoped sources list — keeping
-- the map flat (no baked-in source index) avoids drift when later turns add
-- new sources to a deep-research session.
--
-- `public.sources.snippet` is dropped: Anthropic's web_search API does not
-- expose a per-source human-readable excerpt (only encrypted_content on the
-- result block, or per-citation cited_text on the citation block — neither
-- maps cleanly to "what this source told me"). The Sources UI now renders
-- title + url only; cited substrings already appear inline in the markdown
-- via highlighted <cite> spans.

ALTER TABLE public.deep_research_turns
  ADD COLUMN IF NOT EXISTS citation_map jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.landscapes
  ADD COLUMN IF NOT EXISTS citation_map jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sources
  DROP COLUMN IF EXISTS snippet;
