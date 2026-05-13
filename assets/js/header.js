(function () {
  'use strict';

  // Détection du préfixe selon l'emplacement de la page (racine vs sous-dossiers).
  var path = (window.location && window.location.pathname) || '';
  var inSub = /\/(blog|espace-etudiant)\//i.test(path);
  var P = inSub ? '../' : '';

  function link(href, label, extraClass) {
    return '<a href="' + href + '" class="' + (extraClass || '') + '">' + label + '</a>';
  }

  /* En-tête réduit pour rejoindre-reseau.html quand vue=communaute (sessionStorage sa_espace_vue). */
  var minimalRejoindreHeaderHTML =
    '<nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">' +
      '<span class="flex items-center gap-2 min-w-0">' +
        '<span class="inline-flex w-9 h-9 rounded-lg bg-brand-dark items-center justify-center shrink-0"><span class="text-brand-gold font-bold text-sm font-display">SA</span></span>' +
        '<span class="font-display font-bold text-lg text-brand-dark truncate">StudyAlready <span class="text-slate-500 font-semibold text-sm">· Communauté</span></span>' +
      '</span>' +
      '<span class="flex items-center gap-3 shrink-0">' +
        '<a href="' + P + 'espace-etudiant/dashboard.html" class="sa-profile-nav hidden text-sm font-semibold text-brand-dark hover:underline">Mon profil</a>' +
        '<a href="' + P + 'espace-etudiant/" class="text-sm font-semibold text-brand-blue hover:underline">Mon espace</a>' +
      '</span>' +
    '</nav>';

  var headerHTML =
    '<nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">' +
      '<a href="' + P + 'index.html" class="flex items-center gap-2">' +
        '<div class="w-9 h-9 rounded-lg bg-brand-dark flex items-center justify-center"><span class="text-brand-gold font-bold text-sm font-display">SA</span></div>' +
        '<span class="font-display font-bold text-lg text-brand-dark">Study<span class="text-brand-gold">Already</span></span>' +
      '</a>' +

      '<ul class="hidden lg:flex items-center gap-6 text-sm font-medium">' +
        '<li>' + link(P + 'index.html', 'Accueil', 'hover:text-brand-gold transition') + '</li>' +
        '<li>' + link(P + 'qui-sommes-nous.html', 'Qui sommes-nous ?', 'hover:text-brand-gold transition') + '</li>' +
        '<li>' + link(P + 'equivalence.html', 'Équivalence', 'hover:text-brand-gold transition') + '</li>' +

        '<li class="relative group">' +
          '<button type="button" aria-haspopup="true" class="hover:text-brand-gold transition inline-flex items-center gap-1">' +
            'Services' +
            '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
          '</button>' +
          '<div class="hidden group-hover:block group-focus-within:block absolute top-full left-0 pt-3 z-50">' +
            '<div class="w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2">' +
              link(P + 'tarifs-packs.html', 'Tarifs &amp; packs', 'block px-4 py-2 hover:bg-brand-cream text-brand-dark font-semibold') +
              link(P + 'analyseur-admission.html', 'Analyseur d\'admission', 'block px-4 py-2 hover:bg-amber-50 text-amber-800 font-semibold') +
              link(P + 'notre-dossier-fwb.html', 'Notre dossier FWB', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'inscription-universitaire.html', 'Inscription universitaire', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'compte-bloque.html', 'Compte bloqué', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'assurance-visa.html', 'Assurance visa &amp; santé', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'logement-etudiant.html', 'Logement étudiant', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'pack-accueil.html', 'Pack accueil', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'preparer-voyage.html', 'Préparer mon voyage', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'services-bancaires.html', 'Assistance bancaire', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'accelerateur-job.html', 'Accélérateur de Job', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'prequalification-dossier.html', 'Pré-qualification détaillée', 'block px-4 py-2 hover:bg-slate-50 text-brand-dark font-semibold border-t border-slate-100 mt-1') +
            '</div>' +
          '</div>' +
        '</li>' +

        '<li class="relative group">' +
          '<button type="button" aria-haspopup="true" class="hover:text-brand-gold transition inline-flex items-center gap-1">' +
            'Communauté' +
            '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
          '</button>' +
          '<div class="hidden group-hover:block group-focus-within:block absolute top-full left-0 pt-3 z-50">' +
            '<div class="w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2">' +
              link(P + 'communaute.html', 'Vision &amp; deux parcours', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'annuaire.html', 'Annuaire des membres', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'besoin-d-aide.html', 'Besoin d\'aide ?', 'block px-4 py-2 hover:bg-amber-50 text-amber-800 font-semibold') +
              link(P + 'evenements-seminaires.html', 'Événements &amp; séminaires', 'block px-4 py-2 hover:bg-slate-50') +
              link(P + 'rejoindre-reseau.html', 'Rejoindre le réseau', 'block px-4 py-2 hover:bg-slate-50 text-brand-dark font-semibold border-t border-slate-100 mt-1') +
              link(P + 'creer-profil.html', 'Créer mon profil public', 'block px-4 py-2 hover:bg-slate-50') +
            '</div>' +
          '</div>' +
        '</li>' +

        '<li>' + link(P + 'blog/', 'Blog', 'hover:text-brand-gold transition') + '</li>' +
        '<li>' + link(P + 'espace-etudiant/', 'Mon espace', 'hover:text-brand-gold transition') + '</li>' +
        '<li class="sa-profile-nav hidden lg:flex items-center">' +
          '<a href="' + P + 'espace-etudiant/dashboard.html" class="inline-flex items-center gap-2 rounded-full border border-brand-dark bg-white px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-cream transition" title="Ouvrir mon tableau de bord">Mon profil</a>' +
        '</li>' +
      '</ul>' +

      '<a href="' + P + 'index.html#contact" class="hidden sm:inline-flex items-center gap-2 bg-brand-gold hover:bg-yellow-500 text-brand-dark font-semibold px-5 py-2.5 rounded-full text-sm transition shadow-sm">' +
        'Contact' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>' +
      '</a>' +

      '<button id="mobileMenuBtn" class="lg:hidden text-brand-dark" aria-label="Menu">' +
        '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>' +
      '</button>' +
    '</nav>' +

    '<div id="mobileMenu" class="hidden lg:hidden bg-white border-t border-slate-200 px-4 py-3 text-sm font-medium max-h-[80vh] overflow-y-auto">' +
      '<a href="' + P + 'index.html" class="block py-2">Accueil</a>' +
      '<a href="' + P + 'qui-sommes-nous.html" class="block py-2">Qui sommes-nous ?</a>' +
      '<a href="' + P + 'equivalence.html" class="block py-2">Équivalence (guide)</a>' +

      '<details class="border-t border-slate-100 mt-1">' +
        '<summary class="py-2 cursor-pointer list-none flex items-center justify-between">' +
          'Services' +
          '<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
        '</summary>' +
        '<div class="pl-3 pb-2 space-y-1 text-slate-600">' +
          '<a href="' + P + 'tarifs-packs.html" class="block py-1.5 text-brand-dark font-semibold">Tarifs &amp; packs</a>' +
          '<a href="' + P + 'analyseur-admission.html" class="block py-1.5 text-amber-800 font-semibold">Analyseur d\'admission</a>' +
          '<a href="' + P + 'notre-dossier-fwb.html" class="block py-1.5">Notre dossier FWB</a>' +
          '<a href="' + P + 'inscription-universitaire.html" class="block py-1.5">Inscription universitaire</a>' +
          '<a href="' + P + 'compte-bloque.html" class="block py-1.5">Compte bloqué</a>' +
          '<a href="' + P + 'assurance-visa.html" class="block py-1.5">Assurance visa &amp; santé</a>' +
          '<a href="' + P + 'logement-etudiant.html" class="block py-1.5">Logement étudiant</a>' +
          '<a href="' + P + 'pack-accueil.html" class="block py-1.5">Pack accueil</a>' +
          '<a href="' + P + 'preparer-voyage.html" class="block py-1.5">Préparer mon voyage</a>' +
          '<a href="' + P + 'services-bancaires.html" class="block py-1.5">Assistance bancaire</a>' +
          '<a href="' + P + 'accelerateur-job.html" class="block py-1.5">Accélérateur de Job</a>' +
          '<a href="' + P + 'prequalification-dossier.html" class="block py-1.5 text-brand-dark font-semibold">Pré-qualification détaillée</a>' +
        '</div>' +
      '</details>' +

      '<details class="border-t border-slate-100">' +
        '<summary class="py-2 cursor-pointer list-none flex items-center justify-between">' +
          'Communauté' +
          '<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
        '</summary>' +
        '<div class="pl-3 pb-2 space-y-1 text-slate-600">' +
          '<a href="' + P + 'communaute.html" class="block py-1.5">Vision &amp; deux parcours</a>' +
          '<a href="' + P + 'annuaire.html" class="block py-1.5">Annuaire des membres</a>' +
          '<a href="' + P + 'besoin-d-aide.html" class="block py-1.5 text-amber-800 font-semibold">Besoin d\'aide ?</a>' +
          '<a href="' + P + 'evenements-seminaires.html" class="block py-1.5">Événements &amp; séminaires</a>' +
          '<a href="' + P + 'rejoindre-reseau.html" class="block py-1.5 text-brand-gold font-semibold">Rejoindre le réseau</a>' +
          '<a href="' + P + 'creer-profil.html" class="block py-1.5">Créer mon profil public</a>' +
        '</div>' +
      '</details>' +

      '<a href="' + P + 'blog/" class="block py-2 border-t border-slate-100">Blog</a>' +
      '<a href="' + P + 'espace-etudiant/" class="block py-2 border-t border-slate-100">Espace personnel</a>' +
      '<a href="' + P + 'espace-etudiant/dashboard.html" class="sa-profile-nav hidden block py-2 border-t border-slate-100 font-semibold text-brand-dark">Mon profil</a>' +
      '<a href="' + P + 'index.html#contact" class="block py-3 border-t border-slate-100 text-brand-gold font-semibold">Contact →</a>' +
    '</div>';

  function init() {
    var host = document.getElementById('site-header');
    if (!host) return;
    var path = (window.location && window.location.pathname) || '';
    var isRejoindre = /rejoindre-reseau\.html/i.test(path);
    var communauteChrome = false;
    try {
      communauteChrome = isRejoindre && sessionStorage.getItem('sa_espace_vue') === 'communaute';
    } catch (e) {}
    host.innerHTML = communauteChrome ? minimalRejoindreHeaderHTML : headerHTML;

    var btn = document.getElementById('mobileMenuBtn');
    var menu = document.getElementById('mobileMenu');
    if (btn && menu) {
      btn.addEventListener('click', function () { menu.classList.toggle('hidden'); });
      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { menu.classList.add('hidden'); });
      });
    }

    var onScroll = function () {
      if (window.scrollY > 20) host.classList.add('scrolled');
      else host.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    (function loadSaNavSession() {
      if (window.__saRefreshProfileNav) {
        window.__saRefreshProfileNav();
        return;
      }
      if (window.__saNavSessionScriptLoading) return;
      window.__saNavSessionScriptLoading = true;
      var scr = document.createElement('script');
      scr.async = true;
      scr.src = P + 'assets/js/sa-nav-session.js';
      scr.onload = function () {
        window.__saNavSessionScriptLoading = false;
        if (window.__saRefreshProfileNav) window.__saRefreshProfileNav();
      };
      scr.onerror = function () {
        window.__saNavSessionScriptLoading = false;
      };
      document.head.appendChild(scr);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
