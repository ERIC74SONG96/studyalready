/**
 * Affiche les compteurs communauté (RPC get_public_community_stats) sur les pages publiques.
 * Conteneur : attribut data-sa-community-stats
 * Variantes : sa-community-stats--hero (fond sombre) | sa-community-stats--light
 */
(function () {
  'use strict';

  var containers = document.querySelectorAll('[data-sa-community-stats]');
  if (!containers.length) return;

  function fmt(n) {
    var x = Number(n);
    if (!isFinite(x) || x < 0) return '—';
    return x.toLocaleString('fr-BE');
  }

  function cardSkeleton() {
    return '<div class="sa-community-stats-card"><strong class="sa-community-stats-pulse">…</strong><span>—</span></div>';
  }

  function skeletonHtml() {
    return (
      '<p class="sa-community-stats-lead">Communauté StudyAlready</p>' +
      '<div class="sa-community-stats-grid">' +
        cardSkeleton() + cardSkeleton() + cardSkeleton() +
      '</div>'
    );
  }

  function render(el, stats) {
    var total = fmt(stats.total);
    var students = fmt(stats.students);
    var pros = fmt(stats.professionals);
    var published = Number(stats.published_profiles) || 0;
    var foot = published > 0
      ? '<p class="sa-community-stats-foot">' + fmt(published) + ' fiche' + (published > 1 ? 's' : '') + ' visible' + (published > 1 ? 's' : '') + ' dans l’annuaire</p>'
      : '';

    el.innerHTML =
      '<p class="sa-community-stats-lead">Déjà inscrits à la communauté en Belgique</p>' +
      '<div class="sa-community-stats-grid" role="group" aria-label="Membres de la communauté">' +
        '<div class="sa-community-stats-card"><strong>' + total + '</strong><span>Membres</span></div>' +
        '<div class="sa-community-stats-card"><strong>' + students + '</strong><span>Étudiants</span></div>' +
        '<div class="sa-community-stats-card"><strong>' + pros + '</strong><span>Pros &amp; mentors</span></div>' +
      '</div>' +
      foot;
  }

  function renderError(el) {
    el.innerHTML = '';
    el.setAttribute('hidden', 'hidden');
  }

  containers.forEach(function (el) {
    var html = skeletonHtml();
    el.innerHTML = html.replace(/<\/?motion\b[^>]*>/gi, function (tag) {
      return tag.charAt(1) === '/' ? '</div>' : '<div>';
    });
    el.removeAttribute('hidden');
  });

  var sb = window.studyalreadySb;
  if (!sb) {
    containers.forEach(renderError);
    return;
  }

  sb.rpc('get_public_community_stats').then(function (res) {
    var stats = res.data;
    if (res.error || !stats || typeof stats !== 'object') {
      containers.forEach(renderError);
      return;
    }
    containers.forEach(function (el) {
      render(el, stats);
    });
  }).catch(function () {
    containers.forEach(renderError);
  });
})();
