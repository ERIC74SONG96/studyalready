-- =============================================================
-- StudyAlready — Migration 032 : auto-reponse demande + lien PDF
-- =============================================================
-- Objectif:
-- 1) Envoyer automatiquement un email de confirmation au demandeur
--    lorsqu'une ligne est creee dans public.form_submissions.
-- 2) Inclure un lien direct vers le dossier PDF StudyAlready.
--
-- Prerequis:
-- - Migration 005 executee (private_settings + send_admin_email + trigger)
-- - Extension pg_net activee
--
-- Idempotent: peut etre relance sans risque.
-- =============================================================

-- Envoi direct vers une adresse email (utile pour les demandes anon
-- qui n'ont pas de user_id dans auth.users).
CREATE OR REPLACE FUNCTION public.send_email_to_address(
  target_email text,
  subject text,
  html text
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  api_key text;
  notify_from text;
  req_id bigint;
  clean_email text;
BEGIN
  clean_email := lower(trim(coalesce(target_email, '')));
  IF clean_email = '' OR clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RETURN NULL;
  END IF;

  SELECT value INTO api_key FROM private_settings WHERE key = 'RESEND_API_KEY';
  SELECT value INTO notify_from FROM private_settings WHERE key = 'NOTIFY_FROM';

  IF api_key IS NULL OR api_key = '' OR api_key = 'REMPLACER_PAR_VOTRE_CLE_RESEND' THEN
    RAISE NOTICE 'send_email_to_address: RESEND_API_KEY non configuree, email ignore';
    RETURN NULL;
  END IF;

  IF notify_from IS NULL OR notify_from = '' THEN
    notify_from := 'StudyAlready <onboarding@resend.dev>';
  END IF;

  SELECT net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', notify_from,
      'to', jsonb_build_array(clean_email),
      'subject', subject,
      'html', html
    )
  ) INTO req_id;

  RETURN req_id;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'send_email_to_address: table private_settings introuvable (migration 005 requise)';
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_email_to_address(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_email_to_address(text, text, text) FROM anon, authenticated;

-- Etend la notification existante:
-- - conserve l'email admin
-- - ajoute une auto-reponse demandeur avec lien PDF
CREATE OR REPLACE FUNCTION public.on_new_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  label text;
  contact text;
  payload_html text := '';
  k text;
  v text;
  client_subject text;
  client_html text;
  client_name text;
  service_label text;
BEGIN
  label := CASE NEW.form_type
    WHEN 'contact' THEN 'Contact'
    WHEN 'prequalification' THEN 'Pré-qualification'
    WHEN 'rejoindre-reseau' THEN 'Réseau'
    WHEN 'mise-en-relation' THEN 'Mise en relation'
    WHEN 'rapport-admission' THEN 'Rapport admission'
    WHEN 'chasseur-billet' THEN 'Chasseur de billets'
    WHEN 'departs-groupes' THEN 'Départs groupés'
    ELSE NEW.form_type
  END;

  contact := COALESCE(NEW.nom, '—');
  IF NEW.email IS NOT NULL THEN contact := contact || ' · ' || NEW.email; END IF;
  IF NEW.whatsapp IS NOT NULL THEN contact := contact || ' · ' || NEW.whatsapp; END IF;

  IF NEW.payload IS NOT NULL AND jsonb_typeof(NEW.payload) = 'object' THEN
    FOR k, v IN SELECT * FROM jsonb_each_text(NEW.payload) LOOP
      payload_html := payload_html ||
        '<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;text-transform:uppercase;vertical-align:top">' ||
        replace(replace(k, '<', '&lt;'), '&', '&amp;') ||
        '</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;white-space:pre-wrap">' ||
        replace(replace(COALESCE(v, ''), '<', '&lt;'), '&', '&amp;') ||
        '</td></tr>';
    END LOOP;
  END IF;

  -- Email admin (comportement conserve)
  PERFORM public.send_admin_email(
    '[StudyAlready] Nouvelle demande : ' || label,
    '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0a2540">' ||
      '<div style="background:#0a2540;color:white;padding:20px 24px;border-radius:12px 12px 0 0">' ||
        '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready</p>' ||
        '<h1 style="margin:6px 0 0 0;font-size:20px">Nouvelle demande : ' || label || '</h1>' ||
      '</div>' ||
      '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px">' ||
        '<p style="margin:0 0 8px 0;font-size:15px"><strong>' || contact || '</strong></p>' ||
        '<p style="margin:0;color:#64748b;font-size:12px">Reçu le ' || to_char(NEW.created_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI') || '</p>' ||
        CASE WHEN payload_html <> '' THEN
          '<table style="width:100%;border-collapse:collapse;margin-top:16px;background:#f8fafc;border-radius:8px;overflow:hidden;font-size:13px">' || payload_html || '</table>'
        ELSE '' END ||
        '<p style="margin-top:24px"><a href="https://www.studyalready.com/admin.html" style="background:#0a2540;color:white;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600;font-size:13px">Ouvrir le dashboard →</a></p>' ||
      '</div>' ||
      '<p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:12px">Notification automatique StudyAlready · Configurable dans Supabase (table private_settings)</p>' ||
    '</div>'
  );

  -- Auto-reponse client + lien PDF
  IF NEW.email IS NOT NULL AND length(trim(NEW.email)) > 3 THEN
    client_name := replace(replace(COALESCE(NULLIF(trim(NEW.nom), ''), 'Bonjour'), '&', '&amp;'), '<', '&lt;');
    service_label := COALESCE(NULLIF(trim(NEW.payload ->> 'service'), ''), NULLIF(trim(NEW.subject), ''), label);
    service_label := replace(replace(service_label, '&', '&amp;'), '<', '&lt;');

    client_subject := CASE
      WHEN NEW.form_type = 'contact' THEN 'StudyAlready — Nous avons bien reçu votre demande'
      WHEN NEW.form_type = 'prequalification' THEN 'StudyAlready — Pré-qualification bien reçue'
      ELSE 'StudyAlready — Votre demande a bien été reçue'
    END;

    client_html :=
      '<div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0a2540">' ||
        '<div style="background:#0a2540;color:white;padding:22px 26px;border-radius:12px 12px 0 0">' ||
          '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready</p>' ||
          '<h1 style="margin:8px 0 0 0;font-size:22px">Demande bien reçue ✅</h1>' ||
        '</div>' ||
        '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 26px">' ||
          '<p style="margin:0 0 12px 0;font-size:15px">Bonjour ' || client_name || ',</p>' ||
          '<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6">Merci, votre demande a bien été enregistrée par notre équipe.</p>' ||
          '<p style="margin:0 0 14px 0;font-size:14px;color:#334155">Service sélectionné : <strong>' || service_label || '</strong></p>' ||
          '<div style="margin:18px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px">' ||
            '<p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#0a2540">Document demandé</p>' ||
            '<p style="margin:0;font-size:14px;line-height:1.6;color:#334155">Vous pouvez télécharger notre dossier PDF ici :</p>' ||
            '<p style="margin:12px 0 0 0">' ||
              '<a href="https://www.studyalready.com/assets/docs/StudyAlready-Dossier-FWB.pdf" style="background:#f5b800;color:#0a2540;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;font-weight:700;font-size:13px">Télécharger le PDF StudyAlready →</a>' ||
            '</p>' ||
          '</div>' ||
          '<p style="margin:0 0 8px 0;font-size:14px;color:#334155">Besoin d''une réponse rapide ?</p>' ||
          '<p style="margin:0 0 14px 0">' ||
            '<a href="https://wa.me/32465339448" style="color:#1e3a8a;text-decoration:underline;font-weight:600">WhatsApp +32 465 33 94 48</a>' ||
          '</p>' ||
          '<p style="margin:0;color:#64748b;font-size:12px;line-height:1.5">Email automatique StudyAlready — merci de ne pas répondre directement à cet email.</p>' ||
        '</div>' ||
      '</div>';

    PERFORM public.send_email_to_address(NEW.email, client_subject, client_html);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'on_new_submission failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Verification rapide (attendu: OK)
SELECT
  'send_email_to_address' AS element,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'send_email_to_address'
  ) THEN 'OK' ELSE 'KO' END AS statut
UNION ALL
SELECT
  'on_new_submission',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'on_new_submission'
  ) THEN 'OK' ELSE 'KO' END;
