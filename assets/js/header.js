(function () {
  'use strict';

  var path = (window.location && window.location.pathname) || '';

  function link(href, label, extraClass) {
    return '<a href="' + href + '" class="' + (extraClass || '') + '">' + label + '</a>';
  }

  /* En-tête réduit pour rejoindre-reseau quand vue=communaute (sessionStorage sa_espace_vue). */
  var minimalRejoindreHeaderHTML =
    '<nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">' +
      '<span class="flex items-center gap-2 min-w-0">' +
        '<span class="inline-flex w-9 h-9 rounded-lg bg-brand-dark items-center justify-center shrink-0"><span class="text-brand-gold font-bold text-sm font-display">SA</span></span>' +
        '<span class="font-display font-bold text-lg text-brand-dark truncate">StudyAlready <span class="text-slate-500 font-semibold text-sm">· Communauté</span></span>' +
      '</span>' +
      '<span class="flex items-center gap-3 shrink-0">' +
        '<span class="hidden" data-sa-profile-slot data-sa-profile-variant="compact" data-sa-dashboard-href="/espace-etudiant/dashboard"></span>' +
        '<a href="/espace-etudiant/" class="sa-espace-nav-link text-sm font-semibold text-brand-blue hover:underline">Mon espace</a>' +
      '</span>' +
    '</nav>';

  var headerHTML =
    '<nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">' +
      '<a href="/" class="flex items-center gap-2">' +
        '<div class="w-9 h-9 rounded-lg bg-brand-dark flex items-center justify-center"><span class="text-brand-gold font-bold text-sm font-display">SA</span></div>' +
        '<span class="font-display font-bold text-lg text-brand-dark">Study<span class="text-brand-gold">Already</span></span>' +
      '</a>' +

      '<ul class="hidden lg:flex items-center gap-6 text-sm font-medium">' +
        '<li>' + link('/', 'Accueil', 'hover:text-brand-gold transition') + '</li>' +
        '<li>' + link('/qui-sommes-nous', 'Qui sommes-nous ?', 'hover:text-brand-gold transition') + '</li>' +
        '<li>' + link('/equivalence', 'Équivalence', 'hover:text-brand-gold transition') + '</li>' +

        '<li class="relative group">' +
          '<button type="button" aria-haspopup="true" class="hover:text-brand-gold transition inline-flex items-center gap-1">' +
            'Services' +
            '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
          '</button>' +
          '<div class="hidden group-hover:block group-focus-within:block absolute top-full left-0 pt-3 z-50">' +
            '<div class="w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2">' +
              link('/tarifs-packs', 'Tarifs &amp; packs', 'block px-4 py-2 hover:bg-brand-cream text-brand-dark font-semibold') +
              link('/analyseur-admission', 'Analyseur d\'admission', 'block px-4 py-2 hover:bg-amber-50 text-amber-800 font-semibold') +
              link('/notre-dossier-fwb', 'Notre dossier FWB', 'block px-4 py-2 hover:bg-slate-50') +
              link('/inscription-universitaire', 'Aide admission universitaire', 'block px-4 py-2 hover:bg-slate-50') +
              link('/compte-bloque', 'Compte bloqué', 'block px-4 py-2 hover:bg-slate-50') +
              link('/assurance-visa', 'Assurance visa &amp; santé', 'block px-4 py-2 hover:bg-slate-50') +
              link('/logement-etudiant', 'Logement étudiant', 'block px-4 py-2 hover:bg-slate-50') +
              link('/pack-accueil', 'Pack accueil', 'block px-4 py-2 hover:bg-slate-50') +
              link('/preparer-voyage', 'Préparer mon voyage', 'block px-4 py-2 hover:bg-slate-50') +
              link('/services-bancaires', 'Assistance bancaire', 'block px-4 py-2 hover:bg-slate-50') +
              link('/accelerateur-job', 'Accélérateur de Job', 'block px-4 py-2 hover:bg-slate-50') +
              link('/offres-etudiants', 'Mur des offres job', 'block px-4 py-2 hover:bg-emerald-50 text-emerald-900 font-semibold') +
              link('/prequalification-dossier', 'Pré-qualification détaillée', 'block px-4 py-2 hover:bg-slate-50 text-brand-dark font-semibold border-t border-slate-100 mt-1') +
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
              link('/communaute', 'Vision &amp; deux parcours', 'block px-4 py-2 hover:bg-slate-50') +
              link('/annuaire', 'Annuaire des membres', 'block px-4 py-2 hover:bg-slate-50') +
              link('/besoin-d-aide', 'Besoin d\'aide ?', 'block px-4 py-2 hover:bg-amber-50 text-amber-800 font-semibold') +
              link('/evenements-seminaires', 'Événements &amp; séminaires', 'block px-4 py-2 hover:bg-slate-50') +
              link('/offres-etudiants', 'Offres job étudiant', 'block px-4 py-2 hover:bg-slate-50') +
              link('/rejoindre-reseau', 'Rejoindre le réseau', 'block px-4 py-2 hover:bg-slate-50 text-brand-dark font-semibold border-t border-slate-100 mt-1') +
              link('/devenir-professionnel', 'Professionnels &amp; mentors', 'block px-4 py-2 hover:bg-amber-50 text-amber-900 font-semibold') +
              link('/creer-profil', 'Créer mon profil public', 'block px-4 py-2 hover:bg-slate-50') +
            '</div>' +
          '</div>' +
        '</li>' +

        '<li>' + link('/offres-etudiants', 'Jobs étudiants', 'hover:text-brand-gold transition') + '</li>' +
        '<li>' + link('/blog', 'Blog', 'hover:text-brand-gold transition') + '</li>' +
        '<li class="sa-espace-nav-link">' + link('/espace-etudiant/', 'Mon espace', 'hover:text-brand-gold transition') + '</li>' +
        '<li class="hidden" data-sa-profile-slot data-sa-dashboard-href="/espace-etudiant/dashboard"></li>' +
      '</ul>' +

      '<a href="/#contact" class="hidden sm:inline-flex items-center gap-2 bg-brand-gold hover:bg-yellow-500 text-brand-dark font-semibold px-5 py-2.5 rounded-full text-sm transition shadow-sm">' +
        'Contact' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>' +
      '</a>' +

      '<button id="mobileMenuBtn" class="lg:hidden text-brand-dark" aria-label="Menu">' +
        '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>' +
      '</button>' +
    '</nav>' +

    '<div id="mobileMenu" class="hidden lg:hidden bg-white border-t border-slate-200 px-4 py-3 text-sm font-medium max-h-[80vh] overflow-y-auto">' +
      '<a href="/" class="block py-2">Accueil</a>' +
      '<a href="/qui-sommes-nous" class="block py-2">Qui sommes-nous ?</a>' +
      '<a href="/equivalence" class="block py-2">Équivalence (guide)</a>' +

      '<details class="border-t border-slate-100 mt-1">' +
        '<summary class="py-2 cursor-pointer list-none flex items-center justify-between">' +
          'Services' +
          '<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
        '</summary>' +
        '<div class="pl-3 pb-2 space-y-1 text-slate-600">' +
          '<a href="/tarifs-packs" class="block py-1.5 text-brand-dark font-semibold">Tarifs &amp; packs</a>' +
          '<a href="/analyseur-admission" class="block py-1.5 text-amber-800 font-semibold">Analyseur d\'admission</a>' +
          '<a href="/notre-dossier-fwb" class="block py-1.5">Notre dossier FWB</a>' +
          '<a href="/inscription-universitaire" class="block py-1.5">Aide admission universitaire</a>' +
          '<a href="/compte-bloque" class="block py-1.5">Compte bloqué</a>' +
          '<a href="/assurance-visa" class="block py-1.5">Assurance visa &amp; santé</a>' +
          '<a href="/logement-etudiant" class="block py-1.5">Logement étudiant</a>' +
          '<a href="/pack-accueil" class="block py-1.5">Pack accueil</a>' +
          '<a href="/preparer-voyage" class="block py-1.5">Préparer mon voyage</a>' +
          '<a href="/services-bancaires" class="block py-1.5">Assistance bancaire</a>' +
          '<a href="/accelerateur-job" class="block py-1.5">Accélérateur de Job</a>' +
          '<a href="/offres-etudiants" class="block py-1.5 text-emerald-900 font-semibold">Mur des offres job</a>' +
          '<a href="/prequalification-dossier" class="block py-1.5 text-brand-dark font-semibold">Pré-qualification détaillée</a>' +
        '</div>' +
      '</details>' +

      '<details class="border-t border-slate-100">' +
        '<summary class="py-2 cursor-pointer list-none flex items-center justify-between">' +
          'Communauté' +
          '<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
        '</summary>' +
        '<div class="pl-3 pb-2 space-y-1 text-slate-600">' +
          '<a href="/communaute" class="block py-1.5">Vision &amp; deux parcours</a>' +
          '<a href="/annuaire" class="block py-1.5">Annuaire des membres</a>' +
          '<a href="/besoin-d-aide" class="block py-1.5 text-amber-800 font-semibold">Besoin d\'aide ?</a>' +
          '<a href="/evenements-seminaires" class="block py-1.5">Événements &amp; séminaires</a>' +
          '<a href="/offres-etudiants" class="block py-1.5">Offres job étudiant</a>' +
          '<a href="/rejoindre-reseau" class="block py-1.5 text-brand-gold font-semibold">Rejoindre le réseau</a>' +
          '<a href="/creer-profil" class="block py-1.5">Créer mon profil public</a>' +
        '</div>' +
      '</details>' +

      '<a href="/offres-etudiants" class="block py-2 border-t border-slate-100 font-semibold text-brand-dark">Jobs étudiants</a>' +
      '<a href="/blog" class="block py-2">Blog</a>' +
      '<a href="/espace-etudiant/" class="sa-espace-nav-link block py-2 border-t border-slate-100">Espace personnel</a>' +
      '<div class="hidden" data-sa-profile-slot data-sa-profile-variant="mobile" data-sa-dashboard-href="/espace-etudiant/dashboard"></div>' +
      '<a href="/#contact" class="block py-3 border-t border-slate-100 text-brand-gold font-semibold">Contact →</a>' +
    '</div>';

  function init() {
    var host = document.getElementById('site-header');
    if (!host) return;
    var path = (window.location && window.location.pathname) || '';
    var isRejoindre = /rejoindre-reseau/i.test(path);
    var communauteChrome = false;
    try {
      communauteChrome = isRejoindre && sessionStorage.getItem('sa_espace_vue') === 'communaute';
    } catch (e) {}
    host.innerHTML = communauteChrome ? minimalRejoindreHeaderHTML : headerHTML;

    var btn = document.getElementById('mobileMenuBtn');
    var menu = document.getElementById('mobileMenu');
    if (btn && menu) {
      btn.addEventListener('click', function () { menu.classList.toggle('hidden'); });
      menu.addEventListener('click', function (ev) {
        if (ev.target.closest('a')) menu.classList.add('hidden');
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
      scr.src = '/assets/js/sa-nav-session.js';
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
