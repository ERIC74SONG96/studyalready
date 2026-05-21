-- Répare l’onglet admin « Étudiants » après suppression de admin_students_view (033/034).
-- Exécuter dans Supabase SQL Editor si la liste est vide ou si list_admin_students manque.

CREATE TABLE IF NOT EXISTS public.user_account_meta (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  signup_date timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_account_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_account_meta_admin_select" ON public.user_account_meta;
CREATE POLICY "user_account_meta_admin_select"
  ON public.user_account_meta
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

GRANT SELECT ON TABLE public.user_account_meta TO authenticated;

INSERT INTO public.user_account_meta (user_id, email, full_name, signup_date, updated_at)
SELECT
  u.id,
  u.email::text,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.created_at,
  now()
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  signup_date = EXCLUDED.signup_date,
  updated_at = now();

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
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    m.email,
    m.signup_date,
    m.full_name,
    d.id,
    d.type::text,
    d.title::text,
    d.status::text,
    d.current_step,
    d.total_steps,
    d.updated_at,
    (
      SELECT count(*)::bigint
      FROM public.dossier_messages msg
      WHERE msg.user_id = m.user_id
        AND msg.sender = 'student'
        AND msg.read_at IS NULL
    )
  FROM public.user_account_meta m
  LEFT JOIN public.student_dossiers d ON d.user_id = m.user_id
  WHERE (
    p_search IS NULL
    OR btrim(p_search) = ''
    OR m.email ILIKE '%' || p_search || '%'
    OR m.full_name ILIKE '%' || p_search || '%'
  )
  ORDER BY m.signup_date DESC
  LIMIT greatest(1, least(coalesce(p_limit, 500), 500));
END;
$$;

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
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    m.email,
    m.signup_date,
    m.full_name,
    d.id,
    d.type::text,
    d.title::text,
    d.status::text,
    d.current_step,
    d.total_steps,
    d.updated_at,
    (
      SELECT count(*)::bigint
      FROM public.dossier_messages msg
      WHERE msg.user_id = m.user_id
        AND msg.sender = 'student'
        AND msg.read_at IS NULL
    )
  FROM public.user_account_meta m
  LEFT JOIN public.student_dossiers d ON d.user_id = m.user_id
  WHERE m.user_id = p_user_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_students(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_students(text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_admin_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_student(uuid) TO authenticated;
