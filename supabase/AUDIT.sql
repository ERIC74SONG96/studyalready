-- =====================================================================
-- StudyAlready — Audit complet de la base Supabase (resultat unifie)
-- =====================================================================
-- A executer dans : Supabase Dashboard -> SQL Editor -> New query
-- Coller TOUT ce fichier et cliquer sur RUN.
-- Le resultat est UNE SEULE TABLE avec une colonne "section" pour
-- regrouper, une colonne "element" et une colonne "statut".
-- Cherchez les lignes ou statut commence par "KO" ou "MANQUE" : ce sont
-- celles a corriger en lancant la migration indiquee.
-- =====================================================================

WITH
-- 1/ TABLES & VUE attendues
expected_tables AS (
  SELECT * FROM (VALUES
    ('profiles',           'table', '001_profiles_annuaire.sql'),
    ('form_submissions',   'table', '002_form_submissions.sql'),
    ('admins',             'table', '003_admin_dashboard.sql'),
    ('private_settings',   'table', '005_email_notifications.sql'),
    ('student_dossiers',   'table', '006_student_dossiers.sql'),
    ('dossier_steps',      'table', '006_student_dossiers.sql'),
    ('dossier_messages',   'table', '006_student_dossiers.sql'),
    ('dossier_documents',  'table', '006_student_dossiers.sql'),
    ('admin_students_view','view',  '006_student_dossiers.sql')
  ) AS t(name, kind, migration)
),
audit_tables AS (
  SELECT
    '1. Tables & vue' AS section,
    e.name AS element,
    CASE
      WHEN e.kind = 'table' AND EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = e.name
      ) THEN 'OK'
      WHEN e.kind = 'view' AND EXISTS (
        SELECT 1 FROM pg_views
        WHERE schemaname = 'public' AND viewname = e.name
      ) THEN 'OK'
      ELSE 'MANQUE -> executer ' || e.migration
    END AS statut
  FROM expected_tables e
),
-- 2/ FONCTIONS attendues
expected_fn AS (
  SELECT * FROM (VALUES
    ('is_admin',                    '003_admin_dashboard.sql'),
    ('send_admin_email',            '005_email_notifications.sql'),
    ('on_new_submission',           '005_email_notifications.sql'),
    ('on_new_profile',              '005_email_notifications.sql'),
    ('on_auth_user_created_dossier','006_student_dossiers.sql'),
    ('create_fwb_dossier',          '006_student_dossiers.sql'),
    ('on_new_dossier_message',      '007_notifications_dossier.sql'),
    ('on_new_dossier_document',     '007_notifications_dossier.sql')
  ) AS t(name, migration)
),
audit_fn AS (
  SELECT
    '2. Fonctions' AS section,
    f.name AS element,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = f.name
      ) THEN 'OK'
      ELSE 'MANQUE -> executer ' || f.migration
    END AS statut
  FROM expected_fn f
),
-- 3/ TRIGGERS
audit_triggers AS (
  SELECT
    '3. Triggers' AS section,
    event_object_table || ' / ' || trigger_name AS element,
    'OK (' || action_timing || ' ' || event_manipulation || ')' AS statut
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
),
-- 4/ RLS
audit_rls AS (
  SELECT
    '4. Row Level Security' AS section,
    tablename AS element,
    CASE WHEN rowsecurity THEN 'OK (RLS active)' ELSE 'KO -> activer RLS' END AS statut
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'profiles', 'form_submissions', 'admins',
      'private_settings',
      'student_dossiers', 'dossier_steps',
      'dossier_messages', 'dossier_documents'
    )
),
-- 5/ Admins enregistres
audit_admins AS (
  SELECT
    '5. Admins' AS section,
    u.email AS element,
    'OK (ajoute le ' || to_char(a.created_at, 'YYYY-MM-DD') || ')' AS statut
  FROM public.admins a
  JOIN auth.users u ON u.id = a.user_id
  UNION ALL
  SELECT
    '5. Admins' AS section,
    '(aucun admin)' AS element,
    'KO -> INSERT INTO public.admins(user_id, email) SELECT id, email FROM auth.users WHERE email = ''votre.email@gmail.com'';' AS statut
  WHERE NOT EXISTS (SELECT 1 FROM public.admins)
),
-- 6/ Cle Resend
audit_resend AS (
  SELECT
    '6. Configuration Resend' AS section,
    key AS element,
    CASE
      WHEN value IS NULL OR value = '' THEN 'KO -> valeur vide'
      WHEN left(value, 3) = 're_'      THEN 'OK (cle Resend detectee)'
      WHEN key = 'notify_to'           THEN 'OK (' || value || ')'
      ELSE 'A verifier (' || left(value, 10) || '...)'
    END AS statut
  FROM public.private_settings
  WHERE key IN ('resend_api_key', 'notify_to')
  UNION ALL
  SELECT
    '6. Configuration Resend' AS section,
    '(aucune cle configuree)' AS element,
    'KO -> verifier private_settings (migration 005)' AS statut
  WHERE NOT EXISTS (
    SELECT 1 FROM public.private_settings WHERE key = 'resend_api_key'
  )
),
-- 7/ Dossiers vs comptes
audit_dossiers AS (
  SELECT
    '7. Dossiers etudiants' AS section,
    'Comptes: ' || (SELECT COUNT(*) FROM auth.users)::text
      || ' / Dossiers: ' || (SELECT COUNT(*) FROM public.student_dossiers)::text
      || ' / Admins: ' || (SELECT COUNT(*) FROM public.admins)::text
      AS element,
    CASE
      WHEN (SELECT COUNT(*) FROM auth.users)
         - (SELECT COUNT(*) FROM public.admins)
         = (SELECT COUNT(*) FROM public.student_dossiers)
      THEN 'OK : chaque etudiant non-admin a un dossier'
      ELSE 'KO -> executer migrations/008_backfill_dossiers.sql'
    END AS statut
)

SELECT section, element, statut FROM audit_tables
UNION ALL SELECT section, element, statut FROM audit_fn
UNION ALL SELECT section, element, statut FROM audit_triggers
UNION ALL SELECT section, element, statut FROM audit_rls
UNION ALL SELECT section, element, statut FROM audit_admins
UNION ALL SELECT section, element, statut FROM audit_resend
UNION ALL SELECT section, element, statut FROM audit_dossiers
ORDER BY section, element;
