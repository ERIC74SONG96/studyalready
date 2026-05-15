-- Statistiques communauté : tous les inscrits (profils tous statuts + rejoindre-reseau), dédoublonnés par e-mail.

CREATE OR REPLACE FUNCTION public.get_annuaire_community_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH combined AS (
    SELECT
      lower(trim(p.email)) AS email,
      CASE
        WHEN coalesce(p.statut, '') = 'Diplômé·e / Professionnel·le' THEN true
        ELSE false
      END AS is_pro,
      1 AS priority
    FROM public.profiles p
    WHERE length(trim(coalesce(p.email, ''))) > 3

    UNION ALL

    SELECT
      lower(trim(fs.email)) AS email,
      CASE
        WHEN coalesce(fs.payload->>'parcours', '') = 'deja_belgique_travailleur' THEN true
        ELSE false
      END AS is_pro,
      2 AS priority
    FROM public.form_submissions fs
    WHERE fs.form_type = 'rejoindre-reseau'
      AND length(trim(coalesce(fs.email, ''))) > 3
  ),
  dedup AS (
    SELECT DISTINCT ON (email)
      email,
      is_pro
    FROM combined
    ORDER BY email, priority
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*)::int FROM dedup),
    'students', (SELECT count(*)::int FROM dedup WHERE NOT is_pro),
    'professionals', (SELECT count(*)::int FROM dedup WHERE is_pro),
    'published_profiles', (
      SELECT count(*)::int
      FROM public.profiles
      WHERE status = 'published'
        AND length(trim(coalesce(email, ''))) > 3
    )
  );
$$;

COMMENT ON FUNCTION public.get_annuaire_community_stats() IS
  'Compteurs communauté : membres uniques (profil ou rejoindre-reseau), étudiants vs pros, fiches publiées annuaire.';

REVOKE ALL ON FUNCTION public.get_annuaire_community_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_annuaire_community_stats() TO authenticated;

-- Intégré dans get_annuaire_profiles pour un seul appel client.
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
        'ouvertures', coalesce(ouvertures, '[]'::jsonb),
        'tag_juridique', coalesce(tag_juridique, ''),
        'accroche_message', left(coalesce(bio, ''), 160)
      )
      ORDER BY created_at DESC
    ),
    '[]'::jsonb
  )
  INTO agg
  FROM public.profiles
  WHERE status = 'published'
    AND (
      EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = uid)
      OR length(jwt_email) <= 3
      OR lower(trim(coalesce(email, ''))) <> jwt_email
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
  'Profils publiés annuaire + community_stats (tous inscrits) + viewer_has_profile.';
