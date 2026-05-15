-- Abonnements annuaire : un membre connecté suit des profils publics.

CREATE TABLE IF NOT EXISTS public.profile_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, profile_id)
);

CREATE INDEX IF NOT EXISTS profile_follows_follower_idx ON public.profile_follows (follower_id);
CREATE INDEX IF NOT EXISTS profile_follows_profile_idx ON public.profile_follows (profile_id);

ALTER TABLE public.profile_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_follows_select_own" ON public.profile_follows;
CREATE POLICY "profile_follows_select_own"
  ON public.profile_follows FOR SELECT
  USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "profile_follows_insert_own" ON public.profile_follows;
CREATE POLICY "profile_follows_insert_own"
  ON public.profile_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "profile_follows_delete_own" ON public.profile_follows;
CREATE POLICY "profile_follows_delete_own"
  ON public.profile_follows FOR DELETE
  USING (auth.uid() = follower_id);

GRANT SELECT, INSERT, DELETE ON public.profile_follows TO authenticated;

COMMENT ON TABLE public.profile_follows IS
  'Abonnements annuaire : follower_id (auth) suit profile_id (profiles publiés).';
