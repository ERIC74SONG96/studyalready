-- StudyAlready — Événements communautaires (webinaires, ateliers, meetups…)
-- Visibles sur annuaire (vue Événements), evenements-seminaires.html et création par membres connectés.

CREATE OR REPLACE FUNCTION public.is_studyalready_community_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.form_submissions fs
        WHERE fs.user_id = auth.uid() AND fs.form_type = 'rejoindre-reseau'
      )
      OR (
        length(trim(coalesce(auth.jwt() ->> 'email', ''))) > 3
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE lower(trim(coalesce(p.email, ''))) = lower(trim(auth.jwt() ->> 'email'))
        )
      )
  END;
$$;

COMMENT ON FUNCTION public.is_studyalready_community_member() IS
  'Membre communauté : admin, rejoindre-reseau, ou profil annuaire avec même email JWT.';

CREATE TABLE IF NOT EXISTS public.community_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_label text NOT NULL DEFAULT 'Membre',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT 'autre',
  event_format text NOT NULL DEFAULT 'online',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text,
  city text,
  link_url text,
  contact_hint text,
  is_free boolean NOT NULL DEFAULT true,
  price_hint text,
  status text NOT NULL DEFAULT 'published',
  CONSTRAINT community_events_title_len CHECK (char_length(title) <= 200),
  CONSTRAINT community_events_title_nonempty CHECK (length(trim(title)) >= 3),
  CONSTRAINT community_events_desc_len CHECK (char_length(description) <= 12000),
  CONSTRAINT community_events_author_len CHECK (char_length(author_label) <= 120),
  CONSTRAINT community_events_type_chk CHECK (event_type IN (
    'webinaire', 'atelier', 'seminaire', 'meetup', 'networking',
    'conference', 'social', 'sport', 'culture', 'autre'
  )),
  CONSTRAINT community_events_format_chk CHECK (event_format IN ('online', 'presentiel', 'hybride')),
  CONSTRAINT community_events_status_chk CHECK (status IN ('published', 'cancelled')),
  CONSTRAINT community_events_location_len CHECK (location IS NULL OR char_length(location) <= 500),
  CONSTRAINT community_events_city_len CHECK (city IS NULL OR char_length(city) <= 120),
  CONSTRAINT community_events_link_len CHECK (link_url IS NULL OR char_length(link_url) <= 2000),
  CONSTRAINT community_events_contact_len CHECK (contact_hint IS NULL OR char_length(contact_hint) <= 500),
  CONSTRAINT community_events_price_len CHECK (price_hint IS NULL OR char_length(price_hint) <= 200),
  CONSTRAINT community_events_content CHECK (
    length(trim(description)) >= 20 OR length(trim(coalesce(location, ''))) >= 3
  )
);

CREATE INDEX IF NOT EXISTS idx_community_events_starts ON public.community_events (starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_events_status_starts ON public.community_events (status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_events_type ON public.community_events (event_type);
CREATE INDEX IF NOT EXISTS idx_community_events_city ON public.community_events (city);

CREATE OR REPLACE FUNCTION public.community_events_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_events_updated ON public.community_events;
CREATE TRIGGER trg_community_events_updated
  BEFORE UPDATE ON public.community_events
  FOR EACH ROW
  EXECUTE FUNCTION public.community_events_set_updated_at();

ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_events_select_published" ON public.community_events;
CREATE POLICY "community_events_select_published"
  ON public.community_events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "community_events_insert_member" ON public.community_events;
CREATE POLICY "community_events_insert_member"
  ON public.community_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_studyalready_community_member()
    AND status = 'published'
    AND length(trim(title)) >= 3
  );

DROP POLICY IF EXISTS "community_events_update_own" ON public.community_events;
CREATE POLICY "community_events_update_own"
  ON public.community_events
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "community_events_delete_own" ON public.community_events;
CREATE POLICY "community_events_delete_own"
  ON public.community_events
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON TABLE public.community_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.community_events TO authenticated;

COMMENT ON TABLE public.community_events IS
  'Événements proposés par les membres : webinaires, ateliers, meetups. Modération = signalement email.';
