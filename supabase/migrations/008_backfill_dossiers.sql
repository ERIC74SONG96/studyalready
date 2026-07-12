-- =============================================================
-- StudyAlready — Migration 008 : Rattrapage des comptes existants
-- =============================================================
-- Objectif : créer rétroactivement un dossier "Mon parcours
-- StudyAlready" + ses 4 étapes pour chaque compte étudiant
-- inscrit AVANT l'exécution de la migration 006.
--
-- Les nouveaux comptes continuent d'être traités automatiquement
-- par le trigger on_auth_user_created_dossier (migration 006).
--
-- Idempotent : ne crée rien pour les comptes qui ont déjà un dossier.
--
-- À exécuter une seule fois dans Supabase : SQL Editor → New query.
-- =============================================================

DO $$
DECLARE
  u RECORD;
  v_dossier_id UUID;
  v_count INT := 0;
BEGIN
  /* Pour chaque utilisateur auth qui :
       - n'est PAS un admin,
       - n'a PAS encore de dossier dans student_dossiers. */
  FOR u IN
    SELECT au.id, au.email
      FROM auth.users au
      LEFT JOIN public.admins ad        ON ad.user_id = au.id
      LEFT JOIN public.student_dossiers sd ON sd.user_id = au.id
     WHERE ad.user_id IS NULL
       AND sd.id IS NULL
  LOOP
    /* 1. Création du dossier générique. */
    INSERT INTO public.student_dossiers
      (user_id, type, title, status, total_steps)
    VALUES
      (u.id, 'parcours_general', 'Mon parcours StudyAlready', 'open', 4)
    RETURNING id INTO v_dossier_id;

    /* 2. Étapes par défaut. */
    INSERT INTO public.dossier_steps
      (dossier_id, step_number, title, description, status, completed_at)
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

    /* 3. Premier message d'accueil dans la messagerie. */
    INSERT INTO public.dossier_messages
      (dossier_id, user_id, sender, message)
    VALUES (
      v_dossier_id,
      u.id,
      'admin',
      'Bienvenue dans votre espace StudyAlready ! Vous pouvez nous écrire directement ici, partager des documents et suivre l''avancement de votre dossier. Pour toute urgence, écrivez-nous à contact@studyalready.com.'
    );

    v_count := v_count + 1;
    RAISE NOTICE 'Dossier créé pour %', u.email;
  END LOOP;

  RAISE NOTICE '✅ Rattrapage terminé : % dossier(s) créé(s).', v_count;
END $$;

-- =============================================================
-- Vérification :
--   SELECT u.email, d.title, d.created_at
--     FROM auth.users u
--     LEFT JOIN public.student_dossiers d ON d.user_id = u.id
--    ORDER BY u.created_at DESC;
-- =============================================================
