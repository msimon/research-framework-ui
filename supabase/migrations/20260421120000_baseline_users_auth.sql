-- Baseline schema: auth/public user sync + role-aware RLS.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users(role);

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own record" ON public.users;
CREATE POLICY "Users can read own record"
ON public.users
FOR SELECT
TO authenticated
USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own record" ON public.users;
CREATE POLICY "Users can update own record"
ON public.users
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role'),
    'user'
  ) = required_role;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

DROP POLICY IF EXISTS "Admin full access to users" ON public.users;
CREATE POLICY "Admin full access to users"
ON public.users
FOR ALL
TO authenticated
USING ((select public.has_role('admin')))
WITH CHECK ((select public.has_role('admin')));

CREATE OR REPLACE FUNCTION public.set_default_user_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb);

  IF NEW.raw_app_meta_data ->> 'role' IS NULL THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data || '{"role": "user"}'::jsonb;
  END IF;

  IF NEW.raw_app_meta_data ->> 'active' IS NULL THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data || '{"active": true}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_set_metadata ON auth.users;
CREATE TRIGGER on_auth_user_created_set_metadata
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.set_default_user_metadata();

CREATE OR REPLACE FUNCTION public.copy_auth_user_to_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'name',
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'user'),
    COALESCE((NEW.raw_app_meta_data ->> 'active')::boolean, true),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    active = EXCLUDED.active,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.copy_auth_user_to_public();

CREATE OR REPLACE FUNCTION public.sync_auth_user_to_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    email = NEW.email,
    name = NEW.raw_user_meta_data ->> 'name',
    role = COALESCE(NEW.raw_app_meta_data ->> 'role', 'user'),
    active = COALESCE((NEW.raw_app_meta_data ->> 'active')::boolean, true),
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_user_to_public();

INSERT INTO public.users (id, email, name, role, active, created_at, updated_at)
SELECT
  au.id,
  au.email,
  au.raw_user_meta_data ->> 'name',
  COALESCE(au.raw_app_meta_data ->> 'role', 'user'),
  COALESCE((au.raw_app_meta_data ->> 'active')::boolean, true),
  now(),
  now()
FROM auth.users au
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  active = EXCLUDED.active,
  updated_at = now();
