-- Compteurs communauté accessibles sans connexion (pages d'adhésion / liens partagés).

CREATE OR REPLACE FUNCTION public.get_public_community_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_annuaire_community_stats();
$$;

COMMENT ON FUNCTION public.get_public_community_stats() IS
  'Totaux agrégés (membres, étudiants, pros) pour social proof sur pages publiques — aucune donnée personnelle.';

REVOKE ALL ON FUNCTION public.get_public_community_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_community_stats() TO anon, authenticated;
