-- Type d’annonce (partage membre) : soutien scolaire, emploi étudiant, stage, autre.

ALTER TABLE public.student_job_posts
  ADD COLUMN IF NOT EXISTS offer_category text NOT NULL DEFAULT 'autre_communaute';

ALTER TABLE public.student_job_posts DROP CONSTRAINT IF EXISTS student_job_posts_offer_category_chk;
ALTER TABLE public.student_job_posts ADD CONSTRAINT student_job_posts_offer_category_chk
  CHECK (
    offer_category IN (
      'soutien_scolaire',
      'emploi_universitaire',
      'stage',
      'autre_communaute'
    )
  );

COMMENT ON COLUMN public.student_job_posts.offer_category IS 'Catégorie d’annonce publiée par un membre (StudyAlready n’est pas employeur).';
