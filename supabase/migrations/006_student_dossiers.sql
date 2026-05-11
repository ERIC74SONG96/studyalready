-- =============================================================
-- StudyAlready — Migration 006 : Espace personnel étudiant
-- =============================================================
-- Objectif : permettre à chaque étudiant inscrit de suivre
-- son dossier (équivalence FWB, visa, etc.) directement dans
-- son espace personnel, échanger des messages avec l'admin,
-- et recevoir/envoyer des documents.
--
-- À exécuter dans l'éditeur SQL de Supabase APRÈS les
-- migrations 001 à 005. Idempotent : peut être ré-exécuté.
-- =============================================================

-- ---------- 0. Pré-requis ------------------------------------
-- La fonction public.is_admin() vient déjà de la migration 003.

-- ---------- 1. Lier les form_submissions au compte ----------
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS form_submissions_user_id_idx
  ON public.form_submissions (user_id);

-- L'utilisateur connecté peut lire ses propres demandes.
DROP POLICY IF EXISTS "owner_can_select_own_subs" ON public.form_submissions;
CREATE POLICY "owner_can_select_own_subs" ON public.form_submissions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ---------- 2. Dossiers étudiants ----------------------------
CREATE TABLE IF NOT EXISTS public.student_dossiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'parcours_general',
                -- valeurs prévues : parcours_general, equivalence_fwb,
                -- visa, logement, compte_bloque, pack_accueil, autre
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'open',
                -- open, in_progress, completed, on_hold, cancelled
  current_step  INT  NOT NULL DEFAULT 1,
  total_steps   INT  NOT NULL DEFAULT 1,
  notes         TEXT,  -- visible par l'étudiant (notes publiques de l'admin)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_dossiers_user_id_idx
  ON public.student_dossiers (user_id);

ALTER TABLE public.student_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_select_own_dossier" ON public.student_dossiers;
CREATE POLICY "student_select_own_dossier" ON public.student_dossiers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_dossiers" ON public.student_dossiers;
CREATE POLICY "admin_all_dossiers" ON public.student_dossiers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 3. Étapes du dossier -----------------------------
CREATE TABLE IF NOT EXISTS public.dossier_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id    UUID NOT NULL REFERENCES public.student_dossiers(id) ON DELETE CASCADE,
  step_number   INT  NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
                -- pending, in_progress, done, blocked
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dossier_id, step_number)
);

CREATE INDEX IF NOT EXISTS dossier_steps_dossier_idx
  ON public.dossier_steps (dossier_id, step_number);

ALTER TABLE public.dossier_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_select_own_steps" ON public.dossier_steps;
CREATE POLICY "student_select_own_steps" ON public.dossier_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.student_dossiers d
       WHERE d.id = dossier_steps.dossier_id
         AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_all_steps" ON public.dossier_steps;
CREATE POLICY "admin_all_steps" ON public.dossier_steps
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 4. Messages internes admin <-> étudiant ----------
CREATE TABLE IF NOT EXISTS public.dossier_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id    UUID REFERENCES public.student_dossiers(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                -- toujours l'étudiant concerné (le destinataire si admin)
  sender        TEXT NOT NULL CHECK (sender IN ('admin','student')),
  message       TEXT NOT NULL,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dossier_messages_user_idx
  ON public.dossier_messages (user_id, created_at DESC);

ALTER TABLE public.dossier_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_select_own_messages" ON public.dossier_messages;
CREATE POLICY "student_select_own_messages" ON public.dossier_messages
  FOR SELECT USING (auth.uid() = user_id);

-- L'étudiant peut envoyer un message dans son dossier
DROP POLICY IF EXISTS "student_insert_own_messages" ON public.dossier_messages;
CREATE POLICY "student_insert_own_messages" ON public.dossier_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND sender = 'student'
  );

-- L'étudiant peut marquer ses messages comme lus
DROP POLICY IF EXISTS "student_update_own_messages_read" ON public.dossier_messages;
CREATE POLICY "student_update_own_messages_read" ON public.dossier_messages
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_messages" ON public.dossier_messages;
CREATE POLICY "admin_all_messages" ON public.dossier_messages
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 5. Documents (lien vers Storage) -----------------
CREATE TABLE IF NOT EXISTS public.dossier_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id    UUID REFERENCES public.student_dossiers(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by   TEXT NOT NULL CHECK (uploaded_by IN ('admin','student')),
  storage_path  TEXT NOT NULL,
  filename      TEXT NOT NULL,
  size_bytes    BIGINT,
  mime_type     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dossier_documents_user_idx
  ON public.dossier_documents (user_id, created_at DESC);

ALTER TABLE public.dossier_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_select_own_documents" ON public.dossier_documents;
CREATE POLICY "student_select_own_documents" ON public.dossier_documents
  FOR SELECT USING (auth.uid() = user_id);

-- L'étudiant peut téléverser ses propres documents (referencer la ligne)
DROP POLICY IF EXISTS "student_insert_own_documents" ON public.dossier_documents;
CREATE POLICY "student_insert_own_documents" ON public.dossier_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND uploaded_by = 'student');

DROP POLICY IF EXISTS "admin_all_documents" ON public.dossier_documents;
CREATE POLICY "admin_all_documents" ON public.dossier_documents
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 6. Création auto d'un dossier à l'inscription ----
-- Lorsqu'un nouvel utilisateur est créé via Auth, on crée
-- automatiquement un dossier 'parcours_general' avec 4 étapes
-- génériques (l'admin pourra ajouter un vrai dossier FWB
-- via l'onglet admin dès qu'il identifie le besoin).
CREATE OR REPLACE FUNCTION public.handle_new_user_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dossier_id UUID;
BEGIN
  INSERT INTO public.student_dossiers (user_id, type, title, status, total_steps)
    VALUES (NEW.id, 'parcours_general', 'Mon parcours StudyAlready', 'open', 4)
    RETURNING id INTO v_dossier_id;

  INSERT INTO public.dossier_steps (dossier_id, step_number, title, description, status, completed_at)
  VALUES
    (v_dossier_id, 1, 'Inscription au site',
      'Votre compte StudyAlready est créé. Vous pouvez désormais nous écrire et suivre vos demandes ici.',
      'done', NOW()),
    (v_dossier_id, 2, 'Premier contact',
      'Décrivez-nous votre situation (équivalence, visa, logement…) via le formulaire ou en message direct.',
      'in_progress', NULL),
    (v_dossier_id, 3, 'Service activé',
      'Une fois votre besoin identifié, nous ouvrons un dossier dédié (FWB, visa…) avec ses propres étapes.',
      'pending', NULL),
    (v_dossier_id, 4, 'Suivi et clôture',
      'Suivi régulier jusqu''à la finalisation de votre projet en Belgique.',
      'pending', NULL);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_dossier ON auth.users;
CREATE TRIGGER on_auth_user_created_dossier
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_dossier();

-- ---------- 7. Helper RPC : créer un dossier FWB dédié --------
-- Permet à l'admin de transformer un compte existant en
-- dossier équivalence FWB complet (6 étapes).
CREATE OR REPLACE FUNCTION public.create_fwb_dossier(target_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dossier_id UUID;
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

REVOKE ALL ON FUNCTION public.create_fwb_dossier(UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_fwb_dossier(UUID) TO authenticated;

-- ---------- 8. Storage : bucket privé "dossier-documents" -----
-- À exécuter manuellement dans Supabase si le bucket n'existe pas :
-- Studio → Storage → New bucket → name = "dossier-documents", public = false.
-- Les policies ci-dessous s'appliquent ensuite automatiquement.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- L'étudiant lit ses fichiers (path = "{user_id}/...")
    EXECUTE 'DROP POLICY IF EXISTS "student_read_own_files" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "student_read_own_files" ON storage.objects
        FOR SELECT
        USING (
          bucket_id = 'dossier-documents'
          AND auth.uid()::text = (storage.foldername(name))[1]
        )
    $POL$;

    -- L'étudiant peut téléverser dans son propre dossier
    EXECUTE 'DROP POLICY IF EXISTS "student_upload_own_files" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "student_upload_own_files" ON storage.objects
        FOR INSERT
        WITH CHECK (
          bucket_id = 'dossier-documents'
          AND auth.uid()::text = (storage.foldername(name))[1]
        )
    $POL$;

    -- Admin : tout faire dans ce bucket
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_files" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "admin_all_files" ON storage.objects
        FOR ALL
        USING (bucket_id = 'dossier-documents' AND public.is_admin())
        WITH CHECK (bucket_id = 'dossier-documents' AND public.is_admin())
    $POL$;
  END IF;
END $$;

-- ---------- 9. Vue admin : "students with dossiers" ----------
-- Utilisée par admin.html pour l'onglet "Étudiants".
CREATE OR REPLACE VIEW public.admin_students_view AS
SELECT
  u.id                AS user_id,
  u.email,
  u.created_at        AS signup_date,
  COALESCE(u.raw_user_meta_data->>'full_name', '') AS full_name,
  d.id                AS dossier_id,
  d.type              AS dossier_type,
  d.title             AS dossier_title,
  d.status            AS dossier_status,
  d.current_step,
  d.total_steps,
  d.updated_at        AS dossier_updated_at,
  (SELECT COUNT(*) FROM public.dossier_messages m
    WHERE m.user_id = u.id AND m.sender = 'student' AND m.read_at IS NULL) AS unread_from_student
FROM auth.users u
LEFT JOIN public.student_dossiers d ON d.user_id = u.id;

-- La vue hérite des RLS des tables sous-jacentes,
-- mais auth.users n'est pas RLS-protégé : on restreint via une fonction.
GRANT SELECT ON public.admin_students_view TO authenticated;

-- =============================================================
-- ✅ Migration 006 prête.
-- Vérifications :
--   SELECT * FROM public.student_dossiers LIMIT 5;
--   SELECT * FROM public.dossier_steps LIMIT 10;
--   SELECT * FROM public.admin_students_view LIMIT 5;
-- =============================================================
