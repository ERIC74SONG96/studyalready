# Notifications email — StudyAlready

À chaque nouvelle soumission (formulaire ou profil annuaire), un email
récapitulatif est envoyé automatiquement à l'admin StudyAlready.

Optionnel: avec la migration `032_autoreply_form_submission_next_steps.sql`,
le client reçoit aussi un email automatique qui explique la suite
(analyse du dossier + lien PDF a completer et renvoyer).

## Architecture (sans Edge Function, 100% SQL)

```
Formulaire site
    │
    ▼
INSERT dans public.form_submissions
    │
    ▼
Trigger Postgres "trg_form_submissions_notify"
    │
    ▼
Fonction public.on_new_submission()
    │
    ▼
public.send_admin_email() → pg_net.http_post() → Resend API
    │
    ▼
Votre boîte mail ✉
```

## Activation en 5 minutes

### 1) Créer un compte Resend (gratuit, 3000 emails/mois)

1. Aller sur https://resend.com
2. **Sign up** avec votre email `tchuisseugedeon@gmail.com`
3. Confirmer l'email (Resend envoie un mail de vérification)

### 2) Récupérer la clé API

1. Dans Resend, menu de gauche → **API Keys**
2. Bouton **Create API Key**
3. Nom : `StudyAlready Postgres`
4. Permissions : **Sending access** (suffit)
5. **Create**
6. **Copier la clé** qui commence par `re_...` (elle ne sera plus affichée)

### 3) Coller la clé dans le script SQL

Ouvrir `supabase/migrations/005_email_notifications.sql`, repérer la ligne :

```sql
('RESEND_API_KEY', 'REMPLACER_PAR_VOTRE_CLE_RESEND'),
```

Remplacer `REMPLACER_PAR_VOTRE_CLE_RESEND` par votre vraie clé Resend
(en gardant les apostrophes).

Adapter aussi si besoin :

```sql
('NOTIFY_TO', 'tchuisseugedeon@gmail.com'),
```

→ mettre l'email où vous voulez recevoir les alertes (par défaut le
même que celui utilisé pour Resend, sinon vous ne recevrez rien tant
que vous n'avez pas vérifié de domaine).

### 4) Exécuter dans Supabase

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Copier-coller **tout** le contenu de `005_email_notifications.sql`
3. **Run** → "Success. No rows returned."

### 5) Tester

1. Aller sur https://www.studyalready.com/ (en navigation privée pour
   éviter le cache)
2. Remplir le formulaire de contact en bas avec un message de test
3. Envoyer
4. ✉ Dans **30 secondes max**, un email arrive sur votre boîte avec
   le contenu de la demande et un bouton "Ouvrir le dashboard".

## Si l'email n'arrive pas

## Activer l'email client "suite des etapes"

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Exécuter `supabase/migrations/032_autoreply_form_submission_next_steps.sql`
3. Tester un formulaire avec une vraie adresse email
4. Vérifier :
   - l'admin reçoit toujours l'alerte "Nouvelle demande"
   - le client reçoit l'email "Demande bien recue, voici la suite"

### Vérifier l'historique Resend

https://resend.com → **Emails** → vous voyez la liste des envois,
le statut (delivered / bounced / failed) et le message d'erreur
éventuel.

### Vérifier l'historique pg_net dans Supabase

Dans Supabase → SQL Editor → New query :

```sql
SELECT id, status_code, content, created
FROM net._http_response
ORDER BY id DESC
LIMIT 10;
```

Cela montre les 10 dernières réponses de l'API Resend.

- `status_code = 200` → email parti.
- `status_code = 401` → mauvaise clé API.
- `status_code = 403` → en mode test, Resend n'envoie qu'aux emails
  inscrits sur votre compte. Inscrivez le destinataire ou vérifiez
  un domaine.
- `status_code = 422` → format `from`/`to` invalide.

### Vérifier les notices Postgres

Dans SQL Editor → onglet **Logs** (en bas) → filtrer "send_admin_email"
ou "on_new_submission" pour voir les RAISE NOTICE.

## Passer en production (domaine vérifié)

Pour envoyer des emails depuis `notification@studyalready.com`
plutôt que `onboarding@resend.dev` :

1. Resend → **Domains** → **Add Domain** → `studyalready.com`
2. Resend affiche 3 enregistrements DNS (TXT/MX/DKIM) à ajouter chez
   votre registrar (Vercel DNS si vous gérez le DNS chez Vercel).
3. Attendre la validation (5-30 min).
4. Dans Supabase, mettre à jour la config :

```sql
UPDATE private_settings
SET value = 'StudyAlready <notification@studyalready.com>'
WHERE key = 'NOTIFY_FROM';
```

## Changer le destinataire / désactiver

```sql
-- Changer le destinataire :
UPDATE private_settings SET value = 'autre@email.com' WHERE key = 'NOTIFY_TO';

-- Désactiver temporairement (vider la clé) :
UPDATE private_settings SET value = '' WHERE key = 'RESEND_API_KEY';

-- Supprimer définitivement les triggers :
DROP TRIGGER IF EXISTS trg_form_submissions_notify ON public.form_submissions;
DROP TRIGGER IF EXISTS trg_profiles_notify ON public.profiles;
```

## Sécurité

- La clé Resend est stockée dans `private_settings` avec **RLS activé
  et aucune policy** → invisible côté API publique (anon/authenticated).
- Seules les fonctions `SECURITY DEFINER` peuvent lire la clé.
- Aucun secret n'est jamais envoyé au navigateur.
- Risque maximum si la clé fuit : envoi de spam jusqu'à 3000 mails →
  régénérer une nouvelle clé sur Resend en 30 secondes.
