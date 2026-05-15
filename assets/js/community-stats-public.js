/**
 * Compteurs communauté (RPC get_public_community_stats).
 * - layout simple (défaut) : Membres / Étudiants / Pros
 * - layout matrix : data-sa-stats-layout="matrix"
 */
(function () {
  'use strict';

  var containers = document.querySelectorAll('[data-sa-community-stats]');
  var hasStatsWidgets = containers.length > 0 || document.querySelector('[data-sa-community-entry]');
  if (!hasStatsWidgets) return;

  function fmt(n) {
    var x = Number(n);
    if (!isFinite(x) || x < 0) return '—';
    return x.toLocaleString('fr-BE');
  }

  function isMatrixLayout(el) {
    return el.getAttribute('data-sa-stats-layout') === 'matrix' ||
      el.classList.contains('sa-community-matrix');
  }

  function skeletonSimple() {
    var card = '<div class="sa-community-stats-card"><strong class="sa-community-stats-pulse">…</strong><span>—</span></div>';
    card = '<div class="sa-community-stats-card"><strong class="sa-community-stats-pulse">…</strong><span>—</span></div>';
    return (
      '<p class="sa-community-stats-lead">Communauté StudyAlready</p>' +
      '<div class="sa-community-stats-grid">' + card + card + card + '</div>'
    );
  }

  function skeletonMatrix() {
    var sub = '<div class="sa-community-matrix-sub"><strong class="sa-community-stats-pulse">…</strong></div>';
    sub = '<div class="sa-community-matrix-sub"><strong class="sa-community-stats-pulse">…</strong></div>';
    return (
      '<p class="sa-community-matrix-lead">Chargement des inscriptions…</p>' +
      '<div class="sa-community-matrix-grid">' +
        '<article class="sa-community-matrix-block sa-community-matrix-block--students">' +
          '<header class="sa-community-matrix-head"><span class="sa-community-matrix-title">Étudiants</span></header>' +
          '<div class="sa-community-matrix-subs">' + sub + sub + '</div>' +
        '</article>' +
        '<article class="sa-community-matrix-block sa-community-matrix-block--pros">' +
          '<header class="sa-community-matrix-head"><span class="sa-community-matrix-title">Professionnels</span></header>' +
          '<div class="sa-community-matrix-subs">' + sub + sub + '</div>' +
        '</article>' +
      '</div>'
    );
  }

  function renderSimple(el, stats) {
    var total = fmt(stats.total);
    var students = fmt(stats.students);
    var pros = fmt(stats.professionals);
    var published = Number(stats.published_profiles) || 0;
    var foot = published > 0
      ? '<p class="sa-community-stats-foot">' + fmt(published) + ' fiche' + (published > 1 ? 's' : '') + ' visible' + (published > 1 ? 's' : '') + ' dans l’annuaire</p>'
      : '';
    el.innerHTML =
      '<p class="sa-community-stats-lead">Déjà inscrits à la communauté</p>' +
      '<div class="sa-community-stats-grid" role="group" aria-label="Membres de la communauté">' +
        '<div class="sa-community-stats-card"><strong>' + total + '</strong><span>Membres</span></div>' +
        '<div class="sa-community-stats-card"><strong>' + students + '</strong><span>Étudiants</span></div>' +
        '<div class="sa-community-stats-card"><strong>' + pros + '</strong><span>Pros &amp; mentors</span></div>' +
      '</div>' + foot;
  }

  function matrixSubCell(count, label, flag) {
    return (
      '<div class="sa-community-matrix-sub sa-community-matrix-sub--compact">' +
        '<strong>' + fmt(count) + '</strong>' +
        '<span class="sa-community-matrix-sub-label">' + label + '</span>' +
        '<span class="sa-community-matrix-sub-flag">' + flag + '</span>' +
      '</div>'
    );
  }

  function applyEntryCounts(stats) {
    var mx = stats.matrix || {};
    var st = mx.students || {};
    var pr = mx.professionals || {};
    var map = {
      'students-total': st.total,
      'students-belgique': st.belgique,
      'students-cameroun': st.cameroun,
      'professionals-total': pr.total,
      'professionals-belgique': pr.belgique,
      'professionals-cameroun': pr.cameroun
    };
    var key;
    for (key in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
      document.querySelectorAll('[data-sa-count="' + key + '"]').forEach(function (el) {
        el.textContent = fmt(map[key]);
      });
    }
  }

  function renderMatrix(el, stats) {
    var mx = stats.matrix || {};
    var st = mx.students || {};
    var pr = mx.professionals || {};
    var published = Number(stats.published_profiles) || 0;
    var foot = '<p class="sa-community-matrix-foot">Choisissez votre porte d’entrée ci-dessous ↓</p>';
    if (published > 0) {
      foot += '<p class="sa-community-matrix-foot">' + fmt(published) + ' fiche' + (published > 1 ? 's' : '') + ' publiée' + (published > 1 ? 's' : '') + ' dans l’annuaire</p>';
    }
    el.innerHTML =
      '<p class="sa-community-matrix-lead">La communauté StudyAlready en chiffres</p>' +
      '<div class="sa-community-matrix-grid" role="group" aria-label="Inscriptions par profil et lieu">' +
        '<article class="sa-community-matrix-block sa-community-matrix-block--students">' +
          '<header class="sa-community-matrix-head">' +
            '<span class="sa-community-matrix-title"><span aria-hidden="true">🎓</span> Étudiants</span>' +
            '<span class="sa-community-matrix-total" title="Total étudiants">' + fmt(st.total) + '</span>' +
          '</header>' +
          '<div class="sa-community-matrix-subs">' +
            matrixSubCell(st.belgique, 'En Belgique', 'Sur place') +
            matrixSubCell(st.cameroun, 'Au Cameroun', 'En préparation') +
          '</div>' +
        '</article>' +
        '<article class="sa-community-matrix-block sa-community-matrix-block--pros">' +
          '<header class="sa-community-matrix-head">' +
            '<span class="sa-community-matrix-title"><span aria-hidden="true">💼</span> Professionnels</span>' +
            '<span class="sa-community-matrix-total" title="Total professionnels">' + fmt(pr.total) + '</span>' +
          '</header>' +
          '<div class="sa-community-matrix-subs">' +
            matrixSubCell(pr.belgique, 'En Belgique', 'Mentors &amp; diplômés') +
            matrixSubCell(pr.cameroun, 'Au Cameroun', 'Relais diaspora') +
          '</div>' +
        '</article>' +
      '</div>' + foot;
  }

  function render(el, stats) {
    if (isMatrixLayout(el)) renderMatrix(el, stats);
    else renderSimple(el, stats);
  }

  function renderError(el) {
    el.innerHTML = '';
    el.setAttribute('hidden', 'hidden');
  }

  containers.forEach(function (el) {
    el.innerHTML = isMatrixLayout(el) ? skeletonMatrix() : skeletonSimple();
    el.removeAttribute('hidden');
  });

  var sb = window.studyalreadySb;
  if (!sb) {
    containers.forEach(renderError);
    return;
  }

  if (!containers.length) {
    sb.rpc('get_public_community_stats').then(function (res) {
      var stats = res.data;
      if (!res.error && stats && typeof stats === 'object') applyEntryCounts(stats);
    }).catch(function () {});
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
    applyEntryCounts(stats);
  }).catch(function () {
    containers.forEach(renderError);
  });
})();
