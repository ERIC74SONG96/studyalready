# Activation de l'espace personnel étudiant

Ce guide explique comment activer le **suivi de dossier en ligne** pour vos étudiants.

## Ce que ça apporte

Chaque étudiant qui crée un compte sur `/espace-etudiant/` dispose d'un tableau de bord avec :

- 📂 **Mon dossier** : barre de progression et liste des étapes (FWB, visa, etc.).
- 💬 **Messages** : messagerie interne avec vous (admin), pas de spam, tout reste sur le site.
- 📎 **Documents** : il téléverse ses pièces, vous lui partagez les vôtres (PDF, max 10 Mo).
- 📋 **Mes demandes** : historique des formulaires soumis (rattachés à son compte).

Côté admin, un nouvel onglet **« Étudiants »** dans `/admin.html` vous permet de :

- voir la liste de tous les comptes inscrits ;
- ouvrir un dossier précis ;
- faire avancer les étapes (à venir / en cours / terminée / bloquée) ;
- envoyer un message ou un PDF à l'étudiant ;
- créer un dossier dédié « équivalence FWB » avec ses 6 étapes pré-remplies.

---

## Étapes d'activation (5 minutes)

### 1. Exécuter la migration SQL

1. Ouvrez votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **SQL Editor** → **New query**.
3. Copiez **tout** le contenu du fichier `supabase/migrations/006_student_dossiers.sql`.
4. Cliquez sur **Run**.
5. Vérifiez le message « Success. No rows returned ».

> Si vous voyez `function public.is_admin() does not exist`, exécutez d'abord `003_admin_dashboard.sql`.

### 2. Créer le bucket de documents

Le SQL crée les politiques d'accès, mais il faut créer le bucket à la main :

1. Dans Supabase, allez dans **Storage** → **New bucket**.
2. **Name** : `dossier-documents` (exactement comme ça).
3. **Public bucket** : **NON** — laissez désactivé (privé).
4. Cliquez sur **Create bucket**.

C'est tout — les politiques d'accès (RLS) s'appliquent automatiquement grâce à la migration.

### 3. Tester côté étudiant

1. Ouvrez `https://www.studyalready.com/espace-etudiant/` en navigation privée.
2. Onglet « Créer un compte » → renseignez un email à vous (pas `studyalready8@gmail.com`).
3. Si la confirmation email est activée dans Supabase Auth, cliquez sur le lien reçu.
4. Connectez-vous → vous arrivez sur le dashboard.
5. Vous devez voir un dossier **« Mon parcours StudyAlready »** avec 4 étapes (la 1ʳᵉ marquée terminée, la 2ᵉ en cours).

### 4. Tester côté admin

1. Ouvrez `https://www.studyalready.com/admin-login.html` et connectez-vous avec votre compte admin.
2. Cliquez sur l'onglet **« Étudiants »**.
3. Le compte que vous venez de créer doit apparaître.
4. Cliquez sur **« Ouvrir »** → la modal affiche le dossier, les étapes, les zones « Messages » et « Documents ».
5. Testez :
   - **Changer une étape** en « terminée » → l'étudiant verra la mise à jour immédiate.
   - **Envoyer un message** → il apparaît dans son onglet « Messages ».
   - **Téléverser un PDF** → il apparaît dans son onglet « Documents ».
6. Optionnel : bouton **« Créer un dossier équivalence FWB »** pour générer les 6 étapes officielles.

---

## Architecture technique

| Table | Rôle |
|---|---|
| `student_dossiers` | 1 ligne par dossier d'étudiant (parcours_general, equivalence_fwb…) |
| `dossier_steps` | étapes de chaque dossier (statuts : pending / in_progress / done / blocked) |
| `dossier_messages` | messagerie admin ↔ étudiant |
| `dossier_documents` | métadonnées des fichiers ; le contenu est dans Storage bucket `dossier-documents` |
| `form_submissions.user_id` | colonne ajoutée → relie chaque formulaire au compte étudiant connecté |
| `admin_students_view` | vue qui agrège email + dossier + progression pour l'onglet admin |

### Sécurité (RLS)

- Un étudiant ne voit **jamais** les données d'un autre étudiant.
- Seul un membre de la table `admins` peut voir/modifier les dossiers de tous les étudiants.
- Les documents Storage utilisent un préfixe `{user_id}/...` pour garantir l'isolation.

### Trigger d'inscription

À chaque création de compte (`auth.users` INSERT), un dossier `parcours_general` est créé automatiquement avec 4 étapes génériques. Vous pouvez ensuite, depuis l'admin, créer un dossier spécifique (équivalence FWB par exemple) qui s'ajoute en parallèle.

---

## Notifications email pour la messagerie (recommandé)

La migration `007_notifications_dossier.sql` ajoute deux triggers Resend :

- email à `studyalready8@gmail.com` quand un étudiant envoie un **message** ;
- email à `studyalready8@gmail.com` quand un étudiant téléverse un **document**.

Pour l'activer :

1. Assurez-vous que `005_email_notifications.sql` est exécuté et que la clé Resend est configurée dans `private_settings`.
2. Exécutez `007_notifications_dossier.sql` dans le SQL Editor de Supabase.
3. Testez : connectez-vous côté étudiant, envoyez un message — vous devez recevoir un email sous ~30 secondes.

Pour diagnostiquer un envoi qui n'arrive pas :

```sql
SELECT id, status_code, content
  FROM net._http_response
  ORDER BY id DESC
  LIMIT 5;
```

Un `status_code = 200` confirme que Resend a accepté l'email. Si vous voyez `422`, Resend est en mode test et n'envoie qu'aux adresses inscrites sur le compte Resend.

## Évolutions possibles

- Ajouter d'autres types de dossiers : visa, compte bloqué, logement, pack accueil (similaire à `create_fwb_dossier`).
- Notifications email **vers l'étudiant** quand l'admin écrit (symétrique du trigger ci-dessus, en utilisant l'email du compte).
- Lien direct depuis `admin.html` : à côté de chaque demande `form_submission`, un bouton « voir le compte étudiant ».
- Export CSV des dossiers.

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| « relation `student_dossiers` does not exist » | Migration non exécutée | Exécuter `006_student_dossiers.sql` |
| « Bucket not found » lors d'un upload | Bucket manquant | Créer le bucket `dossier-documents` (privé) |
| Le dashboard étudiant est vide | Le trigger d'inscription n'a pas créé de dossier (ancien compte) | Exécuter manuellement : `INSERT INTO public.student_dossiers (user_id, type, title) VALUES ('UUID_DE_LUSER','parcours_general','Mon parcours StudyAlready');` |
| L'onglet « Étudiants » dit « view does not exist » | Migration non exécutée | Idem, lancer 006 |
| Erreur « policy » lors d'un upload étudiant | Le bucket n'est pas privé OU les policies ne se sont pas appliquées | Refaire le bloc 8 de la migration ou supprimer/recréer le bucket |
