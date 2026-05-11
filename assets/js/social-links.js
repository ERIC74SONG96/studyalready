/**
 * StudyAlready — Injection automatique des liens sociaux dans les footers.
 *
 * Évite d'éditer une vingtaine de fichiers HTML pour ajouter une icône.
 * Réutilise le pattern de cookies.js : on cherche dans tous les <footer>
 * un lien "Mentions légales" et on insère un bouton Facebook au-dessus.
 *
 * Pour ajouter d'autres réseaux plus tard, complétez le tableau SOCIALS.
 */
(function () {
  'use strict';

  var SOCIALS = [
    {
      key: 'facebook',
      url: 'https://www.facebook.com/profile.php?id=61589453766633',
      label: 'StudyAlready sur Facebook',
      svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8.5h2.86l.43-3.32H13.5V8.06c0-.96.27-1.61 1.64-1.61h1.76V3.48a23.5 23.5 0 0 0-2.57-.13c-2.54 0-4.28 1.55-4.28 4.4v2.46H7.18v3.32h2.87V22h3.45z"/></svg>'
    },
    {
      key: 'instagram',
      url: 'https://www.instagram.com/studyalready/',
      label: 'StudyAlready sur Instagram',
      svg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>'
    }
  ];

  function buildButton(s) {
    var a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', s.label);
    a.setAttribute('data-sa-social', s.key);
    a.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;' +
      'width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);' +
      'color:#f5b800;transition:background .2s, color .2s;text-decoration:none';
    a.innerHTML = s.svg;
    a.addEventListener('mouseenter', function () {
      a.style.background = '#f5b800';
      a.style.color = '#0a2540';
    });
    a.addEventListener('mouseleave', function () {
      a.style.background = 'rgba(255,255,255,.08)';
      a.style.color = '#f5b800';
    });
    return a;
  }

  function buildContainer() {
    var wrap = document.createElement('div');
    wrap.setAttribute('data-sa-social-bar', '1');
    wrap.style.cssText = 'display:flex;justify-content:center;gap:10px;' +
      'margin:0 0 14px 0;padding:0';
    SOCIALS.forEach(function (s) { wrap.appendChild(buildButton(s)); });
    return wrap;
  }

  function findInsertionTarget(footer) {
    /* On cherche la première barre de liens en haut du footer
       (celle qui contient typiquement "Accueil · Communauté · Mentions légales") */
    var links = footer.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      var t = (links[i].textContent || '').trim().toLowerCase();
      if (t === 'mentions légales' || t === 'mentions legales' || t === 'accueil') {
        var parent = links[i].parentElement;
        if (parent) return parent;
      }
    }
    return null;
  }

  function injectAll() {
    if (document.querySelector('[data-sa-social-bar]')) return;
    var footers = document.querySelectorAll('footer');
    footers.forEach(function (footer) {
      var target = findInsertionTarget(footer);
      if (!target) return;
      var bar = buildContainer();
      target.parentNode.insertBefore(bar, target);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAll);
  } else {
    injectAll();
  }
})();
