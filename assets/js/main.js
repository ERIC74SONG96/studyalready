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
   reset password), on le redirige vers /espace-etudiant/ qui sait gérer
   ces tokens et l'envoie vers son dashboard.
   Couvre le cas où la "Site URL" Supabase ne pointe pas exactement vers
   l'espace étudiant. */
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
    /* Si on est déjà sur n'importe quelle page de l'espace étudiant
       (avec ou sans slash final, ou sous-page), on laisse les scripts
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
      menuBtn.addEventListener('click', function () { mobileMenu.classList.toggle('hidden'); });
      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () { mobileMenu.classList.add('hidden'); });
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
      formId: 'rejoindreReseauForm',
      statusId: 'rejoindreReseauStatus',
      formType: 'rejoindre-reseau',
      successMessage: 'Merci ! Vous êtes bien inscrit·e au réseau StudyAlready.'
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
      successMessage: 'Merci ! Votre demande de rapport est bien reçue. Réponse personnalisée sous 48 h.'
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

  (function injectFloatWhatsApp() {
    try {
      var p = (window.location.pathname || '').toLowerCase();
      if (p.indexOf('admin') !== -1) return;
      if (document.getElementById('saFloatWa')) return;
      var a = document.createElement('a');
      a.id = 'saFloatWa';
      a.href = 'https://wa.me/32465339448';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'sa-float-wa';
      a.setAttribute('aria-label', 'WhatsApp StudyAlready — réponse visée sous 2 heures ouvrées');
      a.title = 'WhatsApp — réponse visée sous 2 h (heures ouvrées)';
      a.innerHTML =
        '<span class="sa-float-wa__inner">' +
        '<span class="sa-float-wa__icon" aria-hidden="true">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
        '</span>' +
        '<span class="sa-float-wa__label">2 h</span>' +
        '</span>';
      document.body.appendChild(a);
    } catch (e) {}
  })();
});
