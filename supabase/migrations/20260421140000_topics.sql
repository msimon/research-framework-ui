-- Milestone 2: topics table.
-- Topics belong to a subject. Broad discovery produces top-level rows (parent_topic_id NULL);
-- add-topics (future) will set parent_topic_id to chain threads.

CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  parent_topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  pitch text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('market','clinical','regulatory','operations','technology','competitive','economic','other')),
  status text NOT NULL DEFAULT 'discovered'
    CHECK (status IN ('discovered','landscape','deep')),
  sort_order integer NOT NULL DEFAULT 0,
  -- NULL = surfaced by the initial broad discover pass.
  -- Non-null = surfaced by a narrow-topics run; stores the hint text the user provided.
  discover_hint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, slug)
);

CREATE INDEX IF NOT EXISTS topics_subject_id_idx ON public.topics(subject_id);
CREATE INDEX IF NOT EXISTS topics_parent_topic_id_idx ON public.topics(parent_topic_id);

DROP TRIGGER IF EXISTS set_topics_updated_at ON public.topics;
CREATE TRIGGER set_topics_updated_at
BEFORE UPDATE ON public.topics
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own topics" ON public.topics;
CREATE POLICY "Users can read own topics"
ON public.topics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = topics.subject_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert own topics" ON public.topics;
CREATE POLICY "Users can insert own topics"
ON public.topics
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = topics.subject_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update own topics" ON public.topics;
CREATE POLICY "Users can update own topics"
ON public.topics
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = topics.subject_id
      AND s.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = topics.subject_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete own topics" ON public.topics;
CREATE POLICY "Users can delete own topics"
ON public.topics
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = topics.subject_id
      AND s.user_id = (select auth.uid())
  )
);

ALTER TABLE public.topics REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.topics;
