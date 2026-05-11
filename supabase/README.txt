StudyAlready — Supabase (cloud)

1. Créez le projet sur supabase.com (région Europe).
2. Ouvrez SQL Editor → collez tout le fichier migrations/001_profiles_annuaire.sql → Run.
3. Tableau Table Editor → « profiles » : pour publier un profil, passez la colonne status de « pending » à « published ».
4. Les clés API (URL + anon) sont dans assets/js/config.js — ne commitez jamais la clé service_role.

Les profils « published » apparaissent dans l’annuaire via la fonction get_annuaire_profiles (sans exposer l’email).
