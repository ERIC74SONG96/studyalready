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
