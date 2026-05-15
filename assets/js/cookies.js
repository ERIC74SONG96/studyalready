/**
 * StudyAlready — Bandeau cookies / consentement RGPD
 *
 * Approche minimaliste conforme RGPD/ePrivacy :
 *  - Affiche un bandeau au premier passage uniquement.
 *  - Choix mémorisé en localStorage (sa_cookie_consent).
 *  - 2 catégories :
 *      * essentiels : toujours actifs (Supabase auth, sécurité, formulaires).
 *      * mesure d'audience : OFF par défaut, activable si l'utilisateur consent.
 *        Aucun script externe n'est chargé tant que ce flag est false.
 *  - L'utilisateur peut rouvrir le panneau via window.openCookieSettings() ou un
 *    élément avec l'attribut data-cookie-settings.
 *
 * Pas de dépendance, fonctionne sans Tailwind (styles inline).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'sa_cookie_consent';
  var VERSION = 1;

  function safeGet() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || obj.v !== VERSION) return null;
      return obj;
    } catch (e) { return null; }
  }

  function safeSet(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }
    catch (e) { /* localStorage indisponible (mode privé strict) : on n'insiste pas */ }
  }

  function applyConsent(consent) {
    window.studyalreadyConsent = consent || { essential: true, analytics: false };
    /* Hook futur : si vous ajoutez Google Analytics ou Plausible, charger ici */
    /* uniquement si window.studyalreadyConsent.analytics === true.            */
    document.dispatchEvent(new CustomEvent('studyalready:consent', { detail: window.studyalreadyConsent }));
  }

  function bannerHTML() {
    return '' +
      '<div role="dialog" aria-label="Préférences cookies" aria-live="polite" ' +
            'style="position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;' +
                  'background:white;color:#0a2540;border:1px solid #e2e8f0;' +
                  'border-radius:14px;box-shadow:0 10px 30px rgba(10,37,64,.18);' +
                  'padding:16px 18px;max-width:780px;margin:0 auto;' +
                  'font-family:Inter,system-ui,Arial,sans-serif;font-size:14px;line-height:1.45">' +
        '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:260px">' +
            '<p style="margin:0 0 6px 0;font-weight:700;color:#0a2540">Vos préférences cookies</p>' +
            '<p style="margin:0;color:#475569">' +
              'Nous utilisons uniquement des cookies <strong>essentiels</strong> au fonctionnement du site ' +
              '(connexion sécurisée, envoi de formulaires). Aucun traceur publicitaire. ' +
              'En savoir plus : <a href="politique-cookies" style="color:#1e3a8a;text-decoration:underline;font-weight:600">politique cookies</a>.' +
            '</p>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
            '<button type="button" data-sa-cookie="reject" ' +
                    'style="background:white;color:#0a2540;border:1px solid #cbd5e1;' +
                          'border-radius:10px;padding:9px 14px;font-weight:600;cursor:pointer">' +
              'Refuser tout' +
            '</button>' +
            '<button type="button" data-sa-cookie="accept" ' +
                    'style="background:#0a2540;color:white;border:1px solid #0a2540;' +
                          'border-radius:10px;padding:9px 14px;font-weight:700;cursor:pointer">' +
              'Tout accepter' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function injectBanner() {
    if (document.getElementById('sa-cookie-banner')) return;
    var wrap = document.createElement('div');
    wrap.id = 'sa-cookie-banner';
    wrap.innerHTML = bannerHTML();
    document.body.appendChild(wrap);

    wrap.querySelector('[data-sa-cookie="accept"]').addEventListener('click', function () {
      saveAndClose({ essential: true, analytics: true });
    });
    wrap.querySelector('[data-sa-cookie="reject"]').addEventListener('click', function () {
      saveAndClose({ essential: true, analytics: false });
    });
  }

  function removeBanner() {
    var el = document.getElementById('sa-cookie-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function saveAndClose(consent) {
    var obj = {
      v: VERSION,
      essential: true,
      analytics: !!consent.analytics,
      ts: new Date().toISOString()
    };
    safeSet(obj);
    applyConsent(obj);
    removeBanner();
  }

  function openSettings() {
    var existing = safeGet();
    injectBanner();
    if (existing) {
      var banner = document.querySelector('#sa-cookie-banner [role="dialog"]');
      if (banner) {
        var note = document.createElement('p');
        note.style.cssText = 'margin:8px 0 0 0;color:#94a3b8;font-size:12px';
        note.textContent = 'Choix actuel : ' + (existing.analytics ? 'tout accepté' : 'cookies essentiels uniquement') +
          ' (' + new Date(existing.ts).toLocaleDateString('fr-BE') + ').';
        banner.appendChild(note);
      }
    }
  }

  /* Ajoute automatiquement un lien "Préférences cookies" dans tous les footers
     qui contiennent déjà un lien "Mentions légales" — évite d'éditer chaque HTML. */
  function injectFooterLink() {
    if (document.querySelector('[data-sa-cookie-link]')) return;
    var anchors = document.querySelectorAll('footer a');
    anchors.forEach(function (a) {
      var txt = (a.textContent || '').trim().toLowerCase();
      if (txt === 'mentions légales' || txt === 'mentions legales') {
        var sep = document.createTextNode(' · ');
        var link = document.createElement('a');
        link.href = '#';
        link.setAttribute('data-sa-cookie-link', '1');
        link.setAttribute('data-cookie-settings', '');
        link.className = a.className;
        link.textContent = 'Préférences cookies';
        link.addEventListener('click', function (e) { e.preventDefault(); openSettings(); });
        if (a.parentNode) {
          if (a.nextSibling) {
            a.parentNode.insertBefore(sep, a.nextSibling);
            a.parentNode.insertBefore(link, sep.nextSibling);
          } else {
            a.parentNode.appendChild(sep);
            a.parentNode.appendChild(link);
          }
        }
      }
    });
  }

  function init() {
    var existing = safeGet();
    if (existing) {
      applyConsent(existing);
    } else {
      applyConsent({ essential: true, analytics: false });
      injectBanner();
    }

    document.querySelectorAll('[data-cookie-settings]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openSettings();
      });
    });

    injectFooterLink();
  }

  window.openCookieSettings = openSettings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
