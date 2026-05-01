-- Global per-URL trust score cache. Populated lazily by the landscape and
-- deep-research commands after they finish streaming, via the source-trust
-- infra service. Authority is host-property (not user-specific), so the same
-- row serves every user; reads are open to any authenticated user, writes
-- are restricted to the service role. Subscribed to via postgres_changes by
-- the landscape and deep-research session UIs so trust badges fade in as
-- rows are upserted.

CREATE TABLE IF NOT EXISTS public.source_trust (
  url                 text PRIMARY KEY,
  domain              text NOT NULL,
  category            text NOT NULL,
  trust_score         smallint NOT NULL CHECK (trust_score BETWEEN 0 AND 5),
  rationale           text NOT NULL,
  classified_by_model text NOT NULL,
  classified_at       timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_trust_domain_idx ON public.source_trust(domain);
CREATE INDEX IF NOT EXISTS source_trust_classified_at_idx ON public.source_trust(classified_at);

DROP TRIGGER IF EXISTS set_source_trust_updated_at ON public.source_trust;
CREATE TRIGGER set_source_trust_updated_at
BEFORE UPDATE ON public.source_trust
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.source_trust ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read source trust" ON public.source_trust;
CREATE POLICY "Authenticated can read source trust"
ON public.source_trust
FOR SELECT
TO authenticated
USING (true);

-- No INSERT/UPDATE/DELETE policy — writes happen via the service role
-- (supabaseAdmin) from the landscape and deep-research commands.

ALTER TABLE public.source_trust REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.source_trust;
