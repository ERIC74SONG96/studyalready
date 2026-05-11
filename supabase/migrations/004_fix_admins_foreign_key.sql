-- StudyAlready — Corrige la clé étrangère public.admins → auth.users
--
-- Symptôme dans SQL Editor :
--   ERROR: 23503 ... violates foreign key constraint "admins_user_id_fkey"
--   DETAIL: Key (user_id)=(...) is not present in table "users".
--
-- Cause fréquente : la table admins a été créée avec REFERENCES users(id)
-- sans schéma → PostgreSQL référence public.users (vide) au lieu de auth.users.
--
-- À exécuter une fois : SQL Editor → Run

ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_user_id_fkey;

ALTER TABLE public.admins
  ADD CONSTRAINT admins_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
