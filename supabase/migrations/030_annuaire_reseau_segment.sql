-- Segment parcours (Belgique vs préparation Cameroun) pour filtre annuaire.

CREATE OR REPLACE FUNCTION public.profile_reseau_segment(profile_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(trim(coalesce(profile_email, ''))) <= 3 THEN 'preparation'
    WHEN EXISTS (
      SELECT 1
      FROM public.user_site_context usc
      INNER JOIN auth.users u ON u.id = usc.user_id
      WHERE lower(trim(coalesce(u.email, ''))) = lower(trim(profile_email))
        AND usc.signup_location = 'belgique'
    ) THEN 'belgique'
    WHEN EXISTS (
      SELECT 1
      FROM public.form_submissions fs
      WHERE fs.form_type = 'rejoindre-reseau'
        AND lower(trim(coalesce(fs.email, ''))) = lower(trim(profile_email))
        AND coalesce(fs.payload->>'parcours', '') IN (
          'deja_belgique_etudiant', 'deja_belgique_travailleur'
        )
    ) THEN 'belgique'
    ELSE 'preparation'
  END;
$$;

COMMENT ON FUNCTION public.profile_reseau_segment(text) IS
  'belgique = sur place ; preparation = projet depuis le Cameroun / hors Belgique (déclaratif).';

REVOKE ALL ON FUNCTION public.profile_reseau_segment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_reseau_segment(text) TO authenticated;

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
  has_own_profile boolean;
  stats jsonb;
BEGIN
  uid := auth.uid();
  stats := public.get_annuaire_community_stats();

  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'schema_version', 2,
      'denied', true,
      'viewer_has_profile', false,
      'community_stats', stats,
      'profiles', '[]'::jsonb
    );
  END IF;

  jwt_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));

  has_own_profile := length(jwt_email) > 3 AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(trim(coalesce(p.email, ''))) = jwt_email
      AND p.status = 'published'
  );

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
      'viewer_has_profile', has_own_profile,
      'community_stats', stats,
      'profiles', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id::text,
        'prenom', p.prenom,
        'initial_nom', p.initial_nom,
        'universite', p.universite,
        'filiere', p.filiere,
        'domaine', p.domaine,
        'annee', coalesce(p.annee, ''),
        'statut', p.statut,
        'ville', coalesce(p.ville, ''),
        'specialites', coalesce(p.specialites, ''),
        'bio', coalesce(p.bio, ''),
        'linkedin', p.linkedin,
        'contact_publique', p.contact_via_studyalready,
        'afficher_linkedin', p.afficher_linkedin,
        'ouvertures', coalesce(p.ouvertures, '[]'::jsonb),
        'tag_juridique', coalesce(p.tag_juridique, ''),
        'accroche_message', left(coalesce(p.bio, ''), 160),
        'reseau_segment', public.profile_reseau_segment(p.email)
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO agg
  FROM public.profiles p
  WHERE p.status = 'published'
    AND (
      EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = uid)
      OR length(jwt_email) <= 3
      OR lower(trim(coalesce(p.email, ''))) <> jwt_email
    );

  RETURN jsonb_build_object(
    'schema_version', 2,
    'denied', false,
    'viewer_has_profile', has_own_profile,
    'community_stats', stats,
    'profiles', coalesce(agg, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_annuaire_profiles() IS
  'Profils publiés + community_stats + reseau_segment (belgique|preparation).';
