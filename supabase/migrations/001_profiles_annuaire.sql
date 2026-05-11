-- StudyAlready — profils annuaire + lecture publique sécurisée (sans email)
-- À exécuter une fois dans Supabase : SQL Editor → New query → Coller → Run

-- Table interne (email jamais exposé via l’API annuaire : lecture via fonction SECURITY DEFINER)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  prenom text NOT NULL,
  initial_nom text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  linkedin text,
  statut text NOT NULL,
  annee text,
  universite text NOT NULL,
  filiere text NOT NULL,
  domaine text NOT NULL,
  ville text,
  specialites text,
  bio text,
  ouvertures jsonb NOT NULL DEFAULT '[]'::jsonb,
  consent_publication boolean NOT NULL DEFAULT false,
  contact_via_studyalready boolean NOT NULL DEFAULT false,
  afficher_linkedin boolean NOT NULL DEFAULT false,
  newsletter boolean NOT NULL DEFAULT false,
  consent_rgpd boolean NOT NULL DEFAULT false
);

-- Toute insertion publique reste « pending » (publication manuelle dans le dashboard)
CREATE OR REPLACE FUNCTION public.profiles_force_pending()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := 'pending';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_force_pending ON public.profiles;
CREATE TRIGGER tr_profiles_force_pending
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_force_pending();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Aucune lecture directe des lignes pour anon (évite l’exposition de l’email même si status = published)
DROP POLICY IF EXISTS "profiles_block_select_anon" ON public.profiles;
CREATE POLICY "profiles_block_select_anon"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (false);

DROP POLICY IF EXISTS "profiles_insert_anon" ON public.profiles;
CREATE POLICY "profiles_insert_anon"
  ON public.profiles
  FOR INSERT
  TO anon
  WITH CHECK (
    consent_rgpd IS TRUE
    AND consent_publication IS TRUE
    AND length(trim(email)) > 3
    AND length(trim(prenom)) > 0
  );

-- Comptes connectés (futur) : même insertion
DROP POLICY IF EXISTS "profiles_insert_authenticated" ON public.profiles;
CREATE POLICY "profiles_insert_authenticated"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    consent_rgpd IS TRUE
    AND consent_publication IS TRUE
    AND length(trim(email)) > 3
    AND length(trim(prenom)) > 0
  );

-- Lecture publique : uniquement champs sûrs, sans email
CREATE OR REPLACE FUNCTION public.get_annuaire_profiles()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'prenom', prenom,
        'initial_nom', initial_nom,
        'universite', universite,
        'filiere', filiere,
        'domaine', domaine,
        'annee', coalesce(annee, ''),
        'statut', statut,
        'ville', coalesce(ville, ''),
        'specialites', coalesce(specialites, ''),
        'bio', coalesce(bio, ''),
        'linkedin', linkedin,
        'contact_publique', contact_via_studyalready,
        'afficher_linkedin', afficher_linkedin,
        'accroche_message', left(coalesce(bio, ''), 160)
      )
      ORDER BY created_at DESC
    ),
    '[]'::jsonb
  )
  FROM public.profiles
  WHERE status = 'published';
$$;

REVOKE ALL ON FUNCTION public.get_annuaire_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_annuaire_profiles() TO anon;
GRANT EXECUTE ON FUNCTION public.get_annuaire_profiles() TO authenticated;

COMMENT ON TABLE public.profiles IS 'Profils annuaire StudyAlready — PUBLICATION : passer status à published dans le dashboard après modération.';
COMMENT ON FUNCTION public.get_annuaire_profiles() IS 'Liste JSON des profils publiés pour le site (sans email).';

-- Droits API (rôle anon = visiteurs du site sans compte)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.profiles TO anon, authenticated;
