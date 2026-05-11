-- =====================================================================
-- StudyAlready — Audit RESUME (1 ligne par section + liste des problemes)
-- =====================================================================
-- A executer dans Supabase -> SQL Editor -> New query (apres AUDIT.sql).
-- Affiche un tableau de ~10 lignes : pour chaque section, X/Y OK
-- et toutes les lignes KO/MANQUE listees une a une en dessous.
-- =====================================================================

WITH
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
res AS (
  -- 1. Tables / vue
  SELECT '1. Tables & vue' AS section, e.name AS element,
         CASE
           WHEN e.kind = 'table' AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=e.name) THEN 'OK'
           WHEN e.kind = 'view'  AND EXISTS (SELECT 1 FROM pg_views  WHERE schemaname='public' AND viewname=e.name)  THEN 'OK'
           ELSE 'MANQUE -> ' || e.migration
         END AS statut
  FROM expected_tables e
  UNION ALL
  -- 2. Fonctions
  SELECT '2. Fonctions', f.name,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname='public' AND p.proname=f.name
         ) THEN 'OK' ELSE 'MANQUE -> ' || f.migration END
  FROM expected_fn f
  UNION ALL
  -- 3. RLS sur tables sensibles
  SELECT '3. RLS', tablename,
         CASE WHEN rowsecurity THEN 'OK' ELSE 'KO -> activer RLS' END
  FROM pg_tables
  WHERE schemaname='public'
    AND tablename IN ('profiles','form_submissions','admins','private_settings',
                      'student_dossiers','dossier_steps','dossier_messages','dossier_documents')
  UNION ALL
  -- 4. Au moins un admin
  SELECT '4. Admins',
         CASE WHEN COUNT(*) > 0 THEN COUNT(*)::text || ' admin(s) enregistre(s)' ELSE 'aucun admin' END,
         CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'KO -> INSERT INTO public.admins ...' END
  FROM public.admins
  UNION ALL
  -- 5. Cle Resend
  SELECT '5. Resend',
         COALESCE((SELECT 'resend_api_key' FROM public.private_settings WHERE key='resend_api_key' AND value IS NOT NULL AND value <> ''),
                  'resend_api_key absente'),
         CASE WHEN EXISTS (SELECT 1 FROM public.private_settings WHERE key='resend_api_key' AND value IS NOT NULL AND value <> '')
              THEN 'OK' ELSE 'KO -> ajouter la cle Resend' END
  UNION ALL
  -- 6. Dossiers = comptes - admins
  SELECT '6. Dossiers',
         'Comptes ' || (SELECT COUNT(*) FROM auth.users)
           || ' - Admins ' || (SELECT COUNT(*) FROM public.admins)
           || ' = ' || ((SELECT COUNT(*) FROM auth.users) - (SELECT COUNT(*) FROM public.admins))
           || ' / Dossiers ' || (SELECT COUNT(*) FROM public.student_dossiers),
         CASE
           WHEN (SELECT COUNT(*) FROM auth.users) - (SELECT COUNT(*) FROM public.admins)
                = (SELECT COUNT(*) FROM public.student_dossiers)
           THEN 'OK' ELSE 'KO -> executer 008_backfill_dossiers.sql' END
)
-- Affichage : d'abord le bilan par section, puis les problemes en detail
SELECT * FROM (
  -- BILAN par section
  SELECT
    '=== ' || section || ' ===' AS section,
    COUNT(*) FILTER (WHERE statut = 'OK')::text || ' OK / '
      || COUNT(*)::text || ' total' AS element,
    CASE WHEN COUNT(*) FILTER (WHERE statut <> 'OK') = 0
         THEN 'TOUT OK' ELSE 'PROBLEMES A CORRIGER ↓' END AS statut,
    1 AS ord
  FROM res
  GROUP BY section
  UNION ALL
  -- DETAIL des KO/MANQUE
  SELECT section, element, statut, 2 AS ord
  FROM res
  WHERE statut <> 'OK'
) sub
ORDER BY section, ord, element;
