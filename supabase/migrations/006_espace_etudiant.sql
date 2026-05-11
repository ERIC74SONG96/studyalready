-- StudyAlready — Espace étudiant : dossiers, étapes, messages, rattachement form_submissions
-- À exécuter dans Supabase : SQL Editor → New query → Coller chaque bloc → Run
-- Si la copie complète passe sans erreur, vous pouvez tout exécuter en une fois.

-- ============================================================
-- BLOC 1 / 5 — Table des dossiers étudiants
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_type text NOT NULL DEFAULT 'parcours'
    CHECK (dossier_type IN ('parcours', 'equivalence_fwb', 'visa', 'logement', 'inscription', 'autre')),
  title text NOT NULL DEFAULT 'Mon parcours StudyAlready',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'paused', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_dossiers_user ON public.student_dossiers (user_id);

ALTER TABLE public.student_dossiers ENABLE ROW LEVEL SECURITY;

-- L'étudiant ne voit que ses propres dossiers
DROP POLICY IF EXISTS "dossiers_select_owner" ON public.student_dossiers;
CREATE POLICY "dossiers_select_owner"
  ON public.student_dossiers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "dossiers_update_owner_notes" ON public.student_dossiers;
CREATE POLICY "dossiers_update_owner_notes"
  ON public.student_dossiers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "dossiers_insert_admin" ON public.student_dossiers;
CREATE POLICY "dossiers_insert_admin"
  ON public.student_dossiers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "dossiers_delete_admin" ON public.student_dossiers;
CREATE POLICY "dossiers_delete_admin"
  ON public.student_dossiers FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_dossiers TO authenticated;


-- ============================================================
-- BLOC 2 / 5 — Étapes des dossiers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dossier_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.student_dossiers(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 0,
  label text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done')),
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossier_steps_dossier ON public.dossier_steps (dossier_id, position);

ALTER TABLE public.dossier_steps ENABLE ROW LEVEL SECURITY;

-- L'étudiant voit les étapes de ses propres dossiers (via JOIN)
DROP POLICY IF EXISTS "steps_select_owner" ON public.dossier_steps;
CREATE POLICY "steps_select_owner"
  ON public.dossier_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_dossiers d
      WHERE d.id = dossier_steps.dossier_id
        AND (d.user_id = auth.uid() OR public.is_admin())
    )
  );

-- Seul l'admin peut modifier le statut des étapes
DROP POLICY IF EXISTS "steps_modify_admin" ON public.dossier_steps;
CREATE POLICY "steps_modify_admin"
  ON public.dossier_steps FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dossier_steps TO authenticated;


-- ============================================================
-- BLOC 3 / 5 — Messages admin <-> étudiant
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dossier_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid REFERENCES public.student_dossiers(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- l'étudiant concerné
  sender text NOT NULL CHECK (sender IN ('student', 'admin')),
  body text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 5000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossier_messages_user ON public.dossier_messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossier_messages_dossier ON public.dossier_messages (dossier_id, created_at);

ALTER TABLE public.dossier_messages ENABLE ROW LEVEL SECURITY;

-- L'étudiant voit ses messages
DROP POLICY IF EXISTS "messages_select_owner" ON public.dossier_messages;
CREATE POLICY "messages_select_owner"
  ON public.dossier_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- L'étudiant peut envoyer un message à l'admin (sender = 'student')
DROP POLICY IF EXISTS "messages_insert_student" ON public.dossier_messages;
CREATE POLICY "messages_insert_student"
  ON public.dossier_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (sender = 'student' AND user_id = auth.uid())
    OR (public.is_admin())
  );

-- L'étudiant peut marquer ses messages comme lus
DROP POLICY IF EXISTS "messages_update_read" ON public.dossier_messages;
CREATE POLICY "messages_update_read"
  ON public.dossier_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

GRANT SELECT, INSERT, UPDATE ON TABLE public.dossier_messages TO authenticated;


-- ============================================================
-- BLOC 4 / 5 — Rattacher form_submissions au compte étudiant
-- ============================================================

-- Colonne user_id (optionnelle) sur form_submissions
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_user ON public.form_submissions (user_id);

-- L'étudiant connecté peut lire ses propres demandes (par user_id ou par email)
DROP POLICY IF EXISTS "form_submissions_select_owner" ON public.form_submissions;
CREATE POLICY "form_submissions_select_owner"
  ON public.form_submissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR public.is_admin()
  );


-- ============================================================
-- BLOC 5 / 5 — Auto-création d'un dossier au signup
-- ============================================================

-- Quand un nouvel utilisateur s'inscrit, on crée automatiquement
-- un dossier "Mon parcours StudyAlready" avec 5 étapes types.

CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_dossier_id uuid;
BEGIN
  -- On ignore les comptes admin (pas de dossier auto pour eux)
  IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student_dossiers (user_id, dossier_type, title, status)
  VALUES (NEW.id, 'parcours', 'Mon parcours StudyAlready', 'open')
  RETURNING id INTO new_dossier_id;

  INSERT INTO public.dossier_steps (dossier_id, position, label, description, status, done_at)
  VALUES
    (new_dossier_id, 1, 'Compte créé', 'Votre espace étudiant est actif. Bienvenue !', 'done', now()),
    (new_dossier_id, 2, 'Premier contact', 'Écrivez-nous (pré-qualification, message, WhatsApp) pour que nous prenions connaissance de votre projet.', 'pending', NULL),
    (new_dossier_id, 3, 'Évaluation et plan d''action', 'L''équipe StudyAlready étudie votre dossier et propose les prochaines étapes.', 'pending', NULL),
    (new_dossier_id, 4, 'Démarches en cours', 'Équivalence FWB, visa, logement... selon votre besoin. Le détail apparaîtra ici.', 'pending', NULL),
    (new_dossier_id, 5, 'Arrivée et installation', 'Pack accueil, banque, transport... pour bien démarrer en Belgique.', 'pending', NULL);

  -- Un premier message d'accueil
  INSERT INTO public.dossier_messages (dossier_id, user_id, sender, body)
  VALUES (
    new_dossier_id,
    NEW.id,
    'admin',
    'Bienvenue dans votre espace StudyAlready ! Vous pouvez nous écrire directement ici, et nous mettrons à jour votre dossier au fur et à mesure. Pour toute urgence, le WhatsApp +32 465 33 94 48 reste le plus rapide.'
  );

  RETURN NEW;
END;
$$;

-- Le trigger se déclenche après chaque insertion dans auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_student();


-- ============================================================
-- (Optionnel) Initialiser les comptes existants
-- ============================================================
-- Si vous avez déjà des comptes étudiants créés AVANT d'exécuter ce script,
-- décommentez ce bloc pour leur créer rétroactivement un dossier d'accueil :

-- DO $$
-- DECLARE u record;
-- BEGIN
--   FOR u IN
--     SELECT au.id FROM auth.users au
--     LEFT JOIN public.admins ad ON ad.user_id = au.id
--     LEFT JOIN public.student_dossiers sd ON sd.user_id = au.id
--     WHERE ad.user_id IS NULL AND sd.id IS NULL
--   LOOP
--     PERFORM public.handle_new_student_for(u.id);
--   END LOOP;
-- END $$;

COMMENT ON TABLE public.student_dossiers IS 'Dossiers de suivi des étudiants StudyAlready (un par étudiant principal, plusieurs possibles si nécessaire).';
COMMENT ON TABLE public.dossier_steps IS 'Étapes/checklist d''un dossier. Visible par l''étudiant, modifiable par l''admin uniquement.';
COMMENT ON TABLE public.dossier_messages IS 'Messagerie interne entre l''étudiant et l''équipe StudyAlready, dans le contexte d''un dossier.';
