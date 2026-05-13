-- StudyAlready — Notification email automatique à chaque nouvelle demande
-- ==========================================================================
-- À chaque INSERT dans form_submissions et profiles, Postgres appelle
-- l'API Resend (https://resend.com) via l'extension pg_net pour envoyer
-- un email récapitulatif à l'admin StudyAlready.
--
-- AVANT D'EXÉCUTER CE SCRIPT :
--   1) Créer un compte gratuit sur https://resend.com (Sign up).
--   2) Aller dans "API Keys" → "Create API Key" → nom : "StudyAlready Postgres"
--      → permissions : "Sending access" → Create.
--   3) Copier la clé qui commence par "re_..." et la coller à la
--      place de "REMPLACER_PAR_VOTRE_CLE_RESEND" plus bas (ligne RESEND_API_KEY).
--   4) Aller dans "Audience" → repérer l'email "onboarding@resend.dev" :
--      en mode test gratuit, Resend n'envoie qu'aux emails inscrits
--      sur le compte. Vérifiez que NOTIFY_TO ci-dessous est bien l'email
--      utilisé pour créer votre compte Resend.
--
-- À exécuter une fois dans Supabase : SQL Editor → New query → Run.
-- ==========================================================================

-- 1) Activer l'extension pg_net (HTTP depuis Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Stocker la configuration dans une table privée (pas accessible à l'API publique)
CREATE TABLE IF NOT EXISTS private_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE private_settings ENABLE ROW LEVEL SECURITY;
-- Aucune policy = aucun accès via l'API publique (anon / authenticated).
-- Seules les fonctions SECURITY DEFINER peuvent lire dedans.

-- 3) Upserts des valeurs : remplacez les 3 lignes ci-dessous
INSERT INTO private_settings (key, value) VALUES
  ('RESEND_API_KEY', 'REMPLACER_PAR_VOTRE_CLE_RESEND'),  -- clé Resend (re_...)
  ('NOTIFY_TO',      'studyalready8@gmail.com'),         -- destinataire des alertes
  ('NOTIFY_FROM',    'StudyAlready <onboarding@resend.dev>')  -- expéditeur (laisser tant que le domaine n'est pas vérifié sur Resend)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4) Fonction utilitaire : envoyer un email via Resend
CREATE OR REPLACE FUNCTION public.send_admin_email(
  subject text,
  html text
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  api_key text;
  notify_to text;
  notify_from text;
  req_id bigint;
BEGIN
  SELECT value INTO api_key FROM private_settings WHERE key = 'RESEND_API_KEY';
  SELECT value INTO notify_to FROM private_settings WHERE key = 'NOTIFY_TO';
  SELECT value INTO notify_from FROM private_settings WHERE key = 'NOTIFY_FROM';

  IF api_key IS NULL OR api_key = '' OR api_key = 'REMPLACER_PAR_VOTRE_CLE_RESEND' THEN
    RAISE NOTICE 'send_admin_email: RESEND_API_KEY non configuré, email ignoré';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', notify_from,
      'to', jsonb_build_array(notify_to),
      'subject', subject,
      'html', html
    )
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_admin_email(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_admin_email(text, text) FROM anon, authenticated;

-- 5) Trigger : à chaque nouvelle ligne dans form_submissions
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'on_new_submission failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_form_submissions_notify ON public.form_submissions;
CREATE TRIGGER trg_form_submissions_notify
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_submission();

-- 6) Trigger pour les nouveaux profils annuaire
CREATE OR REPLACE FUNCTION public.on_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contact text;
BEGIN
  contact := COALESCE(NEW.prenom, '') || ' ' || COALESCE(NEW.nom, '');
  IF NEW.email IS NOT NULL THEN contact := contact || ' · ' || NEW.email; END IF;
  IF NEW.universite IS NOT NULL THEN contact := contact || ' · ' || NEW.universite; END IF;

  PERFORM public.send_admin_email(
    '[StudyAlready] Nouveau profil dans l’annuaire à valider',
    '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#0a2540">' ||
      '<div style="background:#1e3a8a;color:white;padding:20px 24px;border-radius:12px 12px 0 0">' ||
        '<p style="margin:0;color:#f5b800;font-size:11px;letter-spacing:2px;text-transform:uppercase">StudyAlready · Annuaire</p>' ||
        '<h1 style="margin:6px 0 0 0;font-size:20px">Profil à valider</h1>' ||
      '</div>' ||
      '<div style="background:white;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px">' ||
        '<p><strong>' || contact || '</strong></p>' ||
        '<p style="color:#64748b">Statut actuel : <strong>' || COALESCE(NEW.status, 'pending') || '</strong> — à valider depuis le dashboard.</p>' ||
        '<p style="margin-top:20px"><a href="https://www.studyalready.com/admin.html" style="background:#0a2540;color:white;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600;font-size:13px">Voir le profil →</a></p>' ||
      '</div>' ||
    '</div>'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'on_new_profile failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_notify ON public.profiles;
CREATE TRIGGER trg_profiles_notify
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_profile();

COMMENT ON FUNCTION public.send_admin_email(text, text) IS 'Envoie un email via Resend en utilisant la config stockée dans private_settings.';
COMMENT ON TABLE private_settings IS 'Configuration interne (clés API). Aucune policy RLS = invisible côté API publique.';
