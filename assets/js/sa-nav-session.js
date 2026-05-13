/**
 * Insère le lien profil uniquement si une session Supabase valide est présente
 * dans localStorage. Le libellé affiche le pseudo / prénom (métadonnées) ou
 * l’identifiant avant @ de l’e-mail — pas de texte « Mon profil » dans le HTML statique.
 */
(function () {
  'use strict';

  function jwtPayload(accessToken) {
    try {
      var p = String(accessToken).split('.')[1];
      if (!p) return null;
      var b = p.replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      return JSON.parse(atob(b));
    } catch (e) {
      return null;
    }
  }

  function jwtExp(accessToken) {
    var payload = jwtPayload(accessToken);
    return typeof payload.exp === 'number' ? payload.exp : null;
  }

  /** @returns {{ user: object|null, access_token: string|null }|null} */
  function getPersistedSupabaseAuth() {
    if (typeof localStorage === 'undefined') return null;
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
        if (typeof exp === 'number' && exp > now - 120) {
          var user = (nested && nested.user) || obj.user || null;
          return { user: user, access_token: token || null };
        }
      }
    } catch (e) {}
    return null;
  }

  function hasSaPersistedSession() {
    return getPersistedSupabaseAuth() != null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function truncateNavLabel(name, maxLen) {
    var n = String(name || '').trim();
    var m = typeof maxLen === 'number' ? maxLen : 26;
    if (n.length <= m) return n;
    return n.slice(0, Math.max(1, m - 1)) + '…';
  }

  function navLabelFromAuth(auth) {
    if (!auth) return 'Membre';
    var user = auth.user;
    var um = (user && user.user_metadata) || {};
    var fromMeta = (um.pseudo || um.full_name || um.name || um.preferred_username || '').trim();
    if (fromMeta) return truncateNavLabel(fromMeta);
    var em = (user && user.email) || '';
    if (em && em.indexOf('@') !== -1) return truncateNavLabel(em.split('@')[0]);
    var pl = auth.access_token ? jwtPayload(auth.access_token) : null;
    if (pl && pl.email && String(pl.email).indexOf('@') !== -1) {
      return truncateNavLabel(String(pl.email).split('@')[0]);
    }
    return 'Membre';
  }

  function buildLinkHtml(href, variant, displayLabel) {
    var h = String(href || '');
    var label = escapeHtml(displayLabel || 'Membre');
    var title = escapeAttr('Tableau de bord — ' + String(displayLabel || '').trim());
    if (variant === 'mobile') {
      return (
        '<a href="' +
        h +
        '" class="block py-2 border-t border-slate-100 font-semibold text-brand-dark" title="' +
        title +
        '">' +
        label +
        '</a>'
      );
    }
    if (variant === 'compact') {
      return (
        '<a href="' +
        h +
        '" class="text-sm font-semibold text-brand-dark hover:underline" title="' +
        title +
        '">' +
        label +
        '</a>'
      );
    }
    return (
      '<a href="' +
      h +
      '" class="inline-flex items-center gap-2 rounded-full border border-brand-dark bg-white px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-cream transition max-w-[12rem] sm:max-w-[14rem]" title="' +
      title +
      '"><span class="truncate">' +
      label +
      '</span></a>'
    );
  }

  function refreshSaProfileNav() {
    var auth = getPersistedSupabaseAuth();
    var show = auth != null;
    var displayLabel = show ? navLabelFromAuth(auth) : '';
    try {
      document.querySelectorAll('.sa-espace-nav-link').forEach(function (el) {
        if (show) el.classList.add('hidden');
        else el.classList.remove('hidden');
      });
      document.querySelectorAll('[data-sa-profile-slot]').forEach(function (slot) {
        var href = slot.getAttribute('data-sa-dashboard-href');
        if (!href) return;
        var variant = slot.getAttribute('data-sa-profile-variant') || 'desktop';
        if (show) {
          slot.innerHTML = buildLinkHtml(href, variant, displayLabel);
          if (variant === 'desktop') {
            slot.className = 'lg:flex items-center min-w-0';
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

  window.__saHasPersistedSession = hasSaPersistedSession;
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
