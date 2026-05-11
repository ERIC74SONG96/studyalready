-- StudyAlready — Toutes les soumissions de formulaire (sans Web3Forms)
-- À exécuter une fois : SQL Editor → New query → Coller → Run

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  form_type text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'processed', 'archived')),
  nom text,
  email text,
  whatsapp text,
  subject text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  origin_url text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_type ON public.form_submissions (form_type);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON public.form_submissions (status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created ON public.form_submissions (created_at DESC);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Aucune lecture publique (les données restent visibles uniquement dans le dashboard Supabase)
DROP POLICY IF EXISTS "form_submissions_block_select_anon" ON public.form_submissions;
CREATE POLICY "form_submissions_block_select_anon"
  ON public.form_submissions
  FOR SELECT
  TO anon
  USING (false);

-- Insertion publique avec validation minimale
DROP POLICY IF EXISTS "form_submissions_insert_anon" ON public.form_submissions;
CREATE POLICY "form_submissions_insert_anon"
  ON public.form_submissions
  FOR INSERT
  TO anon
  WITH CHECK (
    length(trim(form_type)) > 0
    AND length(trim(form_type)) <= 80
    AND status = 'new'
    AND (email IS NULL OR length(trim(email)) <= 200)
  );

DROP POLICY IF EXISTS "form_submissions_insert_authenticated" ON public.form_submissions;
CREATE POLICY "form_submissions_insert_authenticated"
  ON public.form_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    length(trim(form_type)) > 0
    AND status = 'new'
  );

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.form_submissions TO anon, authenticated;

COMMENT ON TABLE public.form_submissions IS 'Toutes les soumissions de formulaire StudyAlready. Le payload contient les champs originaux. Modérer dans Table Editor.';
