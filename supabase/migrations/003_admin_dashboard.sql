-- StudyAlready — Espace administrateur (dashboard sur le site)
-- À exécuter une fois dans Supabase : SQL Editor → New query → Coller → Run

-- ============================================================
-- 1) Table des comptes administrateurs
--    On référence directement auth.users : 1 admin = 1 compte Supabase Auth.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Un admin peut voir la liste des admins (utile pour l'écran de paramètres)
DROP POLICY IF EXISTS "admins_select_admin" ON public.admins;
CREATE POLICY "admins_select_admin"
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admins));

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.admins TO authenticated;

-- ============================================================
-- 2) Fonction utilitaire : suis-je admin ?
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 3) Policies sur form_submissions : admin peut tout lire / tout modifier
-- ============================================================

DROP POLICY IF EXISTS "form_submissions_select_admin" ON public.form_submissions;
CREATE POLICY "form_submissions_select_admin"
  ON public.form_submissions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "form_submissions_update_admin" ON public.form_submissions;
CREATE POLICY "form_submissions_update_admin"
  ON public.form_submissions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "form_submissions_delete_admin" ON public.form_submissions;
CREATE POLICY "form_submissions_delete_admin"
  ON public.form_submissions
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT SELECT, UPDATE, DELETE ON TABLE public.form_submissions TO authenticated;

-- ============================================================
-- 4) Policies sur profiles : admin peut tout lire et publier/rejeter
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT SELECT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

-- ============================================================
-- 5) Mode d'emploi pour activer le premier admin
-- ============================================================
--
-- Étape A — Créer le compte admin (à faire une fois, dans Supabase) :
--   Dashboard Supabase → Authentication → Users → Add user → "Add user with email"
--   Email    : votre adresse (ex. contact@studyalready.com)
--   Password : un mot de passe fort
--   ☑ Auto Confirm User
--   → Cliquer "Create user"
--
-- Étape B — Donner le rôle admin (toujours dans Supabase) :
--   Toujours dans Authentication → Users, copier l'UUID du compte
--   (colonne UID), puis lancer dans le SQL Editor :
--
--     INSERT INTO public.admins (user_id, email, full_name)
--     VALUES (
--       'COLLER-LE-UID-ICI',
--       'contact@studyalready.com',
--       'Admin StudyAlready'
--     );
--
-- Étape C — Se connecter sur le site :
--   Aller sur https://www.studyalready.com/admin-login.html
--   Saisir email + mot de passe → redirection automatique vers /admin.html

COMMENT ON TABLE public.admins IS 'Comptes administrateurs autorisés à consulter le dashboard du site.';
COMMENT ON FUNCTION public.is_admin() IS 'Renvoie true si l''utilisateur connecté fait partie de la table admins.';
