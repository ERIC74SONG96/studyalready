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
});
