-- StudyAlready — Précision juridique / produit : contexte lieu = déclaratif, pas de vérification imposée.

COMMENT ON TABLE public.user_site_context IS
  'Déclaration utilisateur à l''inscription (Belgique / hors + persona). Sert à personnaliser l''interface et les contenus. StudyAlready n''impose pas de preuve de lieu (pas de contrôle documentaire obligatoire).';

COMMENT ON COLUMN public.user_site_context.signup_location IS
  'Valeur déclarée par l''utilisateur (belgique | hors) — non vérifiée sur pièces.';

COMMENT ON COLUMN public.user_site_context.signup_be_mode IS
  'Sous-choix déclaratif si Belgique : etudiant | pro.';

COMMENT ON COLUMN public.user_site_context.espace_persona IS
  'Persona StudyAlready (parcours UX) — cohérent avec la déclaration, sans audit d''identité.';
