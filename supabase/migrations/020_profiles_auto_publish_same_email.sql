-- Profil annuaire : publication immédiate si l’insertion est faite par un compte
-- connecté (JWT) dont l’e-mail (auth.users) = e-mail saisi sur le formulaire (trim + lower).
-- Sinon : pending (modération manuelle comme avant).

CREATE OR REPLACE FUNCTION public.profiles_force_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uemail text;
BEGIN
  IF auth.uid() IS NULL THEN
    NEW.status := 'pending';
    RETURN NEW;
  END IF;

  SELECT lower(trim(u.email))
  INTO uemail
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF uemail IS NOT NULL AND lower(trim(NEW.email)) = uemail THEN
    NEW.status := 'published';
  ELSE
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_force_pending() IS
  'BEFORE INSERT sur profiles : sans compte ou e-mail différent du compte → pending ; connecté avec le même e-mail que auth.users → published.';
