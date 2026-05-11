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
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') return;
  try {
    window.studyalreadySb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  } catch (e) {
    console.warn('StudyAlready Supabase init:', e);
  }
})();
