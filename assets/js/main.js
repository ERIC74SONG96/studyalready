/* Force l’URL canonique : le certificat et le déploiement Vercel sont sur www. */
(function enforceCanonicalHost() {
  try {
    if (window.location.hostname === 'studyalready.com') {
      window.location.replace(
        'https://www.studyalready.com' +
        window.location.pathname +
        window.location.search +
        window.location.hash
      );
    }
  } catch (e) {}
})();

/* Filet de sécurité : si un utilisateur arrive sur n'importe quelle page
   avec un token Supabase dans l'URL (confirmation email, magic link,
   reset password), on le redirige vers /espace-etudiant/ qui gère la
   session puis renvoie vers l'accueil (l'utilisateur ouvre son tableau
   de bord via « Mon profil »).
   Couvre le cas où la "Site URL" Supabase ne pointe pas exactement vers
   l'espace personnel (/espace-etudiant/). */
(function handleSupabaseAuthCallback() {
  try {
    var hash = window.location.hash || '';
    var search = window.location.search || '';
    var hasToken = hash.indexOf('access_token=') !== -1 ||
                   hash.indexOf('type=signup') !== -1 ||
                   hash.indexOf('type=recovery') !== -1 ||
                   hash.indexOf('type=magiclink') !== -1 ||
                   hash.indexOf('error_description=') !== -1 ||
                   search.indexOf('code=') !== -1;
    if (!hasToken) return;
    /* Si on est déjà sur n'importe quelle page de l'espace personnel
       (/espace-etudiant/, avec ou sans slash final, ou sous-page), on laisse les scripts
       de cet espace gérer le token. On évite ainsi toute boucle de
       redirection entre /espace-etudiant et /espace-etudiant/. */
    var p = window.location.pathname || '';
    if (p === '/espace-etudiant' ||
        p === '/espace-etudiant/' ||
        p.indexOf('/espace-etudiant/') === 0) return;
    /* Sinon, on redirige en conservant le hash (token) pour que la page
       d'atterrissage puisse créer la session. */
    window.location.replace('/espace-etudiant/' + hash + search);
  } catch (e) {}
})();

/* PWA : ajoute le manifest et installe le service worker quand le contexte est sûr. */
(function setupPwa() {
  try {
    if (!document.querySelector('link[rel="manifest"]')) {
      var manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.webmanifest';
      document.head.appendChild(manifest);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      var theme = document.createElement('meta');
      theme.name = 'theme-color';
      theme.content = '#0a2540';
      document.head.appendChild(theme);
    }
    if (!('serviceWorker' in navigator)) return;
    var host = window.location.hostname;
    var secure = window.location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1';
    if (!secure) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  } catch (e) {}
})();

/* Navigation plus rapide : précharge les pages publiques internes au survol,
   au focus et pendant les temps morts. Les pages sensibles restent exclues. */
(function setupFastNavigation() {
  try {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;

    var prefetched = {};
    var maxIdlePrefetches = 10;

    function isSensitivePath(pathname) {
      return pathname.indexOf('/admin') === 0 ||
        pathname.indexOf('/dashboard') === 0 ||
        pathname.indexOf('/espace-etudiant') === 0 ||
        pathname.indexOf('/php/') === 0;
    }

    function cleanUrl(href) {
      if (!href || href.charAt(0) === '#') return '';
      var u = new URL(href, window.location.href);
      if (u.origin !== window.location.origin) return '';
      if (isSensitivePath(u.pathname)) return '';
      if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|css|js|mjs|json|xml|txt|webmanifest)$/i.test(u.pathname)) return '';
      u.hash = '';
      return u.href;
    }

    function prefetchUrl(url) {
      if (!url || prefetched[url]) return;
      prefetched[url] = true;

      var link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = url;
      document.head.appendChild(link);

      if (window.fetch) {
        try {
          fetch(url, { credentials: 'same-origin', cache: 'force-cache', priority: 'low' }).catch(function () {});
        } catch (_e) {}
      }
    }

    function prefetchLink(link) {
      if (!link || link.target || link.hasAttribute('download')) return;
      prefetchUrl(cleanUrl(link.getAttribute('href')));
    }

    ['pointerenter', 'focusin', 'touchstart'].forEach(function (eventName) {
      document.addEventListener(eventName, function (ev) {
        var link = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
        prefetchLink(link);
      }, { passive: true, capture: true });
    });

    function idlePrefetch() {
      var links = Array.prototype.slice.call(document.querySelectorAll('header a[href], nav a[href], footer a[href], main a[href]'));
      var count = 0;
      links.some(function (link) {
        var url = cleanUrl(link.getAttribute('href'));
        if (!url || prefetched[url]) return false;
        prefetchUrl(url);
        count += 1;
        return count >= maxIdlePrefetches;
      });
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(idlePrefetch, { timeout: 2500 });
    } else {
      window.setTimeout(idlePrefetch, 1800);
    }
  } catch (e) {}
})();

/* Charge dynamiquement les scripts globaux (cookies RGPD, liens sociaux footer) */
(function loadGlobalScripts() {
  if (window.studyalreadyGlobalLoaded) return;
  window.studyalreadyGlobalLoaded = true;
  /* Trouve le chemin relatif vers assets/js/ en se basant sur le script main.js déjà chargé. */
  var base = '';
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src || '';
    var m = src.match(/(.*\/assets\/js\/)main\.js(?:\?.*)?$/);
    if (m) { base = m[1]; break; }
  }
  if (!base) base = 'assets/js/';
  ['cookies.js', 'social-links.js'].forEach(function (file) {
    var s = document.createElement('script');
    s.src = base + file;
    s.async = true;
    document.head.appendChild(s);
  });
})();

document.addEventListener('DOMContentLoaded', function () {
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var contactService = document.getElementById('contactService');
  if (contactService && typeof URLSearchParams !== 'undefined') {
    var sp = new URLSearchParams(window.location.search);
    var svc = sp.get('service');
    if (svc) {
      for (var i = 0; i < contactService.options.length; i++) {
        if (contactService.options[i].value === svc) {
          contactService.selectedIndex = i;
          break;
        }
      }
      if (window.location.hash === '#contact') {
        var contactSection = document.getElementById('contact');
        if (contactSection) contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  if (!document.getElementById('site-header')) {
    var menuBtn = document.getElementById('mobileMenuBtn');
    var mobileMenu = document.getElementById('mobileMenu');
    if (menuBtn && mobileMenu) {
      var setMenuOpen = function (isOpen) {
        mobileMenu.classList.toggle('hidden', !isOpen);
        menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      };
      setMenuOpen(!mobileMenu.classList.contains('hidden'));
      menuBtn.addEventListener('click', function () {
        setMenuOpen(mobileMenu.classList.contains('hidden'));
      });
      mobileMenu.addEventListener('click', function (ev) {
        if (ev.target.closest('a')) setMenuOpen(false);
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') setMenuOpen(false);
      });
      document.addEventListener('click', function (ev) {
        if (mobileMenu.classList.contains('hidden')) return;
        if (mobileMenu.contains(ev.target) || menuBtn.contains(ev.target)) return;
        setMenuOpen(false);
      });
    }
  }

  var header = document.getElementById('header');
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 20) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Animation légère au scroll : ne pas cibler les sections .no-scroll-fade ni leur contenu. */
  var fadeEls = document.querySelectorAll(
    'section:not(.no-scroll-fade) h2, section:not(.no-scroll-fade) .grid > *'
  );
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealAllFadeTargets() {
    fadeEls.forEach(function (el) {
      el.classList.add('fade-in', 'visible');
    });
  }

  function revealAnyStragglerFadeIns() {
    document.querySelectorAll('.fade-in:not(.visible)').forEach(function (el) {
      el.classList.add('visible');
    });
  }

  if (fadeEls.length === 0) {
    /* pas d'éléments à animer */
  } else if (prefersReducedMotion) {
    revealAllFadeTargets();
  } else if ('IntersectionObserver' in window) {
    fadeEls.forEach(function (el) {
      el.classList.add('fade-in');
    });
    try {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.01, rootMargin: '0px 0px 35% 0px' }
      );
      fadeEls.forEach(function (el) {
        observer.observe(el);
      });
      /* Sécurité : ne jamais laisser du contenu en opacity:0 si l'observer ne s'est pas déclenché (viewport, scroll, etc.) */
      window.setTimeout(revealAnyStragglerFadeIns, 1200);
      window.setTimeout(revealAnyStragglerFadeIns, 4500);
    } catch (e) {
      revealAllFadeTargets();
    }
  } else {
    revealAllFadeTargets();
  }

  /* Tous les formulaires « email » passent désormais par Supabase (table form_submissions).
     « Créer mon profil » a son propre handler (table profiles, validation manuelle). */
  var SA = window.StudyAlreadyForms;
  if (SA && typeof SA.bind === 'function') {
    SA.bind({
      formId: 'contactForm',
      statusId: 'formStatus',
      formType: 'contact',
      successMessage: 'Merci ! Votre message est bien arrivé. Réponse sous 48 h.'
    });
    SA.bind({
      formId: 'prequalificationForm',
      statusId: 'prequalificationStatus',
      formType: 'prequalification',
      successMessage: 'Merci ! Votre pré-qualification est enregistrée. Réponse sous 48 h ouvrées.'
    });
    SA.bind({
      formId: 'miseEnRelationForm',
      statusId: 'miseEnRelationStatus',
      formType: 'mise-en-relation',
      successMessage: 'Merci ! Votre message a été transmis. Le membre vous répondra s’il le souhaite.'
    });
    SA.bind({
      formId: 'rapportAdmissionForm',
      statusId: 'rapportAdmissionStatus',
      formType: 'rapport-admission',
      successMessage: 'Accusé de réception instantané : votre demande de rapport est bien enregistrée. Un conseiller StudyAlready revient vers vous sous 48 h.'
    });
    SA.bind({
      formId: 'chasseurBilletForm',
      statusId: 'chasseurBilletStatus',
      formType: 'chasseur-billet',
      successMessage: 'Merci ! Votre demande de devis Chasseur de billets est bien reçue. Réponse sous 48 h.'
    });
    SA.bind({
      formId: 'departsGroupesForm',
      statusId: 'departsGroupesStatus',
      formType: 'departs-groupes',
      successMessage: 'Merci ! Vous êtes signalé·e pour ce départ groupé. On revient vers vous dès que d’autres étudiants confirment leur date.'
    });
  }

  (function injectFloatEmail() {
    try {
      var p = (window.location.pathname || '').toLowerCase();
      if (p.indexOf('admin') !== -1) return;
      if (document.getElementById('saFloatEmail')) return;
      if (document.querySelector('a[href^="mailto:contact@studyalready.com"][class*="fixed"]')) return;
      var a = document.createElement('a');
      a.id = 'saFloatEmail';
      a.href = 'mailto:contact@studyalready.com';
      a.className = 'sa-float-wa';
      a.setAttribute('aria-label', 'Écrire à StudyAlready par e-mail');
      a.title = 'contact@studyalready.com';
      a.innerHTML =
        '<span class="sa-float-wa__inner">' +
        '<span class="sa-float-wa__icon" aria-hidden="true">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>' +
        '</span>' +
        '<span class="sa-float-wa__label">@</span>' +
        '</span>';
      document.body.appendChild(a);
    } catch (e) {}
  })();
});
