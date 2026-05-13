// ============================================================
// CONFIGURATION — STUDYALREADY
// ============================================================
// Tous les formulaires écrivent dans Supabase (cloud, région UE).
// Lecture du tableau de bord : https://supabase.com → Table Editor
// Tables utilisées :
//   - profiles           (créer-profil → annuaire)
//   - user_site_context  (lieu inscription Belgique/hors + persona — personnalisation)
//   - form_submissions   (tous les autres formulaires : contact,
//                         pré-qualification, réseau, mise en relation,
//                         rapport admission, voyage…)
//
// ⚠ Ne jamais coller ici la clé `service_role` (réservée au serveur).
// ============================================================

window.STUDYALREADY_CONFIG = {
  // Email affiché au public (mailto, fallback JS). La réception réelle des
  // formulaires PHP et des alertes Supabase reste sur studyalready8@gmail.com
  // (voir DESTINATAIRE dans php/ et NOTIFY_TO dans Supabase).
  CONTACT_EMAIL: 'contact@studyalready.com',

  // --- Supabase (cloud, projet UE) ---
  SUPABASE_URL: 'https://nevdhyekybmtvejhwhxz.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldmRoeWVreWJtdHZlamh3aHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA4MzUsImV4cCI6MjA5NDA4NjgzNX0.drps-e29P2HfISCRsqglnbsi3YjYqw3_jIj2F4WYBOc',

  // --- Affiliation voyage ---
  // Skyscanner (via TravelPayouts) : renseignez votre "associate ID"
  // quand il sera disponible. Laissez vide en attendant.
  SKYSCANNER_ASSOCIATE_ID: '',
  SKYSCANNER_MARKET: 'FR',
  SKYSCANNER_LOCALE: 'fr-FR',

  // Tarif indicatif du service "Chasseur de billets"
  CHASSEUR_BILLETS_TARIF_EUR: 30
};
