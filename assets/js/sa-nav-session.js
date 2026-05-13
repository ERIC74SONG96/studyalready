/**
 * Insère le lien « Mon profil » uniquement si une session Supabase valide
 * est présente dans localStorage (après connexion). Aucun libellé dans le HTML statique.
 */
(function () {
  'use strict';

  function jwtExp(accessToken) {
    try {
      var p = String(accessToken).split('.')[1];
      if (!p) return null;
      var b = p.replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      var payload = JSON.parse(atob(b));
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch (e) {
      return null;
    }
  }

  function hasSaPersistedSession() {
    if (typeof localStorage === 'undefined') return false;
    var now = Math.floor(Date.now() / 1000);
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('sb-') !== 0 || k.indexOf('auth-token') === -1) continue;
        var raw = localStorage.getItem(k);
        if (!raw) continue;
        var obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') continue;
        var nested = obj.currentSession || obj.session;
        var token = (nested && nested.access_token) || obj.access_token;
        var exp = typeof obj.expires_at === 'number' ? obj.expires_at : null;
        if (nested && typeof nested.expires_at === 'number') exp = nested.expires_at;
        if ((exp == null || exp <= now) && token) {
          var jexp = jwtExp(token);
          if (typeof jexp === 'number') exp = jexp;
        }
        if (typeof exp === 'number' && exp > now - 120) return true;
      }
    } catch (e) {}
    return false;
  }

  function buildLinkHtml(href, variant) {
    var h = String(href || '');
    if (variant === 'mobile') {
      return (
        '<a href="' + h +
        '" class="block py-2 border-t border-slate-100 font-semibold text-brand-dark">Mon profil</a>'
      );
    }
    if (variant === 'compact') {
      return (
        '<a href="' + h +
        '" class="text-sm font-semibold text-brand-dark hover:underline">Mon profil</a>'
      );
    }
    return (
      '<a href="' + h +
      '" class="inline-flex items-center gap-2 rounded-full border border-brand-dark bg-white px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-cream transition" title="Ouvrir mon tableau de bord">Mon profil</a>'
    );
  }

  function refreshSaProfileNav() {
    var show = hasSaPersistedSession();
    try {
      document.querySelectorAll('[data-sa-profile-slot]').forEach(function (slot) {
        var href = slot.getAttribute('data-sa-dashboard-href');
        if (!href) return;
        var variant = slot.getAttribute('data-sa-profile-variant') || 'desktop';
        if (show) {
          slot.innerHTML = buildLinkHtml(href, variant);
          if (variant === 'desktop') {
            slot.className = 'lg:flex items-center';
          } else if (variant === 'mobile') {
            slot.className = '';
          } else if (variant === 'compact') {
            slot.className = '';
          } else {
            slot.className = '';
          }
        } else {
          slot.innerHTML = '';
          slot.className = 'hidden';
        }
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
