# StudyAlready — Checklist de tests fonctionnels

Cocher chaque case **après** un test réussi en navigation privée (Ctrl + Shift + N).
Toujours forcer le rechargement (Ctrl + Shift + R) sur les pages publiques.

---

## 1. Audit base de données

- [ ] Exécuter `supabase/AUDIT.sql` dans Supabase → SQL Editor → New query
- [ ] Tous les statuts disent `OK` (sinon exécuter la migration mentionnée)
- [ ] Au moins un admin est listé dans la section 5
- [ ] La clé Resend est `OK (cle Resend detectee)` dans la section 6

## 2. Configuration Supabase Auth

Aller dans **Supabase → Authentication → URL Configuration** :

- [ ] **Site URL** = `https://www.studyalready.com/espace-etudiant/`
- [ ] **Redirect URLs** contient :
  - `https://www.studyalready.com/**`
  - `http://localhost:3000/**` (utile pour les tests locaux, optionnel)
- [ ] Le bouton **Save changes** a disparu après avoir cliqué (sinon recliquer)

## 3. Storage bucket pour les documents

Aller dans **Supabase → Storage** :

- [ ] Le bucket `dossier-documents` existe
- [ ] Il est en mode **Private** (pas Public)

## 4. Test inscription étudiant (parcours complet)

- [ ] Aller sur `https://www.studyalready.com/espace-etudiant/`
- [ ] Le **loader plein écran** s'affiche puis disparaît rapidement
- [ ] Le formulaire **Connexion / Créer un compte** s'affiche
- [ ] Cliquer sur « Créer un compte », remplir avec un **nouvel email** (ex. votre.adresse+test1@gmail.com)
- [ ] Message vert : « Compte créé ! Ouvrez l'email de confirmation… »
- [ ] **Recevoir l'email de confirmation** (vérifier les spams)
- [ ] Cliquer sur le lien → vous arrivez sur votre **dashboard** (pas une 404)
- [ ] Vous voyez votre nom + email + onglets « Mon dossier / Messages / Documents / Mes demandes »
- [ ] Onglet « Mon dossier » : un dossier « Mon parcours StudyAlready » s'affiche avec 4 étapes

## 5. Test connexion / déconnexion

- [ ] Cliquer sur « Se déconnecter » → retour sur `/espace-etudiant/`
- [ ] Se reconnecter avec le même email + mot de passe → retour direct sur le dashboard
- [ ] Fermer l'onglet, rouvrir une nouvelle fenêtre privée, aller sur `/espace-etudiant/`
- [ ] Sans être connecté : le formulaire s'affiche normalement (pas de boucle)

## 6. Test « Mon espace » sans flash

- [ ] Se reconnecter
- [ ] Depuis n'importe quelle page du site, cliquer sur **Mon espace** dans le menu
- [ ] Vous voyez le loader puis arrivez directement sur le dashboard
- [ ] **Pas de flash** du formulaire de connexion

## 7. Test formulaire public (sans compte)

- [ ] En navigation privée (non connecté), aller sur une page avec formulaire (ex. `equivalence.html`)
- [ ] Remplir et soumettre le formulaire
- [ ] Message de confirmation s'affiche
- [ ] Vérifier dans **Supabase → Table Editor → form_submissions** que la ligne est créée

## 8. Test email admin

- [ ] Vérifier votre boîte mail (`studyalready8@gmail.com`)
- [ ] Vous recevez un email automatique « Nouvelle demande StudyAlready » avec les infos du test 7
- [ ] Si pas reçu après 1 minute, exécuter cette requête dans Supabase SQL :
  ```sql
  SELECT id, created, status_code, content
  FROM net._http_response
  ORDER BY created DESC LIMIT 5;
  ```
  - Status 200 = email envoyé OK
  - Status 422 = email destinataire non autorisé par Resend (mode test)
  - Status 401 = clé API invalide

## 9. Test message étudiant → email admin

- [ ] Sur le dashboard étudiant, onglet « Messages »
- [ ] Envoyer un message test
- [ ] Vérifier la boîte `studyalready8@gmail.com` → email « Nouveau message d'un étudiant »

## 10. Test dashboard admin

- [ ] Aller sur `https://www.studyalready.com/admin-login.html`
- [ ] Se connecter avec votre compte admin (celui ajouté dans la table `admins`)
- [ ] Vous arrivez sur `admin.html` avec les onglets « Demandes / Annuaire / Étudiants »
- [ ] Onglet « Demandes » : la soumission du test 7 apparaît
- [ ] Onglet « Étudiants (comptes) » : votre compte test du test 4 apparaît
- [ ] Cliquer sur « Voir le dossier » → modal qui affiche le dossier, vous pouvez répondre / envoyer un doc

## 11. Test inverse : admin envoie un message à l'étudiant

- [ ] Depuis le modal admin, envoyer un message à l'étudiant test
- [ ] Se reconnecter en tant qu'étudiant (autre fenêtre privée)
- [ ] Dans l'onglet « Messages » du dashboard, le message admin apparaît
- [ ] **Pour l'instant : pas d'email envoyé à l'étudiant** — c'est la prochaine fonctionnalité à ajouter

---

## En cas d'échec

Notez **le numéro du test qui échoue** et joignez :
- Une **capture d'écran** de l'écran
- La **console du navigateur** (F12 → Console) si erreurs visibles
- Le résultat de `AUDIT.sql` si pertinent
