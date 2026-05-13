-- StudyAlready — Offres de bourses / aides à l’étude en Belgique (membres + équipe via même compte).
-- Après exécution : Storage → créer un bucket **public** nommé `scholarship-offers` (même schéma que job-offers).

CREATE TABLE IF NOT EXISTS public.student_scholarship_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_label text NOT NULL DEFAULT 'Membre',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  contact_hint text,
  image_path text,
  source_url text,
  external_image_url text,
  scope_category text NOT NULL DEFAULT 'autre',
  application_deadline date,
  CONSTRAINT student_scholarship_posts_title_len CHECK (char_length(title) <= 200),
  CONSTRAINT student_scholarship_posts_title_nonempty CHECK (length(trim(title)) >= 3),
  CONSTRAINT student_scholarship_posts_desc_len CHECK (char_length(description) <= 8000),
  CONSTRAINT student_scholarship_posts_author_label_len CHECK (char_length(author_label) <= 120),
  CONSTRAINT student_scholarship_posts_contact_len CHECK (contact_hint IS NULL OR char_length(contact_hint) <= 500),
  CONSTRAINT student_scholarship_posts_source_url_len CHECK (source_url IS NULL OR char_length(source_url) <= 2000),
  CONSTRAINT student_scholarship_posts_ext_img_len CHECK (external_image_url IS NULL OR char_length(external_image_url) <= 2000),
  CONSTRAINT student_scholarship_posts_scope_chk CHECK (
    scope_category IN (
      'wallonie_bruxelles',
      'flandre',
      'bruxelles_capital',
      'federal_eu',
      'universite_haute_ecole',
      'autre'
    )
  ),
  CONSTRAINT student_scholarship_posts_content CHECK (
    image_path IS NOT NULL
    OR external_image_url IS NOT NULL
    OR length(trim(description)) >= 10
    OR (
      coalesce(source_url, '') ~ '^https?://'
      AND length(trim(source_url)) >= 12
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_student_scholarship_posts_created ON public.student_scholarship_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_scholarship_posts_scope ON public.student_scholarship_posts (scope_category);

ALTER TABLE public.student_scholarship_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_scholarship_posts_select_all" ON public.student_scholarship_posts;
CREATE POLICY "student_scholarship_posts_select_all"
  ON public.student_scholarship_posts
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "student_scholarship_posts_insert_own" ON public.student_scholarship_posts;
CREATE POLICY "student_scholarship_posts_insert_own"
  ON public.student_scholarship_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND length(trim(title)) >= 3
    AND (
      image_path IS NOT NULL
      OR external_image_url IS NOT NULL
      OR length(trim(description)) >= 10
      OR (
        coalesce(source_url, '') ~ '^https?://'
        AND length(trim(source_url)) >= 12
      )
    )
  );

DROP POLICY IF EXISTS "student_scholarship_posts_update_own" ON public.student_scholarship_posts;
CREATE POLICY "student_scholarship_posts_update_own"
  ON public.student_scholarship_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "student_scholarship_posts_delete_own" ON public.student_scholarship_posts;
CREATE POLICY "student_scholarship_posts_delete_own"
  ON public.student_scholarship_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "student_scholarship_posts_delete_admin" ON public.student_scholarship_posts';
    EXECUTE $POL$
      CREATE POLICY "student_scholarship_posts_delete_admin"
        ON public.student_scholarship_posts
        FOR DELETE
        TO authenticated
        USING (public.is_admin())
    $POL$;
  END IF;
END $$;

GRANT SELECT ON TABLE public.student_scholarship_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.student_scholarship_posts TO authenticated;

COMMENT ON TABLE public.student_scholarship_posts IS 'Annonces bourses / aides études en Belgique ; images dans Storage public scholarship-offers/{user_id}/...';
COMMENT ON COLUMN public.student_scholarship_posts.scope_category IS 'Périmètre géographique ou type d’organisme (indicatif, pas un avis juridique).';
COMMENT ON COLUMN public.student_scholarship_posts.application_deadline IS 'Date limite de candidature si connue (optionnel).';

-- ---------- Storage : bucket public "scholarship-offers" ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "scholarship_offers_public_read" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "scholarship_offers_public_read" ON storage.objects
        FOR SELECT
        USING (bucket_id = 'scholarship-offers')
    $POL$;

    EXECUTE 'DROP POLICY IF EXISTS "scholarship_offers_authenticated_upload_own" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "scholarship_offers_authenticated_upload_own" ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'scholarship-offers'
          AND auth.uid()::text = (storage.foldername(name))[1]
        )
    $POL$;

    EXECUTE 'DROP POLICY IF EXISTS "scholarship_offers_authenticated_delete_own" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "scholarship_offers_authenticated_delete_own" ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'scholarship-offers'
          AND auth.uid()::text = (storage.foldername(name))[1]
        )
    $POL$;

    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin'
    ) THEN
      EXECUTE 'DROP POLICY IF EXISTS "scholarship_offers_admin_all" ON storage.objects';
      EXECUTE $POL$
        CREATE POLICY "scholarship_offers_admin_all" ON storage.objects
          FOR ALL
          USING (bucket_id = 'scholarship-offers' AND public.is_admin())
          WITH CHECK (bucket_id = 'scholarship-offers' AND public.is_admin())
      $POL$;
    END IF;
  END IF;
END $$;
