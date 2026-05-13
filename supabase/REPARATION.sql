-- =====================================================================
-- StudyAlready — Script de reparation post-audit
-- =====================================================================
-- A executer dans Supabase -> SQL Editor -> New query.
--
-- Ce script corrige les 2 problemes detectes :
--   1. Trigger manquant pour creer automatiquement un dossier
--      a chaque inscription d'un nouvel etudiant.
--   2. Cle API Resend manquante (= plus d'emails admin automatiques).
--
-- ATTENTION : avant de lancer, REMPLACEZ "VOTRE_CLE_RESEND_ICI"
-- (ligne 70 environ) par votre vraie cle Resend (commence par re_...).
-- =====================================================================


-- ----- 1. Trigger "creation dossier auto" pour nouveaux comptes -------
-- Verifie / recree la fonction handle_new_user_dossier
-- et le trigger on_auth_user_created_dossier sur auth.users.

CREATE OR REPLACE FUNCTION public.handle_new_user_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dossier_id UUID;
BEGIN
  -- Ne pas creer de dossier pour un futur admin (rare mais possible).
  IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student_dossiers (user_id, type, title, status, total_steps)
    VALUES (NEW.id, 'parcours_general', 'Mon parcours StudyAlready', 'open', 4)
    RETURNING id INTO v_dossier_id;

  INSERT INTO public.dossier_steps (dossier_id, step_number, title, description, status, completed_at)
  VALUES
    (v_dossier_id, 1, 'Inscription au site',
      'Votre compte StudyAlready est cree. Vous pouvez desormais nous ecrire et suivre vos demandes ici.',
      'done', NOW()),
    (v_dossier_id, 2, 'Premier contact',
      'Decrivez-nous votre situation (equivalence, visa, logement...) via le formulaire ou en message direct.',
      'in_progress', NULL),
    (v_dossier_id, 3, 'Service active',
      'Une fois votre besoin identifie, nous ouvrons un dossier dedie (FWB, visa...) avec ses propres etapes.',
      'pending', NULL),
    (v_dossier_id, 4, 'Suivi et cloture',
      'Suivi regulier jusqu''a la finalisation de votre projet en Belgique.',
      'pending', NULL);

  INSERT INTO public.dossier_messages (dossier_id, user_id, sender, message)
  VALUES (
    v_dossier_id, NEW.id, 'admin',
    'Bienvenue dans votre espace StudyAlready ! Vous pouvez nous ecrire directement ici, partager des documents et suivre l''avancement de votre dossier. Pour toute urgence, le WhatsApp +32 465 33 94 48 reste le plus rapide.'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_dossier ON auth.users;
CREATE TRIGGER on_auth_user_created_dossier
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_dossier();


-- ----- 2. Cle API Resend (notifications email admin) ------------------
-- Remplacez la chaine ci-dessous par votre vraie cle Resend.
-- La cle se recupere sur : https://resend.com/api-keys
-- Format attendu : re_XXXXXXXXXXXXXXXXXXXX

INSERT INTO public.private_settings (key, value)
VALUES ('resend_api_key', 'VOTRE_CLE_RESEND_ICI')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verifie egalement que l'email de notification est bien defini.
INSERT INTO public.private_settings (key, value)
VALUES ('notify_to', 'contact@studyalready.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ----- 3. Verification immediate --------------------------------------
SELECT
  'Trigger nouveaux comptes' AS verification,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created_dossier'
  ) THEN 'OK' ELSE 'KO' END AS statut
UNION ALL SELECT
  'Cle Resend',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.private_settings
      WHERE key = 'resend_api_key' AND value LIKE 're_%'
    ) THEN 'OK'
    WHEN EXISTS (
      SELECT 1 FROM public.private_settings
      WHERE key = 'resend_api_key' AND value = 'VOTRE_CLE_RESEND_ICI'
    ) THEN 'KO -> remplacez VOTRE_CLE_RESEND_ICI par la vraie cle'
    ELSE 'KO -> ajoutez la cle'
  END
UNION ALL SELECT
  'Email destinataire (notify_to)',
  CASE WHEN EXISTS (
    SELECT 1 FROM public.private_settings
    WHERE key = 'notify_to' AND value <> ''
  ) THEN 'OK' ELSE 'KO' END;
