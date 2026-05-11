// ============================================================
// CONFIGURATION FORMULAIRES — STUDYALREADY
// ============================================================
// Service utilisé : Web3Forms (gratuit, illimité)
// Inscription en 1 minute sur https://web3forms.com/
// Collez ci-dessous la clé d'accès reçue par email.
//
// IMPORTANT : tant que la clé est "REMPLACER_PAR_VOTRE_CLE",
// les formulaires afficheront un message d'erreur clair.
// ============================================================

window.STUDYALREADY_CONFIG = {
  // Clé d'accès Web3Forms (32 caractères, format UUID)
  WEB3FORMS_ACCESS_KEY: 'REMPLACER_PAR_VOTRE_CLE',

  // Destination par défaut (informatif — Web3Forms envoie à l'email associé à la clé)
  CONTACT_EMAIL: 'contact@studyalready.com',

  // --- Espace étudiant (Supabase Auth) : https://supabase.com ---
  // Dashboard projet → Settings → API : Project URL + anon public key
  // Ne jamais mettre la clé "service_role" ici (réservée au serveur).
  SUPABASE_URL: 'REMPLACER_PAR_VOTRE_URL_SUPABASE',
  SUPABASE_ANON_KEY: 'REMPLACER_PAR_VOTRE_CLE_ANON_SUPABASE'
};
