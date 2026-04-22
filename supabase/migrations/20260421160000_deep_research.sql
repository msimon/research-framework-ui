-- Milestone 4: deep-research sessions + turns.
-- A deep-research session is a multi-turn conversational investigation on ONE topic,
-- anchored by a seed question. Each turn is a user prompt followed by an agent response
-- with Findings / My read / Follow-up. Closing a session promotes insights + open threads
-- back onto the subject and bumps the topic status from `landscape` to `deep`.
-- `workflow_instance_id` is forward-looking for Cloudflare Workflows; null while inline.

CREATE TABLE IF NOT EXISTS public.deep_research_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  seed_question text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),
  summary_md text NOT NULL DEFAULT '',
  turn_count integer NOT NULL DEFAULT 0,
  last_turn_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deep_research_sessions_topic_id_idx
  ON public.deep_research_sessions(topic_id);

DROP TRIGGER IF EXISTS set_deep_research_sessions_updated_at ON public.deep_research_sessions;
CREATE TRIGGER set_deep_research_sessions_updated_at
BEFORE UPDATE ON public.deep_research_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.deep_research_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own deep research sessions" ON public.deep_research_sessions;
CREATE POLICY "Users can read own deep research sessions"
ON public.deep_research_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = deep_research_sessions.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert own deep research sessions" ON public.deep_research_sessions;
CREATE POLICY "Users can insert own deep research sessions"
ON public.deep_research_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = deep_research_sessions.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update own deep research sessions" ON public.deep_research_sessions;
CREATE POLICY "Users can update own deep research sessions"
ON public.deep_research_sessions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = deep_research_sessions.topic_id
      AND s.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = deep_research_sessions.topic_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete own deep research sessions" ON public.deep_research_sessions;
CREATE POLICY "Users can delete own deep research sessions"
ON public.deep_research_sessions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = deep_research_sessions.topic_id
      AND s.user_id = (select auth.uid())
  )
);

ALTER TABLE public.deep_research_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deep_research_sessions;


CREATE TABLE IF NOT EXISTS public.deep_research_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.deep_research_sessions(id) ON DELETE CASCADE,
  turn_number integer NOT NULL,
  role text NOT NULL
    CHECK (role IN ('user', 'agent')),
  user_text text,
  findings_md text,
  my_read_md text,
  followup_question text,
  reasoning_md text,
  tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text,
  workflow_instance_id text,
  status text NOT NULL DEFAULT 'streaming'
    CHECK (status IN ('streaming', 'complete', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_number)
);

CREATE INDEX IF NOT EXISTS deep_research_turns_session_id_idx
  ON public.deep_research_turns(session_id);

DROP TRIGGER IF EXISTS set_deep_research_turns_updated_at ON public.deep_research_turns;
CREATE TRIGGER set_deep_research_turns_updated_at
BEFORE UPDATE ON public.deep_research_turns
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.deep_research_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own deep research turns" ON public.deep_research_turns;
CREATE POLICY "Users can read own deep research turns"
ON public.deep_research_turns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.deep_research_sessions ds
    JOIN public.topics t ON t.id = ds.topic_id
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE ds.id = deep_research_turns.session_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert own deep research turns" ON public.deep_research_turns;
CREATE POLICY "Users can insert own deep research turns"
ON public.deep_research_turns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.deep_research_sessions ds
    JOIN public.topics t ON t.id = ds.topic_id
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE ds.id = deep_research_turns.session_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update own deep research turns" ON public.deep_research_turns;
CREATE POLICY "Users can update own deep research turns"
ON public.deep_research_turns
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.deep_research_sessions ds
    JOIN public.topics t ON t.id = ds.topic_id
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE ds.id = deep_research_turns.session_id
      AND s.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.deep_research_sessions ds
    JOIN public.topics t ON t.id = ds.topic_id
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE ds.id = deep_research_turns.session_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete own deep research turns" ON public.deep_research_turns;
CREATE POLICY "Users can delete own deep research turns"
ON public.deep_research_turns
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.deep_research_sessions ds
    JOIN public.topics t ON t.id = ds.topic_id
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE ds.id = deep_research_turns.session_id
      AND s.user_id = (select auth.uid())
  )
);

ALTER TABLE public.deep_research_turns REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deep_research_turns;


-- Extend sources with a nullable turn_id so deep-research turns can attribute citations.
-- Sources remain primarily topic-scoped; landscape_id OR turn_id identifies origin.
ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS turn_id uuid REFERENCES public.deep_research_turns(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sources_turn_id_idx ON public.sources(turn_id);
