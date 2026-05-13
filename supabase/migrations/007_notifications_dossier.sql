-- =============================================================
-- StudyAlready — Migration 007 : notifications email
-- pour la messagerie et les documents de l'espace étudiant.
-- =============================================================
-- Réutilise la fonction public.send_admin_email() définie dans
-- la migration 005 (Resend + pg_net).
--
-- Déclenche un email à contact@studyalready.com :
--   - quand un étudiant envoie un message via son dashboard ;
--   - quand un étudiant téléverse un document.
--
-- Pas de notification quand l'admin écrit (l'étudiant verra
-- le message lui-même dans son dashboard ; vous pourrez ajouter
-- l'envoi côté étudiant plus tard si besoin).
--
-- À exécuter dans Supabase : SQL Editor → New query → Run.
-- Idempotent.
-- =============================================================

-- Sécurité : on s'assure que la fonction d'envoi existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'send_admin_email'
       AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Migration 005_email_notifications.sql doit être exécutée d''abord.';
  END IF;
END $$;

-- =============================================================
-- 1) Trigger : nouveau message d'un étudiant
-- =============================================================
CREATE OR REPLACE FUNCTION public.on_new_dossier_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   text;
  v_name    text;
  v_subject text;
  v_html    text;
  v_preview text;
BEGIN
  /* On notifie uniquement les messages venant de l'étudiant. */
  IF NEW.sender <> 'student' THEN
    RETURN NEW;
  END IF;

  /* Récupère l'email + le prénom du compte étudiant. */
  SELECT u.email,
         COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
    INTO v_email, v_name
    FROM auth.users u
   WHERE u.id = NEW.user_id;

  /* Aperçu (max 280 caractères) — échappe le HTML. */
  v_preview := replace(replace(replace(
                  substring(NEW.message FROM 1 FOR 280),
                  '&', '&amp;'),
                  '<', '&lt;'),
                  '>', '&gt;');
  IF length(NEW.message) > 280 THEN
    v_preview := v_preview || '…';
  END IF;

  v_subject := '[StudyAlready] Nouveau message de ' || COALESCE(v_name, 'un étudiant');

  v_html :=
    '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0a2540">' ||
      '<div style="background:#1e3a8a;color:white;padding:20px 24px;border-radius:12px 12px 0 0">' ||
        '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready · Espace étudiant</p>' ||
        '<h1 style="margin:6px 0 0 0;font-size:20px">💬 Nouveau message</h1>' ||
      '</div>' ||
      '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px">' ||
        '<p style="margin:0;font-size:15px"><strong>' || COALESCE(v_name, '—') || '</strong></p>' ||
        '<p style="margin:2px 0 0 0;color:#64748b;font-size:13px">' || COALESCE(v_email, '—') || '</p>' ||
        '<p style="margin:6px 0 0 0;color:#94a3b8;font-size:11px">Reçu le ' ||
          to_char(NEW.created_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '</p>' ||
        '<div style="margin-top:16px;background:#f8fafc;border-left:4px solid #f5b800;padding:14px 16px;border-radius:6px;font-size:14px;line-height:1.6;white-space:pre-wrap">' ||
          v_preview ||
        '</div>' ||
        '<p style="margin-top:24px"><a href="https://www.studyalready.com/admin.html" ' ||
          'style="background:#0a2540;color:white;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600;font-size:13px">' ||
          'Répondre depuis le dashboard →</a></p>' ||
      '</div>' ||
      '<p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:12px">' ||
        'Notification automatique · Onglet "Étudiants" du dashboard admin' ||
      '</p>' ||
    '</div>';

  PERFORM public.send_admin_email(v_subject, v_html);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'on_new_dossier_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_message_notify ON public.dossier_messages;
CREATE TRIGGER trg_dossier_message_notify
  AFTER INSERT ON public.dossier_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_dossier_message();

-- =============================================================
-- 2) Trigger : nouveau document téléversé par un étudiant
-- =============================================================
CREATE OR REPLACE FUNCTION public.on_new_dossier_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   text;
  v_name    text;
  v_size_kb int;
BEGIN
  /* On notifie uniquement les documents téléversés par l'étudiant. */
  IF NEW.uploaded_by <> 'student' THEN
    RETURN NEW;
  END IF;

  SELECT u.email,
         COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
    INTO v_email, v_name
    FROM auth.users u
   WHERE u.id = NEW.user_id;

  v_size_kb := CASE WHEN NEW.size_bytes IS NOT NULL
                    THEN GREATEST(1, (NEW.size_bytes / 1024)::int)
                    ELSE NULL END;

  PERFORM public.send_admin_email(
    '[StudyAlready] Nouveau document partagé par ' || COALESCE(v_name, 'un étudiant'),
    '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0a2540">' ||
      '<div style="background:#0a2540;color:white;padding:20px 24px;border-radius:12px 12px 0 0">' ||
        '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready · Espace étudiant</p>' ||
        '<h1 style="margin:6px 0 0 0;font-size:20px">📎 Nouveau document</h1>' ||
      '</div>' ||
      '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px">' ||
        '<p style="margin:0;font-size:15px"><strong>' || COALESCE(v_name, '—') || '</strong></p>' ||
        '<p style="margin:2px 0 0 0;color:#64748b;font-size:13px">' || COALESCE(v_email, '—') || '</p>' ||
        '<div style="margin-top:16px;background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:14px">' ||
          '<p style="margin:0">📄 <strong>' || replace(replace(NEW.filename, '<', '&lt;'), '&', '&amp;') || '</strong>' ||
          CASE WHEN v_size_kb IS NOT NULL THEN ' <span style="color:#94a3b8">(' || v_size_kb || ' Ko)</span>' ELSE '' END ||
          '</p>' ||
        '</div>' ||
        '<p style="margin-top:24px"><a href="https://www.studyalready.com/admin.html" ' ||
          'style="background:#0a2540;color:white;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600;font-size:13px">' ||
          'Voir le document →</a></p>' ||
      '</div>' ||
      '<p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:12px">' ||
        'Téléchargement via l''onglet "Étudiants" → modal du compte' ||
      '</p>' ||
    '</div>'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'on_new_dossier_document failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_document_notify ON public.dossier_documents;
CREATE TRIGGER trg_dossier_document_notify
  AFTER INSERT ON public.dossier_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_dossier_document();

-- =============================================================
-- ✅ Migration 007 prête.
--
-- Test rapide (après exécution) :
--   1. Connectez-vous comme étudiant sur /espace-etudiant/
--   2. Onglet "Messages" → envoyez un message court
--   3. Sous 30 secondes, un email arrive sur contact@studyalready.com
--   4. Pareil pour un upload dans l'onglet "Documents"
--
-- Vérifier les requêtes envoyées :
--   SELECT id, status_code, content FROM net._http_response
--    ORDER BY id DESC LIMIT 5;
-- =============================================================
