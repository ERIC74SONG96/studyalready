-- StudyAlready — Rattrapage : remplir user_site_context pour les comptes Auth existants
-- (avant la mise en ligne du JS de sync). À exécuter une fois dans SQL Editor si la table est vide.

INSERT INTO public.user_site_context (user_id, signup_location, signup_be_mode, espace_persona)
SELECT
  u.id,
  CASE
    WHEN u.raw_user_meta_data->>'signup_location' IN ('belgique', 'hors')
      THEN u.raw_user_meta_data->>'signup_location'
    WHEN COALESCE(u.raw_user_meta_data->>'espace_persona', '') IN ('belgique_etudiant', 'travailleur')
      THEN 'belgique'
    ELSE 'hors'
  END::text,
  CASE
    WHEN u.raw_user_meta_data->>'signup_location' = 'hors' THEN NULL
    WHEN u.raw_user_meta_data->>'signup_be_mode' IN ('etudiant', 'pro')
      THEN u.raw_user_meta_data->>'signup_be_mode'
    WHEN u.raw_user_meta_data->>'espace_persona' = 'travailleur' THEN 'pro'
    WHEN u.raw_user_meta_data->>'espace_persona' = 'belgique_etudiant' THEN 'etudiant'
    ELSE NULL
  END::text,
  CASE
    WHEN u.raw_user_meta_data->>'espace_persona' IN ('cameroun', 'belgique_etudiant', 'travailleur', 'visiteur')
      THEN u.raw_user_meta_data->>'espace_persona'
    ELSE 'cameroun'
  END::text
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_site_context c WHERE c.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
