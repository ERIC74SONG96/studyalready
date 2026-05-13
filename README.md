# StudyAlready — Site web officiel

Site vitrine + accompagnement pour **StudyAlready**, bureau d'aide aux étudiants camerounais vers la Fédération Wallonie-Bruxelles.

Stack : HTML5 + Tailwind CSS (CDN) + JavaScript vanilla + PHP (formulaires). Aucun build, aucune dépendance à installer.

---

## Structure du projet

```
Studyalready/
├── index.html                       Page d'accueil
├── equivalence.html                 Guide équivalence FWB (SEO)
├── notre-dossier-fwb.html           Document institutionnel
├── prequalification-dossier.html    Formulaire détaillé
├── mentions-legales.html
├── politique-confidentialite.html
├── conditions-generales.html
├── engagement-ethique.html
├── .htaccess                        Config Apache (sécurité, perf)
├── robots.txt                       SEO
├── sitemap.xml                      Plan du site
├── README.md
├── blog/
│   ├── index.html                   Liste des articles
│   ├── equivalence-bts-cameroun-belgique.html
│   ├── gce-a-level-etudes-fwb.html
│   └── recuperer-originaux-equivalence-fwb.html
├── assets/
│   ├── css/style.css
│   ├── js/main.js                   Animations, menu, formulaires AJAX
│   ├── img/                         Logos SVG, og-cover, etc.
│   ├── social/                      Bannières YouTube, Insta, LinkedIn
│   └── docs/
│       ├── dossier-fwb-print.html   Source du PDF (ne pas indexer)
│       └── StudyAlready-Dossier-FWB.pdf
├── downloads/                       Logos PNG (téléchargeables)
└── php/
    ├── contact.php                  Formulaire de contact court
    └── prequalification.php         Formulaire de pré-qualification long
```

---

## Mise en ligne sur LWS (1,49 €/mois)

### Étape 1 — Souscrire l'offre LWS Perso
1. [lws.fr](https://www.lws.fr) → **LWS Perso** (PHP + MySQL + emails illimités).
2. À la commande, ajoutez le domaine **studyalready.com** (~12 €/an la première année).
3. Validez. LWS envoie deux emails : panel + identifiants FTP.

### Étape 2 — Récupérer les accès FTP
Dans votre panel LWS → **Hébergement → FTP / Accès FTP**. Notez :
- Hôte (souvent `ftp.studyalready.com` ou un IP)
- Identifiant
- Mot de passe
- Port (21 en général)

### Étape 3 — Uploader avec FileZilla
1. Installer [FileZilla](https://filezilla-project.org/).
2. Se connecter avec les identifiants ci-dessus.
3. Sur le serveur, ouvrir le dossier racine (souvent `/htdocs`, `/public_html` ou `/www`).
4. Glisser **tout le contenu** de `c:\Users\admin\Desktop\Studyalready\` dedans, en conservant la structure :

```
htdocs/
├── index.html
├── equivalence.html
├── notre-dossier-fwb.html
├── prequalification-dossier.html
├── mentions-legales.html
├── politique-confidentialite.html
├── conditions-generales.html
├── engagement-ethique.html
├── .htaccess
├── robots.txt
├── sitemap.xml
├── blog/                (avec les 4 fichiers HTML)
├── assets/              (css, js, img, social, docs)
└── php/                 (contact.php + prequalification.php)
```

Le dossier `downloads/` (les PNG de logos) peut être uploadé aussi, ou gardé en local : c'est juste pour vous.

### Étape 4 — Activer HTTPS gratuit
Dans le panel LWS → **SSL / Let's Encrypt** → activer pour `studyalready.com` et `www.studyalready.com`. Patientez 10–30 min.

Une fois actif, ouvrir `.htaccess` et **décommenter** ce bloc (retirer les `#`) :

```
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

Puis re-uploader le `.htaccess` modifié.

### Étape 5 — Créer les emails
Dans le panel LWS → **Emails / Comptes mail** :
- `contact@studyalready.com` (boîte principale actuelle)
- `no-reply@studyalready.com` (réservé aux envois automatiques si vous activez un jour le domaine personnalisé)

Ces deux adresses sont déjà configurées dans `php/contact.php` et `php/prequalification.php` — aucune modification nécessaire si vous gardez ces noms.

### Étape 6 — Tester les formulaires
1. Aller sur `https://studyalready.com`.
2. Envoyer un test depuis le formulaire de contact.
3. Vérifier la réception sur `contact@studyalready.com`.
4. Refaire un test avec `https://studyalready.com/prequalification-dossier.html`.

Les soumissions de formulaire sont stockées dans la base **Supabase** (tables `profiles` et `form_submissions`). Pour les consulter : Supabase Dashboard → Table Editor → `form_submissions`. Aucune dépendance à un service tiers d'email.

### Étape 7 — Soumettre à Google
1. [Google Search Console](https://search.google.com/search-console) → ajouter `studyalready.com` (vérification via DNS LWS ou balise HTML).
2. Soumettre `https://www.studyalready.com/sitemap.xml`.

---

## Mises à jour ultérieures

Pour modifier le site après mise en ligne :
1. Modifier le fichier en local (dans Cursor).
2. Le ré-uploader via FileZilla, **en écrasant** l'ancien.
3. Vider le cache navigateur si vous ne voyez pas la modif.

Le PDF du dossier institutionnel peut être régénéré localement avec Microsoft Edge en mode headless (voir `assets/docs/dossier-fwb-print.html`).

---

## Test en local (avant upload)

### Sans formulaire (rapide)
Double-cliquez sur `index.html`. Le formulaire affichera un message expliquant qu'il ne marche qu'en ligne.

### Avec formulaires (PHP) — recommandé
Installez [XAMPP](https://www.apachefriends.org/fr/index.html), placez le dossier dans `C:\xampp\htdocs\Studyalready`, démarrez Apache, ouvrez `http://localhost/Studyalready/`.
