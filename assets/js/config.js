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
  CONTACT_EMAIL: 'studyalready8@gmail.com',

  // --- Espace étudiant (Supabase Auth) : https://supabase.com ---
  // Dashboard projet → Settings → API : Project URL + anon public key
  // Ne jamais mettre la clé "service_role" ici (réservée au serveur).
  // Projet Supabase (région EU recommandée dans le dashboard)
  SUPABASE_URL: 'https://nevdhyekybmtvejhwhxz.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldmRoeWVreWJtdHZlamh3aHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA4MzUsImV4cCI6MjA5NDA4NjgzNX0.drps-e29P2HfISCRsqglnbsi3YjYqw3_jIj2F4WYBOc',

  // --- Affiliation voyage ---
  // Skyscanner : inscription via TravelPayouts (https://www.travelpayouts.com/)
  // ou directement Skyscanner Partners. Renseignez votre "associate ID"
  // ci-dessous quand il sera disponible. Laissez vide en attendant.
  SKYSCANNER_ASSOCIATE_ID: '',
  SKYSCANNER_MARKET: 'FR', // Marché Skyscanner (FR, BE…)
  SKYSCANNER_LOCALE: 'fr-FR', // Langue

  // Tarif indicatif du service "Chasseur de billets"
  CHASSEUR_BILLETS_TARIF_EUR: 30
};
