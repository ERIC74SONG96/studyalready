-- StudyAlready — Accès annuaire pour les comptes connectés
--
-- Règle : les visiteurs non connectés (JWT sans uid) conservent l'accès public à l'annuaire.
-- Un utilisateur authentifié ne reçoit la liste des profils publiés que s'il est « dans la communauté » :
--   • compte admin, ou
--   • au moins une soumission form_submissions form_type = 'rejoindre-reseau' avec user_id = son uid, ou
--   • au moins une ligne profiles dont l'email (trim + lower) = email du JWT (profil annuaire, tout statut).
--
-- Réponse JSON : { "schema_version": 2, "denied": boolean, "profiles": jsonb[] }
-- (le client annuaire.js gère aussi l'ancien format tableau seul pour compatibilité.)

CREATE OR REPLACE FUNCTION public.get_annuaire_profiles()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agg jsonb;
  uid uuid;
  jwt_email text;
  allowed boolean;
BEGIN
  uid := auth.uid();

  IF uid IS NOT NULL THEN
    jwt_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
    allowed := EXISTS (SELECT 1 FROM public.admins WHERE user_id = uid)
      OR EXISTS (
        SELECT 1 FROM public.form_submissions fs
        WHERE fs.user_id = uid AND fs.form_type = 'rejoindre-reseau'
      )
      OR (
        length(jwt_email) > 3
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE lower(trim(coalesce(p.email, ''))) = jwt_email
        )
      );
    IF NOT allowed THEN
      RETURN jsonb_build_object(
        'schema_version', 2,
        'denied', true,
        'profiles', '[]'::jsonb
      );
    END IF;
  END IF;

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
  INTO agg
  FROM public.profiles
  WHERE status = 'published';

  RETURN jsonb_build_object(
    'schema_version', 2,
    'denied', false,
    'profiles', coalesce(agg, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_annuaire_profiles() IS
  'Profils publiés pour l''annuaire. Réponse v2 : {schema_version, denied, profiles}. denied=true si utilisateur connecté sans adhésion communauté. Anon : denied=false.';
