-- Toute fiche « Créer mon profil » (consentement publication + RLS déjà vérifiés à l’insert)
-- est visible dans l’annuaire sans étape manuelle. Les visiteurs / membres voient la liste
-- via get_annuaire_profiles() uniquement pour status = 'published'.

CREATE OR REPLACE FUNCTION public.profiles_force_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  NEW.status := 'published';
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_force_pending() IS
  'BEFORE INSERT sur profiles : statut toujours published (annuaire immédiat ; consentements vérifiés par RLS).';

-- Fiches déjà enregistrées en attente : les rendre visibles dans l’annuaire.
UPDATE public.profiles
SET status = 'published'
WHERE status = 'pending';
