/**
 * Affiche les liens .sa-profile-nav si une session Supabase est présente dans localStorage
 * (même clé que le client espace-etudiant). Aucune dépendance à config.js.
 */
(function () {
  'use strict';

  function hasSaPersistedSession() {
    if (typeof localStorage === 'undefined') return false;
    try {
      var now = Math.floor(Date.now() / 1000);
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('sb-') !== 0 || k.indexOf('auth-token') === -1) continue;
        var raw = localStorage.getItem(k);
        if (!raw) continue;
        var obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') continue;
        var exp = obj.expires_at;
        var nested = obj.currentSession || obj.session;
        if (nested && typeof nested === 'object' && typeof nested.expires_at === 'number') {
          exp = nested.expires_at;
        }
        if (typeof exp === 'number' && exp > now - 120) return true;
        if (obj.access_token && (exp == null || exp > now - 120)) return true;
      }
    } catch (e) {}
    return false;
  }

  function refreshSaProfileNav() {
    var show = hasSaPersistedSession();
    try {
      document.querySelectorAll('.sa-profile-nav').forEach(function (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
      });
    } catch (e) {}
  }

  window.__saRefreshProfileNav = refreshSaProfileNav;

  function boot() {
    refreshSaProfileNav();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
