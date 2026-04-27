-- Milestone 3: landscape + sources.
-- A `landscape` is a substantive overview of one topic. One landscape per topic for MVP
-- (refreshes overwrite content_md, append sources). `workflow_instance_id` is a forward-looking
-- column for Cloudflare Workflows; null while we run inline.
-- `sources` captures citations surfaced during a landscape (web_search results, MCP hits later).

CREATE TABLE IF NOT EXISTS public.landscapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  content_md text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','streaming','complete','failed')),
  workflow_instance_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
);

CREATE INDEX IF NOT EXISTS landscapes_topic_id_idx ON public.landscapes(topic_id);

DROP TRIGGER IF EXISTS set_landscapes_updated_at ON public.landscapes;
CREATE TRIGGER set_landscapes_updated_at
BEFORE UPDATE ON public.landscapes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.landscapes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own landscapes" ON public.landscapes;
CREATE POLICY "Users can read own landscapes"
ON public.landscapes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = landscapes.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert own landscapes" ON public.landscapes;
CREATE POLICY "Users can insert own landscapes"
ON public.landscapes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = landscapes.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update own landscapes" ON public.landscapes;
CREATE POLICY "Users can update own landscapes"
ON public.landscapes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = landscapes.topic_id
      AND s.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = landscapes.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete own landscapes" ON public.landscapes;
CREATE POLICY "Users can delete own landscapes"
ON public.landscapes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = landscapes.topic_id
      AND s.user_id = (select auth.uid())
  )
);

ALTER TABLE public.landscapes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.landscapes;


CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  landscape_id uuid REFERENCES public.landscapes(id) ON DELETE SET NULL,
  url text NOT NULL,
  title text,
  snippet text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sources_topic_id_idx ON public.sources(topic_id);
CREATE INDEX IF NOT EXISTS sources_landscape_id_idx ON public.sources(landscape_id);

DROP TRIGGER IF EXISTS set_sources_updated_at ON public.sources;
CREATE TRIGGER set_sources_updated_at
BEFORE UPDATE ON public.sources
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sources" ON public.sources;
CREATE POLICY "Users can read own sources"
ON public.sources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = sources.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert own sources" ON public.sources;
CREATE POLICY "Users can insert own sources"
ON public.sources
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = sources.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update own sources" ON public.sources;
CREATE POLICY "Users can update own sources"
ON public.sources
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = sources.topic_id
      AND s.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = sources.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete own sources" ON public.sources;
CREATE POLICY "Users can delete own sources"
ON public.sources
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = sources.topic_id
      AND s.user_id = (select auth.uid())
  )
);
