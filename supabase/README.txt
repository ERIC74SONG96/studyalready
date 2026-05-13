StudyAlready — Supabase (cloud)

1. Créez le projet sur supabase.com (région Europe).
2. Ouvrez SQL Editor → collez tout le fichier migrations/001_profiles_annuaire.sql → Run.
3. Tableau Table Editor → « profiles » : pour publier un profil, passez la colonne status de « pending » à « published ».
4. Les clés API (URL + anon) sont dans assets/js/config.js — ne commitez jamais la clé service_role.

Les profils « published » apparaissent dans l’annuaire via la fonction get_annuaire_profiles (sans exposer l’email).

Offres job étudiant (offres-etudiants.html ; jobs-etudiants.html redirige) — migrations 014 (lien + image) et 015 (catégories) : exécuter migrations/010_student_job_posts.sql puis créer dans Storage un bucket PUBLIC nommé « job-offers » (sinon le téléversement d’images échoue).

Bourses & aides aux études (bourses-belgique.html ; /bourses redirige) : dans Supabase → SQL Editor → exécuter dans l’ordre (1) migrations/016_student_scholarship_posts.sql (2) migrations/017_storage_scholarship_offers_bucket.sql. Le fichier 017 crée le bucket public « scholarship-offers » en SQL (alternative : Storage → New bucket → id scholarship-offers, public). La fonction public.is_admin() (migration 003) permet aux admins de supprimer toute fiche ; sans 003, la politique « delete admin » n’est pas créée.

Contexte inscription / personnalisation : migration 011_user_site_context.sql (table public.user_site_context). Si la table est vide alors que des comptes existent déjà, exécuter une fois 012_backfill_user_site_context.sql dans le SQL Editor.
