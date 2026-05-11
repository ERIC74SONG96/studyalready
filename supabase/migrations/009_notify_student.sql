-- =============================================================
-- StudyAlready — Migration 009 : notifier l'etudiant quand l'admin lui ecrit
-- =============================================================
-- 1. Normalise les cles de private_settings (MAJUSCULES) pour que la
--    fonction public.send_admin_email() trouve bien la cle Resend.
-- 2. Cree une fonction public.send_user_email(target_user_id, subject, html)
--    qui envoie un email a un utilisateur Auth specifique.
-- 3. Etend les triggers existants on_new_dossier_message et
--    on_new_dossier_document pour ENVOYER un email a l'etudiant quand
--    c'est l'admin qui ecrit ou depose un document.
--
-- Idempotent : peut etre relance sans risque.
-- A executer dans Supabase -> SQL Editor -> New query -> Run.
-- =============================================================


-- ---------- 1. Normalisation des cles private_settings ------------
-- Si l'utilisateur les a inserees en minuscules (resend_api_key, notify_to),
-- on les remonte dans la forme attendue par 005 (MAJUSCULES).
DO $$
DECLARE v text;
BEGIN
  SELECT value INTO v FROM public.private_settings WHERE key = 'resend_api_key';
  IF v IS NOT NULL AND v <> '' THEN
    INSERT INTO public.private_settings (key, value) VALUES ('RESEND_API_KEY', v)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  SELECT value INTO v FROM public.private_settings WHERE key = 'notify_to';
  IF v IS NOT NULL AND v <> '' THEN
    INSERT INTO public.private_settings (key, value) VALUES ('NOTIFY_TO', v)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  END IF;
END $$;

-- Garantit qu'un expediteur par defaut existe (Resend onboarding).
INSERT INTO public.private_settings (key, value)
VALUES ('NOTIFY_FROM', 'StudyAlready <onboarding@resend.dev>')
ON CONFLICT (key) DO NOTHING;


-- ---------- 2. Fonction send_user_email --------------------------
-- Envoie un email Resend a un utilisateur identifie par son auth.users.id.
-- Utilise la meme cle Resend et le meme expediteur que send_admin_email.
CREATE OR REPLACE FUNCTION public.send_user_email(
  target_user_id uuid,
  subject text,
  html text
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  api_key     text;
  notify_from text;
  to_email    text;
  req_id      bigint;
BEGIN
  SELECT value INTO api_key     FROM private_settings WHERE key = 'RESEND_API_KEY';
  SELECT value INTO notify_from FROM private_settings WHERE key = 'NOTIFY_FROM';
  SELECT email   INTO to_email  FROM auth.users WHERE id = target_user_id;

  IF api_key IS NULL OR api_key = '' OR api_key = 'REMPLACER_PAR_VOTRE_CLE_RESEND' THEN
    RAISE NOTICE 'send_user_email : RESEND_API_KEY non configuree, email ignore';
    RETURN NULL;
  END IF;

  IF to_email IS NULL OR to_email = '' THEN
    RAISE NOTICE 'send_user_email : aucun email trouve pour user %', target_user_id;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type',  'application/json'
    ),
    body := jsonb_build_object(
      'from',    notify_from,
      'to',      jsonb_build_array(to_email),
      'subject', subject,
      'html',    html
    )
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_user_email(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_user_email(uuid, text, text) FROM anon, authenticated;


-- ---------- 3. Trigger messages : etend pour notifier l'etudiant ---
-- Quand sender = 'student' -> on notifie l'admin (comportement existant).
-- Quand sender = 'admin'   -> on notifie l'etudiant (nouveau).
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
  /* Apercu (max 280 caracteres) - echappe le HTML. */
  v_preview := replace(replace(replace(
                  substring(NEW.message FROM 1 FOR 280),
                  '&', '&amp;'),
                  '<', '&lt;'),
                  '>', '&gt;');
  IF length(NEW.message) > 280 THEN
    v_preview := v_preview || '...';
  END IF;

  /* --- Cas A : l'etudiant ecrit -> on previent l'admin --- */
  IF NEW.sender = 'student' THEN
    SELECT u.email,
           COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
      INTO v_email, v_name
      FROM auth.users u
     WHERE u.id = NEW.user_id;

    v_subject := '[StudyAlready] Nouveau message de ' || COALESCE(v_name, 'un etudiant');

    v_html :=
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0a2540">' ||
        '<div style="background:#1e3a8a;color:white;padding:20px 24px;border-radius:12px 12px 0 0">' ||
          '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready · Espace etudiant</p>' ||
          '<h1 style="margin:6px 0 0 0;font-size:20px">Nouveau message</h1>' ||
        '</div>' ||
        '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px">' ||
          '<p style="margin:0;font-size:15px"><strong>' || COALESCE(v_name, '-') || '</strong></p>' ||
          '<p style="margin:2px 0 0 0;color:#64748b;font-size:13px">' || COALESCE(v_email, '-') || '</p>' ||
          '<div style="margin-top:16px;background:#f8fafc;border-left:4px solid #f5b800;padding:14px 16px;border-radius:6px;font-size:14px;line-height:1.6;white-space:pre-wrap">' ||
            v_preview ||
          '</div>' ||
          '<p style="margin-top:24px"><a href="https://www.studyalready.com/admin.html" ' ||
            'style="background:#0a2540;color:white;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600;font-size:13px">' ||
            'Repondre depuis le dashboard -></a></p>' ||
        '</div>' ||
      '</div>';

    PERFORM public.send_admin_email(v_subject, v_html);

  /* --- Cas B : l'admin ecrit -> on previent l'etudiant --- */
  ELSIF NEW.sender = 'admin' THEN
    SELECT u.email,
           COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
      INTO v_email, v_name
      FROM auth.users u
     WHERE u.id = NEW.user_id;

    v_subject := 'StudyAlready vous a envoye un message';

    v_html :=
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0a2540">' ||
        '<div style="background:#0a2540;color:white;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">' ||
          '<div style="display:inline-block;width:42px;height:42px;background:#f5b800;border-radius:10px;line-height:42px;color:#0a2540;font-weight:700;font-size:14px;margin-bottom:8px">SA</div>' ||
          '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready</p>' ||
          '<h1 style="margin:6px 0 0 0;font-size:22px">Vous avez un nouveau message</h1>' ||
        '</div>' ||
        '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">' ||
          '<p style="margin:0 0 14px 0;font-size:15px">Bonjour ' || COALESCE(v_name, '') || ',</p>' ||
          '<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55">L''equipe StudyAlready vient de vous ecrire dans votre espace personnel. Voici un apercu :</p>' ||
          '<div style="background:#f8fafc;border-left:4px solid #f5b800;padding:14px 16px;border-radius:6px;font-size:14px;line-height:1.6;white-space:pre-wrap">' ||
            v_preview ||
          '</div>' ||
          '<p style="margin:24px 0 0 0;text-align:center">' ||
            '<a href="https://www.studyalready.com/espace-etudiant/dashboard.html" ' ||
              'style="background:#f5b800;color:#0a2540;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:700;font-size:14px">' ||
              'Lire le message -></a>' ||
          '</p>' ||
          '<p style="margin-top:20px;color:#64748b;font-size:12px;line-height:1.5">Vous pouvez repondre directement depuis votre espace. ' ||
          'Pour les urgences, contactez-nous sur <a href="https://wa.me/32465339448" style="color:#1e3a8a">WhatsApp +32 465 33 94 48</a>.</p>' ||
        '</div>' ||
        '<p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:12px">Email automatique - vous le recevez parce que vous avez un compte sur studyalready.com</p>' ||
      '</div>';

    PERFORM public.send_user_email(NEW.user_id, v_subject, v_html);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'on_new_dossier_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- ---------- 4. Trigger documents : etend pour notifier l'etudiant -----
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
  v_filename_safe text;
BEGIN
  v_size_kb := CASE WHEN NEW.size_bytes IS NOT NULL
                    THEN GREATEST(1, (NEW.size_bytes / 1024)::int)
                    ELSE NULL END;
  v_filename_safe := replace(replace(NEW.filename, '<', '&lt;'), '&', '&amp;');

  /* --- Cas A : etudiant depose un document -> on previent l'admin --- */
  IF NEW.uploaded_by = 'student' THEN
    SELECT u.email,
           COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
      INTO v_email, v_name
      FROM auth.users u
     WHERE u.id = NEW.user_id;

    PERFORM public.send_admin_email(
      '[StudyAlready] Nouveau document partage par ' || COALESCE(v_name, 'un etudiant'),
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0a2540">' ||
        '<div style="background:#0a2540;color:white;padding:20px 24px;border-radius:12px 12px 0 0">' ||
          '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready · Espace etudiant</p>' ||
          '<h1 style="margin:6px 0 0 0;font-size:20px">Nouveau document</h1>' ||
        '</div>' ||
        '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px">' ||
          '<p style="margin:0;font-size:15px"><strong>' || COALESCE(v_name, '-') || '</strong></p>' ||
          '<p style="margin:2px 0 0 0;color:#64748b;font-size:13px">' || COALESCE(v_email, '-') || '</p>' ||
          '<div style="margin-top:16px;background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:14px">' ||
            '<p style="margin:0"><strong>' || v_filename_safe || '</strong>' ||
            CASE WHEN v_size_kb IS NOT NULL THEN ' <span style="color:#94a3b8">(' || v_size_kb || ' Ko)</span>' ELSE '' END ||
            '</p>' ||
          '</div>' ||
          '<p style="margin-top:24px"><a href="https://www.studyalready.com/admin.html" ' ||
            'style="background:#0a2540;color:white;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600;font-size:13px">' ||
            'Voir le document -></a></p>' ||
        '</div>' ||
      '</div>'
    );

  /* --- Cas B : admin depose un document -> on previent l'etudiant --- */
  ELSIF NEW.uploaded_by = 'admin' THEN
    SELECT COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
      INTO v_name
      FROM auth.users u
     WHERE u.id = NEW.user_id;

    PERFORM public.send_user_email(
      NEW.user_id,
      'StudyAlready vous a envoye un document',
      '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0a2540">' ||
        '<div style="background:#0a2540;color:white;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">' ||
          '<div style="display:inline-block;width:42px;height:42px;background:#f5b800;border-radius:10px;line-height:42px;color:#0a2540;font-weight:700;font-size:14px;margin-bottom:8px">SA</div>' ||
          '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready</p>' ||
          '<h1 style="margin:6px 0 0 0;font-size:22px">Un nouveau document pour vous</h1>' ||
        '</div>' ||
        '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">' ||
          '<p style="margin:0 0 14px 0;font-size:15px">Bonjour ' || COALESCE(v_name, '') || ',</p>' ||
          '<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55">L''equipe StudyAlready vient de partager un document dans votre espace personnel :</p>' ||
          '<div style="background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:14px">' ||
            '<p style="margin:0"><strong>' || v_filename_safe || '</strong>' ||
            CASE WHEN v_size_kb IS NOT NULL THEN ' <span style="color:#94a3b8">(' || v_size_kb || ' Ko)</span>' ELSE '' END ||
            '</p>' ||
          '</div>' ||
          '<p style="margin:24px 0 0 0;text-align:center">' ||
            '<a href="https://www.studyalready.com/espace-etudiant/dashboard.html" ' ||
              'style="background:#f5b800;color:#0a2540;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:700;font-size:14px">' ||
              'Telecharger le document -></a>' ||
          '</p>' ||
          '<p style="margin-top:20px;color:#64748b;font-size:12px;line-height:1.5">Connectez-vous a votre espace etudiant pour acceder a ce document et au reste de votre dossier.</p>' ||
        '</div>' ||
        '<p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:12px">Email automatique - studyalready.com</p>' ||
      '</div>'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'on_new_dossier_document failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- =============================================================
-- Verifications immediates
-- =============================================================
SELECT
  'send_user_email' AS element,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'send_user_email'
  ) THEN 'OK' ELSE 'KO' END AS statut
UNION ALL SELECT
  'RESEND_API_KEY (majuscules)',
  CASE WHEN EXISTS (
    SELECT 1 FROM public.private_settings
    WHERE key = 'RESEND_API_KEY' AND value LIKE 're_%'
  ) THEN 'OK' ELSE 'KO -> verifier la cle' END
UNION ALL SELECT
  'NOTIFY_TO (majuscules)',
  CASE WHEN EXISTS (
    SELECT 1 FROM public.private_settings
    WHERE key = 'NOTIFY_TO' AND value <> ''
  ) THEN 'OK' ELSE 'KO' END
UNION ALL SELECT
  'NOTIFY_FROM',
  CASE WHEN EXISTS (
    SELECT 1 FROM public.private_settings
    WHERE key = 'NOTIFY_FROM' AND value <> ''
  ) THEN 'OK' ELSE 'KO' END;


-- =============================================================
-- Notes Resend - IMPORTANT pour le mode test
-- =============================================================
-- En mode test gratuit, Resend n'envoie qu'aux emails verifies.
-- Pour envoyer aux vrais etudiants, il faut :
--   1) Verifier votre domaine sur https://resend.com/domains
--      (ajouter studyalready.com via DNS) ;
--   2) Mettre a jour NOTIFY_FROM :
--      UPDATE public.private_settings
--         SET value = 'StudyAlready <hello@studyalready.com>'
--       WHERE key = 'NOTIFY_FROM';
-- Tant que ce n'est pas fait, send_user_email enverra une requete
-- Resend qui repondra 422 (email destinataire non autorise) et
-- l'etudiant ne recevra rien. Visible via :
--   SELECT id, created, status_code, content
--     FROM net._http_response ORDER BY created DESC LIMIT 5;
-- =============================================================
