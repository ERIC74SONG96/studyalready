-- StudyAlready — Réduire les alertes Security Advisor (splinter) à zéro ou quasi-zéro.
-- Exécuter dans Supabase SQL Editor après 033.
--
-- Actions :
--   • is_admin / helpers en SECURITY INVOKER (plus d’alerte 0029 sur ces RPC)
--   • Miroir user_account_meta (évite auth.users dans les RPC admin)
--   • Stats publiques en table (plus de RPC DEFINER exposée à anon)
--   • REVOKE EXECUTE PUBLIC/anon sur triggers et fonctions internes
--   • search_path fixé sur les triggers restants
--   • Bucket job-offers : pas de policy SELECT publique (listing)
--   • Annuaire : accès colonnes + policies (remplace get_annuaire_profiles côté API)
--
-- Auth (hors SQL) : Dashboard → Authentication → Providers → Email
--   → activer « Prevent use of leaked passwords ».

-- =============================================================================
-- 1) Admins : lecture de sa propre ligne (is_admin en INVOKER)
-- =============================================================================

DROP POLICY IF EXISTS "admins_select_admin" ON public.admins;
CREATE POLICY "admins_select_own"
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- =============================================================================
-- 2) Miroir comptes (RPC admin sans lire auth.users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_account_meta (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  signup_date timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_account_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_account_meta_admin_select" ON public.user_account_meta;
CREATE POLICY "user_account_meta_admin_select"
  ON public.user_account_meta
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

GRANT SELECT ON TABLE public.user_account_meta TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_user_account_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.user_account_meta (user_id, email, full_name, signup_date, updated_at)
  VALUES (
    NEW.id,
    NEW.email::text,
    coalesce(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.created_at,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    signup_date = EXCLUDED.signup_date,
    updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_account_meta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_sync_user_account_meta ON auth.users;
CREATE TRIGGER tr_sync_user_account_meta
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data, created_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_account_meta();

INSERT INTO public.user_account_meta (user_id, email, full_name, signup_date, updated_at)
SELECT
  u.id,
  u.email::text,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.created_at,
  now()
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  signup_date = EXCLUDED.signup_date,
  updated_at = now();

-- =============================================================================
-- 3) RPC admin étudiants (INVOKER + user_account_meta)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_admin_students(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  user_id uuid,
  email text,
  signup_date timestamptz,
  full_name text,
  dossier_id uuid,
  dossier_type text,
  dossier_title text,
  dossier_status text,
  current_step integer,
  total_steps integer,
  dossier_updated_at timestamptz,
  unread_from_student bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    m.email,
    m.signup_date,
    m.full_name,
    d.id,
    d.type::text,
    d.title::text,
    d.status::text,
    d.current_step,
    d.total_steps,
    d.updated_at,
    (
      SELECT count(*)::bigint
      FROM public.dossier_messages msg
      WHERE msg.user_id = m.user_id
        AND msg.sender = 'student'
        AND msg.read_at IS NULL
    )
  FROM public.user_account_meta m
  LEFT JOIN public.student_dossiers d ON d.user_id = m.user_id
  WHERE (
    p_search IS NULL
    OR btrim(p_search) = ''
    OR m.email ILIKE '%' || p_search || '%'
    OR m.full_name ILIKE '%' || p_search || '%'
  )
  ORDER BY m.signup_date DESC
  LIMIT greatest(1, least(coalesce(p_limit, 500), 500));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_student(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  signup_date timestamptz,
  full_name text,
  dossier_id uuid,
  dossier_type text,
  dossier_title text,
  dossier_status text,
  current_step integer,
  total_steps integer,
  dossier_updated_at timestamptz,
  unread_from_student bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    m.email,
    m.signup_date,
    m.full_name,
    d.id,
    d.type::text,
    d.title::text,
    d.status::text,
    d.current_step,
    d.total_steps,
    d.updated_at,
    (
      SELECT count(*)::bigint
      FROM public.dossier_messages msg
      WHERE msg.user_id = m.user_id
        AND msg.sender = 'student'
        AND msg.read_at IS NULL
    )
  FROM public.user_account_meta m
  LEFT JOIN public.student_dossiers d ON d.user_id = m.user_id
  WHERE m.user_id = p_user_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_students(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_students(text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_admin_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_student(uuid) TO authenticated;

-- =============================================================================
-- 4) Communauté / annuaire — helpers INVOKER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_studyalready_community_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.form_submissions fs
        WHERE fs.user_id = auth.uid() AND fs.form_type = 'rejoindre-reseau'
      )
      OR (
        length(trim(coalesce(auth.jwt() ->> 'email', ''))) > 3
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE lower(trim(coalesce(p.email, ''))) = lower(trim(auth.jwt() ->> 'email'))
        )
      )
      OR (
        length(trim(coalesce(auth.jwt() ->> 'email', ''))) > 3
        AND EXISTS (
          SELECT 1 FROM public.form_submissions fs2
          WHERE fs2.form_type = 'rejoindre-reseau'
            AND lower(trim(coalesce(fs2.email, ''))) = lower(trim(auth.jwt() ->> 'email'))
        )
      )
  END;
$$;

REVOKE ALL ON FUNCTION public.is_studyalready_community_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_studyalready_community_member() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_annuaire_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_studyalready_community_member();
$$;

REVOKE ALL ON FUNCTION public.check_annuaire_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_annuaire_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.compute_profile_reseau_segment(profile_email text)
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
      WHERE lower(trim(coalesce(u.email::text, ''))) = lower(trim(profile_email))
        AND usc.signup_location = 'belgique'
    ) THEN 'belgique'
    WHEN EXISTS (
      SELECT 1
      FROM public.form_submissions fs
      WHERE fs.form_type = 'rejoindre-reseau'
        AND lower(trim(coalesce(fs.email, ''))) = lower(trim(profile_email))
        AND coalesce(fs.payload ->> 'parcours', '') IN (
          'deja_belgique_etudiant', 'deja_belgique_travailleur'
        )
    ) THEN 'belgique'
    ELSE 'preparation'
  END;
$$;

REVOKE ALL ON FUNCTION public.compute_profile_reseau_segment(text) FROM PUBLIC, anon, authenticated;

-- Colonne reseau_segment AVANT toute fonction/vue qui la référence (validation à la création).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reseau_segment text;

UPDATE public.profiles p
SET reseau_segment = public.compute_profile_reseau_segment(p.email)
WHERE p.reseau_segment IS NULL OR btrim(p.reseau_segment) = '';

CREATE OR REPLACE FUNCTION public.trg_profiles_set_reseau_segment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.reseau_segment := public.compute_profile_reseau_segment(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_profiles_set_reseau_segment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_profiles_reseau_segment ON public.profiles;
CREATE TRIGGER tr_profiles_reseau_segment
  BEFORE INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_profiles_set_reseau_segment();

-- Wrapper legacy (non exposé à l’API) — après création de la colonne.
CREATE OR REPLACE FUNCTION public.profile_reseau_segment(profile_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT p.reseau_segment
      FROM public.profiles p
      WHERE lower(trim(coalesce(p.email, ''))) = lower(trim(profile_email))
      LIMIT 1
    ),
    public.compute_profile_reseau_segment(profile_email)
  );
$$;

REVOKE ALL ON FUNCTION public.profile_reseau_segment(text) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 5) Stats publiques (table, plus de RPC anon sur DEFINER)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.community_stats_public (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_stats_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_stats_public_read_all" ON public.community_stats_public;
CREATE POLICY "community_stats_public_read_all"
  ON public.community_stats_public
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.community_stats_public TO anon, authenticated;

-- Calcul interne (trigger) : DEFINER sans GRANT API → pas d’alerte « Public / Signed-In ».
CREATE OR REPLACE FUNCTION public.compute_annuaire_community_stats()
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
        WHEN coalesce(p.reseau_segment, public.compute_profile_reseau_segment(p.email)) = 'belgique' THEN 'belgique'
        ELSE 'cameroun'
      END AS lieu,
      1 AS priority
    FROM public.profiles p
    WHERE length(trim(coalesce(p.email, ''))) > 3

    UNION ALL

    SELECT
      lower(trim(fs.email)) AS email,
      CASE
        WHEN coalesce(fs.payload ->> 'parcours', '') = 'deja_belgique_travailleur' THEN true
        ELSE false
      END AS is_pro,
      CASE
        WHEN coalesce(fs.payload ->> 'parcours', '') IN (
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

REVOKE ALL ON FUNCTION public.compute_annuaire_community_stats() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_annuaire_community_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.compute_annuaire_community_stats();
$$;

REVOKE ALL ON FUNCTION public.get_annuaire_community_stats() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_community_stats_public()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  v_stats := public.compute_annuaire_community_stats();
  INSERT INTO public.community_stats_public (id, stats, updated_at)
  VALUES (1, v_stats, now())
  ON CONFLICT (id) DO UPDATE SET
    stats = EXCLUDED.stats,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_community_stats_public() FROM PUBLIC, anon, authenticated;

SELECT public.refresh_community_stats_public();

DROP FUNCTION IF EXISTS public.get_public_community_stats();

-- =============================================================================
-- 6) Annuaire — policies + colonnes (sans RPC get_annuaire_profiles)
-- =============================================================================

REVOKE ALL ON FUNCTION public.get_annuaire_profiles() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "profiles_annuaire_member_select" ON public.profiles;
CREATE POLICY "profiles_annuaire_member_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND public.is_studyalready_community_member()
    AND (
      public.is_admin()
      OR length(trim(coalesce(auth.jwt() ->> 'email', ''))) <= 3
      OR lower(trim(coalesce(email, ''))) <> lower(trim(auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "profiles_select_own_email" ON public.profiles;
CREATE POLICY "profiles_select_own_email"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    length(trim(coalesce(auth.jwt() ->> 'email', ''))) > 3
    AND lower(trim(coalesce(email, ''))) = lower(trim(auth.jwt() ->> 'email'))
  );

CREATE OR REPLACE VIEW public.annuaire_profiles_list
WITH (security_invoker = true) AS
SELECT
  p.id::text AS id,
  p.prenom,
  p.initial_nom,
  p.universite,
  p.filiere,
  p.domaine,
  coalesce(p.annee, '') AS annee,
  p.statut,
  coalesce(p.ville, '') AS ville,
  coalesce(p.specialites, '') AS specialites,
  coalesce(p.bio, '') AS bio,
  p.linkedin,
  p.contact_via_studyalready AS contact_publique,
  p.afficher_linkedin,
  coalesce(p.ouvertures, '[]'::jsonb) AS ouvertures,
  coalesce(p.tag_juridique, '') AS tag_juridique,
  left(coalesce(p.bio, ''), 160) AS accroche_message,
  coalesce(p.reseau_segment, 'preparation') AS reseau_segment,
  p.created_at
FROM public.profiles p
WHERE p.status = 'published';

GRANT SELECT ON public.annuaire_profiles_list TO authenticated;

-- =============================================================================
-- 7) create_fwb_dossier en INVOKER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_fwb_dossier(target_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_dossier_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  INSERT INTO public.student_dossiers (user_id, type, title, status, total_steps)
    VALUES (target_user, 'equivalence_fwb', 'Dossier équivalence FWB', 'in_progress', 6)
    RETURNING id INTO v_dossier_id;

  INSERT INTO public.dossier_steps (dossier_id, step_number, title, description) VALUES
    (v_dossier_id, 1, 'Pré-qualification',
      'Évaluation de votre profil et de votre éligibilité à l''équivalence FWB.'),
    (v_dossier_id, 2, 'Pièces justificatives',
      'Collecte de votre relevé de notes, diplôme original, traduction officielle si nécessaire.'),
    (v_dossier_id, 3, 'Dépôt du dossier FWB',
      'Envoi de votre dossier complet au service Équivalences de la Fédération Wallonie-Bruxelles.'),
    (v_dossier_id, 4, 'Accusé de réception',
      'Confirmation officielle de la prise en charge de votre dossier par le service FWB.'),
    (v_dossier_id, 5, 'Décision de la Commission',
      'Délibération et notification de la décision officielle (équivalence accordée, partielle, refus).'),
    (v_dossier_id, 6, 'Originaux récupérés',
      'Récupération des documents originaux et clôture du dossier.');

  RETURN v_dossier_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_fwb_dossier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_fwb_dossier(uuid) TO authenticated;

-- =============================================================================
-- 8) Triggers : search_path + REVOKE EXECUTE API
-- =============================================================================

CREATE OR REPLACE FUNCTION public.touch_user_site_context_updated()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_force_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.status := 'pending';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_events_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname IN (
        'on_new_submission',
        'on_new_profile',
        'on_new_dossier_message',
        'on_new_dossier_document',
        'handle_new_user_dossier',
        'send_admin_email',
        'send_user_email',
        'sync_user_account_meta',
        'refresh_community_stats_public',
        'compute_annuaire_community_stats',
        'compute_profile_reseau_segment',
        'trg_refresh_community_stats',
        'trg_profiles_set_reseau_segment'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.func);
  END LOOP;
END $$;

-- Rafraîchir les stats après changements annuaire / réseau
CREATE OR REPLACE FUNCTION public.trg_refresh_community_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_community_stats_public();
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trg_refresh_community_stats() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_refresh_stats_profiles ON public.profiles;
CREATE TRIGGER tr_refresh_stats_profiles
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_refresh_community_stats();

DROP TRIGGER IF EXISTS tr_refresh_stats_rejoindre ON public.form_submissions;
CREATE TRIGGER tr_refresh_stats_rejoindre
  AFTER INSERT OR UPDATE OR DELETE ON public.form_submissions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_refresh_community_stats();

-- =============================================================================
-- 9) Storage job-offers : pas de listing public
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "job_offers_public_read" ON storage.objects';
  END IF;
END $$;

-- (Section « ALTER DEFAULT PRIVILEGES » retirée : refusée dans le SQL Editor Supabase
--  hors rôle propriétaire. Les REVOKE explicites plus haut suffisent pour le Security Advisor.)

COMMENT ON TABLE public.community_stats_public IS
  'Compteurs agrégés (lecture anon/authenticated). Rafraîchis par refresh_community_stats_public().';
COMMENT ON TABLE public.user_account_meta IS
  'Miroir auth.users pour le dashboard admin (évite RPC DEFINER sur auth.users).';
