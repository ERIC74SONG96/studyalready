-- StudyAlready — Contexte d'inscription (lieu déclaré + persona) pour personnalisation et ciblage des contenus.
-- Remplie côté client à l'inscription / connexion ; les comptes anciens sont complétés par inférence depuis espace_persona.

CREATE TABLE IF NOT EXISTS public.user_site_context (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  signup_location text NOT NULL CHECK (signup_location IN ('belgique', 'hors')),
  signup_be_mode text CHECK (signup_be_mode IS NULL OR signup_be_mode IN ('etudiant', 'pro')),
  espace_persona text NOT NULL CHECK (espace_persona IN ('cameroun', 'belgique_etudiant', 'travailleur', 'visiteur'))
);

CREATE INDEX IF NOT EXISTS idx_user_site_context_location ON public.user_site_context (signup_location);
CREATE INDEX IF NOT EXISTS idx_user_site_context_persona ON public.user_site_context (espace_persona);

COMMENT ON TABLE public.user_site_context IS 'Lieu déclaré à l''inscription (Belgique / hors) et persona StudyAlready — source pour accueil personnalisé, emails, règles métier.';

ALTER TABLE public.user_site_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_site_context_select_own" ON public.user_site_context;
CREATE POLICY "user_site_context_select_own"
  ON public.user_site_context
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_site_context_insert_own" ON public.user_site_context;
CREATE POLICY "user_site_context_insert_own"
  ON public.user_site_context
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_site_context_update_own" ON public.user_site_context;
CREATE POLICY "user_site_context_update_own"
  ON public.user_site_context
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_site_context_admin_all" ON public.user_site_context;
CREATE POLICY "user_site_context_admin_all"
  ON public.user_site_context
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON TABLE public.user_site_context TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_user_site_context_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_user_site_context_updated ON public.user_site_context;
CREATE TRIGGER tr_user_site_context_updated
  BEFORE UPDATE ON public.user_site_context
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_site_context_updated();
