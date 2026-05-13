-- Liens source + image distante (aperçu) pour les annonces job ; alignement contrainte / RLS avec le client.

ALTER TABLE public.student_job_posts
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS external_image_url text;

ALTER TABLE public.student_job_posts DROP CONSTRAINT IF EXISTS student_job_posts_source_url_len;
ALTER TABLE public.student_job_posts ADD CONSTRAINT student_job_posts_source_url_len
  CHECK (source_url IS NULL OR char_length(source_url) <= 2000);

ALTER TABLE public.student_job_posts DROP CONSTRAINT IF EXISTS student_job_posts_ext_img_len;
ALTER TABLE public.student_job_posts ADD CONSTRAINT student_job_posts_ext_img_len
  CHECK (external_image_url IS NULL OR char_length(external_image_url) <= 2000);

ALTER TABLE public.student_job_posts DROP CONSTRAINT IF EXISTS student_job_posts_content;
ALTER TABLE public.student_job_posts ADD CONSTRAINT student_job_posts_content CHECK (
  image_path IS NOT NULL
  OR external_image_url IS NOT NULL
  OR length(trim(description)) >= 10
  OR (
    coalesce(source_url, '') ~ '^https?://'
    AND length(trim(source_url)) >= 12
  )
);

DROP POLICY IF EXISTS "student_job_posts_insert_own" ON public.student_job_posts;
CREATE POLICY "student_job_posts_insert_own"
  ON public.student_job_posts
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

COMMENT ON COLUMN public.student_job_posts.source_url IS 'URL de l''offre originale (site employeur, Indeed, etc.).';
COMMENT ON COLUMN public.student_job_posts.external_image_url IS 'URL d''image distante (ex. Open Graph) si pas d''image dans Storage.';
