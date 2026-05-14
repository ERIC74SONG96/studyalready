/**
 * Initialise le client Supabase (global window.studyalreadySb) si la config est présente.
 * Charger après @supabase/supabase-js (UMD) et après assets/js/config.js
 */
(function () {
  'use strict';
  var c = window.STUDYALREADY_CONFIG;
  if (!c || !c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) return;
  if (String(c.SUPABASE_URL).indexOf('REMPLACER') !== -1) return;
  if (String(c.SUPABASE_ANON_KEY).indexOf('REMPLACER') !== -1) return;
  var root = window.supabase;
  var createClientFn = null;
  if (root && typeof root.createClient === 'function') createClientFn = root.createClient.bind(root);
  else if (typeof root === 'function') createClientFn = root;
  if (!createClientFn) {
    console.warn('StudyAlready: script Supabase chargé mais createClient introuvable (bloqueur de pub ?).');
    return;
  }
  try {
    window.studyalreadySb = createClientFn(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
      /* Même stockage de session que l’espace personnel : l’annuaire et les formulaires
         peuvent appeler des RPC « authentifiés » (JWT) quand l’utilisateur est déjà connecté. */
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch (e) {
    console.warn('StudyAlready Supabase init:', e);
  }
})();
