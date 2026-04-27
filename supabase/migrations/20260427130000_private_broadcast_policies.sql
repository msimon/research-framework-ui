-- Authorize private broadcast SELECT on the remaining entity-scoped channels:
-- `subject:<subjectId>`, `landscape:<landscapeId>`, `session:<sessionId>`.
-- Senders are the server (service role bypasses RLS), so only SELECT policies
-- are needed for subscribers to receive messages.
--
-- Convention matches the existing `interview:<subjectId>` policy: split the
-- topic on `:`, look up the entity, confirm ownership via the subjects table.

DROP POLICY IF EXISTS "Users receive own subject broadcasts" ON realtime.messages;
CREATE POLICY "Users receive own subject broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND split_part(realtime.topic(), ':', 1) = 'subject'
  AND EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE s.id = split_part(realtime.topic(), ':', 2)::uuid
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users receive own landscape broadcasts" ON realtime.messages;
CREATE POLICY "Users receive own landscape broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND split_part(realtime.topic(), ':', 1) = 'landscape'
  AND EXISTS (
    SELECT 1
    FROM public.landscapes l
    JOIN public.topics t ON t.id = l.topic_id
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE l.id = split_part(realtime.topic(), ':', 2)::uuid
      AND s.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users receive own deep research session broadcasts" ON realtime.messages;
CREATE POLICY "Users receive own deep research session broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND split_part(realtime.topic(), ':', 1) = 'session'
  AND EXISTS (
    SELECT 1
    FROM public.deep_research_sessions ds
    JOIN public.topics t ON t.id = ds.topic_id
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE ds.id = split_part(realtime.topic(), ':', 2)::uuid
      AND s.user_id = (select auth.uid())
  )
);
