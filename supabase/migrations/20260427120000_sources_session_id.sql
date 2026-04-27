-- Denormalize session_id onto public.sources so the deep-research realtime
-- subscription can scope rows via a `session_id=eq.${id}` postgres_changes
-- filter. `sources.turn_id -> deep_research_turns.session_id` is a join the
-- websocket-level filter can't traverse, so we keep a copy on the row itself.
-- Landscape sources leave session_id null; the column is nullable.
--
-- Also add `public.sources` to the supabase_realtime publication and set
-- REPLICA IDENTITY FULL — without these, postgres_changes never delivered
-- INSERTs on this table.

ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS session_id uuid
    REFERENCES public.deep_research_sessions(id) ON DELETE CASCADE;

UPDATE public.sources s
SET session_id = t.session_id
FROM public.deep_research_turns t
WHERE s.turn_id = t.id
  AND s.session_id IS NULL;

CREATE INDEX IF NOT EXISTS sources_session_id_idx ON public.sources(session_id);

ALTER TABLE public.sources REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sources;
