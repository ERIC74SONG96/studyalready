-- Matrice stats : étudiants / professionnels × Belgique / Cameroun.

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
      CASE
        WHEN public.profile_reseau_segment(p.email) = 'belgique' THEN 'belgique'
        ELSE 'cameroun'
      END AS lieu,
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
      CASE
        WHEN coalesce(fs.payload->>'parcours', '') IN (
          'deja_belgique_etudiant', 'deja_belgique_travailleur'
        ) THEN 'belgique'
        ELSE 'cameroun'
      END AS lieu,
      2 AS priority
    FROM public.form_submissions fs
    WHERE fs.form_type = 'rejoindre-reseau'
      AND length(trim(coalesce(fs.email, ''))) > 3
  ),
  dedup AS (
    SELECT DISTINCT ON (email)
      email,
      is_pro,
      lieu
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
    ),
    'matrix', jsonb_build_object(
      'students', jsonb_build_object(
        'total', (SELECT count(*)::int FROM dedup WHERE NOT is_pro),
        'belgique', (SELECT count(*)::int FROM dedup WHERE NOT is_pro AND lieu = 'belgique'),
        'cameroun', (SELECT count(*)::int FROM dedup WHERE NOT is_pro AND lieu = 'cameroun')
      ),
      'professionals', jsonb_build_object(
        'total', (SELECT count(*)::int FROM dedup WHERE is_pro),
        'belgique', (SELECT count(*)::int FROM dedup WHERE is_pro AND lieu = 'belgique'),
        'cameroun', (SELECT count(*)::int FROM dedup WHERE is_pro AND lieu = 'cameroun')
      )
    )
  );
$$;
