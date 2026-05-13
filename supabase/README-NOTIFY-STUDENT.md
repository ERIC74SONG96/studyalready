# Notifications email à l'étudiant (migration 009)

À partir de la migration `009_notify_student.sql`, chaque fois que **vous (admin)** écrivez un message ou uploadez un document à un étudiant depuis le dashboard admin, **l'étudiant reçoit automatiquement un email** avec un aperçu et un bouton pour rejoindre son espace.

## Ce que la migration fait

1. **Normalise les clés `private_settings`** en majuscules (`RESEND_API_KEY`, `NOTIFY_TO`, `NOTIFY_FROM`) — sinon `send_admin_email` ne trouve pas la clé et aucun email ne part.
2. **Crée la fonction `send_user_email(target_user_id, subject, html)`** qui envoie un email Resend à l'adresse de l'utilisateur correspondant dans `auth.users`.
3. **Étend les 2 triggers existants** :
   - `on_new_dossier_message` : si `sender = 'admin'` → email à l'étudiant. Si `sender = 'student'` → email à l'admin (inchangé).
   - `on_new_dossier_document` : pareil avec `uploaded_by`.

## Comment exécuter

1. Ouvrir Supabase → **SQL Editor → New query**
2. Coller le contenu de `supabase/migrations/009_notify_student.sql`
3. Cliquer **Run**
4. En bas, un tableau de 4 lignes doit afficher 4 fois **OK**

## Test rapide

1. Connectez-vous en admin sur `/admin-login.html`
2. Allez dans **Étudiants (comptes)** → ouvrez un compte test
3. Envoyez un message court
4. L'étudiant (vous, sur un autre email) reçoit un email **« StudyAlready vous a envoyé un message »**
5. Bouton « Lire le message → » qui redirige vers `/espace-etudiant/dashboard.html`

## ⚠️ Limitation Resend en mode test

En **mode test gratuit** (sans domaine vérifié), Resend n'envoie qu'à l'email du **compte Resend lui-même** (`studyalready8@gmail.com`).

Pour envoyer aux vrais étudiants :

1. Aller sur https://resend.com/domains
2. Cliquer sur **« Add Domain »** → `studyalready.com`
3. Ajouter les 3 enregistrements DNS (SPF, DKIM, DMARC) chez votre registrar
4. Attendre la vérification (1 à 60 min)
5. Mettre à jour `NOTIFY_FROM` :

   ```sql
   UPDATE public.private_settings
      SET value = 'StudyAlready <hello@studyalready.com>'
    WHERE key = 'NOTIFY_FROM';
   ```

## Diagnostic — si un email n'arrive pas

Dans Supabase **SQL Editor** :

```sql
SELECT id, created, status_code, content
  FROM net._http_response
 ORDER BY created DESC
 LIMIT 5;
```

- `status_code = 200` : email envoyé OK (vérifier la boîte / spam)
- `status_code = 422` : Resend refuse l'envoi → email destinataire non autorisé (mode test)
- `status_code = 401` : clé API invalide → relancer la migration ou regénérer la clé
- aucun résultat : le trigger n'a pas été appelé → vérifier que `009` est bien exécuté
