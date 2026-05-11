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

  var menuBtn = document.getElementById('mobileMenuBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () { mobileMenu.classList.toggle('hidden'); });
    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { mobileMenu.classList.add('hidden'); });
    });
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

  var WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

  function bindWeb3Form(form, statusEl, successMessage, subjectPrefix) {
    if (!form || !statusEl) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      statusEl.classList.remove('hidden', 'text-red-600', 'text-green-600', 'text-amber-700');
      statusEl.classList.add('text-slate-600');
      statusEl.textContent = 'Envoi en cours...';

      var cfg = window.STUDYALREADY_CONFIG || {};
      var key = cfg.WEB3FORMS_ACCESS_KEY;

      if (!key || key === 'REMPLACER_PAR_VOTRE_CLE') {
        statusEl.textContent = 'Formulaire non configure (cle Web3Forms manquante). Ecrivez-nous sur WhatsApp.';
        statusEl.classList.remove('text-slate-600');
        statusEl.classList.add('text-amber-700');
        return;
      }

      sendForm(form, statusEl, key, subjectPrefix, successMessage);
    });
  }

  function sendForm(form, statusEl, key, subjectPrefix, successMessage) {
    var formData = new FormData(form);
    formData.set('access_key', key);
    if (subjectPrefix && !formData.get('subject')) {
      var who = formData.get('nom') || formData.get('nom_complet') || 'visiteur';
      formData.set('subject', subjectPrefix + ' - ' + who);
    }
    if (!formData.get('from_name')) formData.set('from_name', 'StudyAlready');
    formData.set('botcheck', '');
    submitWeb3(formData, statusEl, form, successMessage);
  }

  function submitWeb3(formData, statusEl, form, successMessage) {
    var opts = { method: 'POST', body: formData };
    opts.headers = { Accept: 'application/json' };
    fetch(WEB3FORMS_ENDPOINT, opts).then(function (resp) {
      return resp.json().then(function (d) { return { ok: resp.ok, data: d }; });
    }).then(function (r) {
      handleResponse(r, statusEl, form, successMessage);
    }).catch(function (err) {
      handleError(err, statusEl);
    });
  }

  function handleResponse(r, statusEl, form, successMessage) {
    if (r.ok && r.data && r.data.success) {
      statusEl.textContent = successMessage;
      statusEl.classList.remove('text-slate-600', 'text-amber-700');
      statusEl.classList.add('text-green-600');
      form.reset();
    } else {
      var msg = (r.data && r.data.message) ? r.data.message : 'Envoi non confirme.';
      handleError(new Error(msg), statusEl);
    }
  }

  function handleError(err, statusEl) {
    statusEl.textContent = (err && err.message) ? err.message : 'Erreur lors de l envoi.';
    statusEl.classList.remove('text-slate-600', 'text-amber-700');
    statusEl.classList.add('text-red-600');
  }

  bindWeb3Form(
    document.getElementById('contactForm'),
    document.getElementById('formStatus'),
    'Merci ! Votre message a bien ete envoye. Reponse sous 48 h.',
    '[StudyAlready] Contact'
  );

  bindWeb3Form(
    document.getElementById('prequalificationForm'),
    document.getElementById('prequalificationStatus'),
    'Merci ! Votre pre-qualification a bien ete envoyee. Reponse sous 48 h ouvrees.',
    '[StudyAlready] Pre-qualification'
  );
});
