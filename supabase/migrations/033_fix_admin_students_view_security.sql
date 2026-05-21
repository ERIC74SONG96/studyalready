-- Corrige les alertes Security Advisor sur admin_students_view :
--   • Exposed Auth Users (auth.users via vue publique + GRANT authenticated)
--   • Security Definer View
-- Remplacement par des RPC admin-only (SECURITY DEFINER + is_admin()).

-- 1) Retirer l'accès direct à la vue
REVOKE ALL ON public.admin_students_view FROM PUBLIC, anon, authenticated;
DROP VIEW IF EXISTS public.admin_students_view;

-- 2) Liste des étudiants (onglet admin)
CREATE OR REPLACE FUNCTION public.list_admin_students(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  user_id uuid,
  email text,
  signup_date timestamptz,
  full_name text,
  dossier_id uuid,
  dossier_type text,
  dossier_title text,
  dossier_status text,
  current_step integer,
  total_steps integer,
  dossier_updated_at timestamptz,
  unread_from_student bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::text,
    d.id,
    d.type::text,
    d.title::text,
    d.status::text,
    d.current_step,
    d.total_steps,
    d.updated_at,
    (
      SELECT COUNT(*)::bigint
      FROM public.dossier_messages m
      WHERE m.user_id = u.id
        AND m.sender = 'student'
        AND m.read_at IS NULL
    )
  FROM auth.users u
  LEFT JOIN public.student_dossiers d ON d.user_id = u.id
  WHERE (
    p_search IS NULL
    OR btrim(p_search) = ''
    OR u.email ILIKE '%' || p_search || '%'
    OR COALESCE(u.raw_user_meta_data->>'full_name', '') ILIKE '%' || p_search || '%'
  )
  ORDER BY u.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 500));
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_students(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_students(text, integer) TO authenticated;

-- 3) Fiche d'un étudiant (modal admin)
CREATE OR REPLACE FUNCTION public.get_admin_student(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  signup_date timestamptz,
  full_name text,
  dossier_id uuid,
  dossier_type text,
  dossier_title text,
  dossier_status text,
  current_step integer,
  total_steps integer,
  dossier_updated_at timestamptz,
  unread_from_student bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    COALESCE(u.raw_user_meta_data->>'full_name', '')::text,
    d.id,
    d.type::text,
    d.title::text,
    d.status::text,
    d.current_step,
    d.total_steps,
    d.updated_at,
    (
      SELECT COUNT(*)::bigint
      FROM public.dossier_messages m
      WHERE m.user_id = u.id
        AND m.sender = 'student'
        AND m.read_at IS NULL
    )
  FROM auth.users u
  LEFT JOIN public.student_dossiers d ON d.user_id = u.id
  WHERE u.id = p_user_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_student(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_admin_students IS
  'Liste admin des comptes étudiants (remplace admin_students_view). Réservé is_admin().';
COMMENT ON FUNCTION public.get_admin_student IS
  'Fiche admin d''un étudiant par user_id. Réservé is_admin().';
