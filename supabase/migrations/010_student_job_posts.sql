-- StudyAlready — Offres d'emploi étudiant publiées par les comptes connectés (texte + image optionnelle).
-- Après exécution : Storage → créer un bucket **public** nommé `job-offers` (voir README dans ce dossier si besoin).

CREATE TABLE IF NOT EXISTS public.student_job_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_label text NOT NULL DEFAULT 'Membre',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  contact_hint text,
  image_path text,
  CONSTRAINT student_job_posts_title_len CHECK (char_length(title) <= 200),
  CONSTRAINT student_job_posts_title_nonempty CHECK (length(trim(title)) >= 3),
  CONSTRAINT student_job_posts_desc_len CHECK (char_length(description) <= 8000),
  CONSTRAINT student_job_posts_author_label_len CHECK (char_length(author_label) <= 120),
  CONSTRAINT student_job_posts_contact_len CHECK (contact_hint IS NULL OR char_length(contact_hint) <= 500),
  CONSTRAINT student_job_posts_content CHECK (
    image_path IS NOT NULL OR length(trim(description)) >= 10
  )
);

CREATE INDEX IF NOT EXISTS idx_student_job_posts_created ON public.student_job_posts (created_at DESC);

ALTER TABLE public.student_job_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_job_posts_select_all" ON public.student_job_posts;
CREATE POLICY "student_job_posts_select_all"
  ON public.student_job_posts
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "student_job_posts_insert_own" ON public.student_job_posts;
CREATE POLICY "student_job_posts_insert_own"
  ON public.student_job_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND length(trim(title)) >= 3
    AND (image_path IS NOT NULL OR length(trim(description)) >= 10)
  );

DROP POLICY IF EXISTS "student_job_posts_update_own" ON public.student_job_posts;
CREATE POLICY "student_job_posts_update_own"
  ON public.student_job_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "student_job_posts_delete_own" ON public.student_job_posts;
CREATE POLICY "student_job_posts_delete_own"
  ON public.student_job_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON TABLE public.student_job_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.student_job_posts TO authenticated;

COMMENT ON TABLE public.student_job_posts IS 'Annonces job étudiant : visibles sur le site ; images dans le bucket Storage public job-offers/{user_id}/...';

-- ---------- Storage : bucket public "job-offers" (création manuelle dans Studio) ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "job_offers_public_read" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "job_offers_public_read" ON storage.objects
        FOR SELECT
        USING (bucket_id = 'job-offers')
    $POL$;

    EXECUTE 'DROP POLICY IF EXISTS "job_offers_authenticated_upload_own" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "job_offers_authenticated_upload_own" ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'job-offers'
          AND auth.uid()::text = (storage.foldername(name))[1]
        )
    $POL$;

    EXECUTE 'DROP POLICY IF EXISTS "job_offers_authenticated_delete_own" ON storage.objects';
    EXECUTE $POL$
      CREATE POLICY "job_offers_authenticated_delete_own" ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'job-offers'
          AND auth.uid()::text = (storage.foldername(name))[1]
        )
    $POL$;

    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_admin'
    ) THEN
      EXECUTE 'DROP POLICY IF EXISTS "job_offers_admin_all" ON storage.objects';
      EXECUTE $POL$
        CREATE POLICY "job_offers_admin_all" ON storage.objects
          FOR ALL
          USING (bucket_id = 'job-offers' AND public.is_admin())
          WITH CHECK (bucket_id = 'job-offers' AND public.is_admin())
      $POL$;
    END IF;
  END IF;
END $$;
