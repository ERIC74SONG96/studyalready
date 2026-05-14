StudyAlready — Supabase (cloud)

1. Créez le projet sur supabase.com (région Europe).
2. Ouvrez SQL Editor → collez tout le fichier migrations/001_profiles_annuaire.sql → Run.
3. Tableau Table Editor → « profiles » : pour publier un profil, passez la colonne status de « pending » à « published ».
4. Les clés API (URL + anon) sont dans assets/js/config.js — ne commitez jamais la clé service_role.

Les profils « published » apparaissent dans l’annuaire via la fonction get_annuaire_profiles (sans exposer l’email).
Migration 018_annuaire_gate_communaute.sql : les comptes connectés sans adhésion communauté (rejoindre le réseau avec user_id, ou profil annuaire même e-mail, ou admin) reçoivent denied=true et ne voient pas la liste — les visiteurs non connectés gardent l’accès public.
019_annuaire_gate_rejoindre_email.sql : même adresse e-mail qu’une adhésion « rejoindre » (même sans user_id) ouvre aussi l’annuaire une fois connecté.
020_profiles_auto_publish_same_email.sql : création de profil annuaire en « published » si l’utilisateur est connecté (JWT) et que l’e-mail du formulaire = e-mail du compte ; sinon « pending » comme avant.
Rejoindre le réseau (rejoindre-reseau.html) : crée un compte Mon espace + form_submissions (assets/js/rejoindre-reseau-auth.js).

Offres job étudiant (offres-etudiants.html ; jobs-etudiants.html redirige) — migrations 014 (lien + image) et 015 (catégories) : exécuter migrations/010_student_job_posts.sql puis créer dans Storage un bucket PUBLIC nommé « job-offers » (sinon le téléversement d’images échoue).

Contexte inscription / personnalisation : migration 011_user_site_context.sql (table public.user_site_context). Si la table est vide alors que des comptes existent déjà, exécuter une fois 012_backfill_user_site_context.sql dans le SQL Editor.
