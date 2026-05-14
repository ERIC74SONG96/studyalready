-- Annuaire : même règle pour tout le monde — pas de liste sans « communauté ».
-- Visiteur non connecté (auth.uid() IS NULL) → denied, liste vide (comme compte sans adhésion).

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

  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'schema_version', 2,
      'denied', true,
      'profiles', '[]'::jsonb
    );
  END IF;

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
    )
    OR (
      length(jwt_email) > 3
      AND EXISTS (
        SELECT 1 FROM public.form_submissions fs2
        WHERE fs2.form_type = 'rejoindre-reseau'
          AND lower(trim(coalesce(fs2.email, ''))) = jwt_email
      )
    );

  IF NOT allowed THEN
    RETURN jsonb_build_object(
      'schema_version', 2,
      'denied', true,
      'profiles', '[]'::jsonb
    );
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
  'Profils publiés pour l''annuaire. v2 : denied=true si non connecté OU sans communauté (admin, rejoindre user_id ou e-mail, profil annuaire même e-mail).';
