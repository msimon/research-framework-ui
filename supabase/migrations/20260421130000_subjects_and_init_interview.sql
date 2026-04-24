-- Milestone 1: subjects + init_interview_turns.

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  seed_problem_statement text,
  framing jsonb NOT NULL DEFAULT '{}'::jsonb,
  research_brief_md text NOT NULL DEFAULT '',
  lexicon_md text NOT NULL DEFAULT '',
  open_questions_md text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'interviewing'
    CHECK (status IN ('interviewing', 'ready', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS subjects_user_id_idx ON public.subjects(user_id);
CREATE INDEX IF NOT EXISTS subjects_status_idx ON public.subjects(status);

DROP TRIGGER IF EXISTS set_subjects_updated_at ON public.subjects;
CREATE TRIGGER set_subjects_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own subjects" ON public.subjects;
CREATE POLICY "Users can read own subjects"
ON public.subjects
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own subjects" ON public.subjects;
CREATE POLICY "Users can insert own subjects"
ON public.subjects
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own subjects" ON public.subjects;
CREATE POLICY "Users can update own subjects"
ON public.subjects
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own subjects" ON public.subjects;
CREATE POLICY "Users can delete own subjects"
ON public.subjects
FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);


CREATE TABLE IF NOT EXISTS public.init_interview_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  turn_number integer NOT NULL,
  agent_step jsonb NOT NULL,
  user_answer jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, turn_number)
);

CREATE INDEX IF NOT EXISTS init_interview_turns_subject_id_idx
  ON public.init_interview_turns(subject_id);

DROP TRIGGER IF EXISTS set_init_interview_turns_updated_at ON public.init_interview_turns;
CREATE TRIGGER set_init_interview_turns_updated_at
BEFORE UPDATE ON public.init_interview_turns
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.init_interview_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own interview turns" ON public.init_interview_turns;
CREATE POLICY "Users can read own interview turns"
ON public.init_interview_turns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = init_interview_turns.subject_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert own interview turns" ON public.init_interview_turns;
CREATE POLICY "Users can insert own interview turns"
ON public.init_interview_turns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = init_interview_turns.subject_id
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update own interview turns" ON public.init_interview_turns;
CREATE POLICY "Users can update own interview turns"
ON public.init_interview_turns
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = init_interview_turns.subject_id
      AND s.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = init_interview_turns.subject_id
      AND s.user_id = (select auth.uid())
  )
);

-- Realtime: emit postgres_changes for these tables.
-- REPLICA IDENTITY FULL ensures UPDATE payloads include the full row, not just the PK.
ALTER TABLE public.init_interview_turns REPLICA IDENTITY FULL;
ALTER TABLE public.subjects REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.init_interview_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subjects;

-- Realtime: authorize private broadcast on interview:<subject_id> topics.
-- Sender is the server (service role bypasses RLS), so only a SELECT policy is needed.
DROP POLICY IF EXISTS "Users receive own interview broadcasts" ON realtime.messages;
CREATE POLICY "Users receive own interview broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND split_part(realtime.topic(), ':', 1) = 'interview'
  AND EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = split_part(realtime.topic(), ':', 2)::uuid
      AND s.user_id = (select auth.uid())
  )
);
