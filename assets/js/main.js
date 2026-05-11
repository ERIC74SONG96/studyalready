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

  var fadeEls = document.querySelectorAll('section h2, section .grid > *');
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealAll() { fadeEls.forEach(function (el) { el.classList.add('fade-in', 'visible'); }); }

  if (fadeEls.length === 0) {}
  else if (prefersReducedMotion) {}
  else if ('IntersectionObserver' in window) {
    fadeEls.forEach(function (el) { el.classList.add('fade-in'); });
    try {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0, rootMargin: '0px 0px 8% 0px' });
      fadeEls.forEach(function (el) { observer.observe(el); });
      window.setTimeout(function () {
        fadeEls.forEach(function (el) {
          if (el.classList.contains('fade-in') && !el.classList.contains('visible')) el.classList.add('visible');
        });
      }, 4000);
    } catch (e) { revealAll(); }
  } else { revealAll(); }

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
