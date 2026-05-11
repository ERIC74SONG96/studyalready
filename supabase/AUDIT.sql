-- =====================================================================
-- StudyAlready — Audit complet de la base Supabase
-- =====================================================================
-- A executer dans : Supabase Dashboard -> SQL Editor -> New query
-- Coller TOUT ce fichier et cliquer sur RUN.
-- Le resultat affiche TROIS sections : tables, fonctions/triggers, RLS.
-- Si une ligne dit "MANQUE" ou "KO", c'est qu'il faut executer la
-- migration correspondante.
-- =====================================================================

-- ----- 1/ TABLES & VUE attendues -------------------------------------
WITH expected(name, kind, migration) AS (
  VALUES
    ('profiles',           'table', '001_profiles_annuaire.sql'),
    ('form_submissions',   'table', '002_form_submissions.sql'),
    ('admins',             'table', '003_admin_dashboard.sql'),
    ('private_settings',   'table', '005_email_notifications.sql'),
    ('student_dossiers',   'table', '006_student_dossiers.sql'),
    ('dossier_steps',      'table', '006_student_dossiers.sql'),
    ('dossier_messages',   'table', '006_student_dossiers.sql'),
    ('dossier_documents',  'table', '006_student_dossiers.sql'),
    ('admin_students_view','view',  '006_student_dossiers.sql')
)
SELECT
  e.name,
  e.kind,
  e.migration,
  CASE
    WHEN e.kind = 'table' AND EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = e.name
    ) THEN 'OK'
    WHEN e.kind = 'view' AND EXISTS (
      SELECT 1 FROM pg_views
      WHERE schemaname = 'public' AND viewname = e.name
    ) THEN 'OK'
    ELSE 'MANQUE  -> executer ' || e.migration
  END AS statut
FROM expected e
ORDER BY e.migration, e.name;

-- ----- 2/ FONCTIONS attendues ----------------------------------------
WITH expected_fn(name, migration) AS (
  VALUES
    ('is_admin',                    '003_admin_dashboard.sql'),
    ('send_admin_email',            '005_email_notifications.sql'),
    ('on_new_submission',           '005_email_notifications.sql'),
    ('on_new_profile',              '005_email_notifications.sql'),
    ('on_auth_user_created_dossier','006_student_dossiers.sql'),
    ('create_fwb_dossier',          '006_student_dossiers.sql'),
    ('on_new_dossier_message',      '007_notifications_dossier.sql'),
    ('on_new_dossier_document',     '007_notifications_dossier.sql')
)
SELECT
  f.name AS fonction,
  f.migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = f.name
    ) THEN 'OK'
    ELSE 'MANQUE  -> executer ' || f.migration
  END AS statut
FROM expected_fn f
ORDER BY f.migration, f.name;

-- ----- 3/ TRIGGERS attendus ------------------------------------------
SELECT
  event_object_table AS table_concernee,
  trigger_name,
  action_timing || ' ' || event_manipulation AS quand,
  'OK' AS statut
FROM information_schema.triggers
WHERE trigger_schema = 'public'
   OR (trigger_schema = 'auth' AND trigger_name = 'on_auth_user_created_dossier')
ORDER BY event_object_table, trigger_name;

-- ----- 4/ ROW LEVEL SECURITY -----------------------------------------
SELECT
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN 'RLS ON (OK)' ELSE 'RLS OFF (KO !!!)' END AS statut
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'form_submissions', 'admins',
    'private_settings',
    'student_dossiers', 'dossier_steps',
    'dossier_messages', 'dossier_documents'
  )
ORDER BY tablename;

-- ----- 5/ ADMINS enregistres -----------------------------------------
SELECT
  u.email,
  a.created_at AS ajoute_le,
  'OK' AS statut
FROM public.admins a
JOIN auth.users u ON u.id = a.user_id
ORDER BY a.created_at;
-- Si la liste est vide, vous n'avez aucun admin et /admin-login.html
-- vous refusera systematiquement l'acces. Ajoutez votre compte avec :
--   INSERT INTO public.admins (user_id, email)
--   SELECT id, email FROM auth.users WHERE email = 'votre.email@gmail.com';

-- ----- 6/ Cle Resend configuree (notification email) -----------------
SELECT
  key,
  CASE
    WHEN value IS NULL OR value = '' THEN 'VIDE -> ajouter la cle Resend'
    WHEN left(value, 3) = 're_' THEN 'OK (cle Resend detectee)'
    ELSE 'Valeur inhabituelle, verifier le format'
  END AS statut
FROM public.private_settings
WHERE key IN ('resend_api_key', 'notify_to');

-- ----- 7/ Comptes etudiants vs dossiers (backfill 008) ---------------
SELECT
  (SELECT COUNT(*) FROM auth.users) AS nb_comptes_etudiants,
  (SELECT COUNT(*) FROM public.student_dossiers) AS nb_dossiers,
  CASE
    WHEN (SELECT COUNT(*) FROM auth.users)
       = (SELECT COUNT(*) FROM public.student_dossiers)
    THEN 'OK : chaque compte a son dossier'
    ELSE 'KO : executer 008_backfill_dossiers.sql'
  END AS statut;
