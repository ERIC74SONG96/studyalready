/**
 * Compteurs communauté (RPC get_public_community_stats).
 * - layout simple (défaut) : Membres / Étudiants / Pros
 * - layout matrix : data-sa-stats-layout="matrix"
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

  function subCell(count, label, flag, href, cta) {
    return (
      '<div class="sa-community-matrix-sub">' +
        '<strong>' + fmt(count) + '</strong>' +
        '<span class="sa-community-matrix-sub-label">' + label + '</span>' +
        '<span class="sa-community-matrix-sub-flag">' + flag + '</span>' +
        '<a href="' + href + '">' + cta + '</a>' +
      '</div>'
    );
  }

  function renderMatrix(el, stats) {
    var mx = stats.matrix || {};
    var st = mx.students || {};
    var pr = mx.professionals || {};
    var published = Number(stats.published_profiles) || 0;
    var foot = published > 0
      ? '<p class="sa-community-matrix-foot">' + fmt(published) + ' fiche' + (published > 1 ? 's' : '') + ' publiée' + (published > 1 ? 's' : '') + ' dans l’annuaire public</p>'
      : '';
    el.innerHTML =
      '<p class="sa-community-matrix-lead">La communauté StudyAlready en chiffres</p>' +
      '<div class="sa-community-matrix-grid" role="group" aria-label="Inscriptions par profil et lieu">' +
        '<article class="sa-community-matrix-block sa-community-matrix-block--students">' +
          '<header class="sa-community-matrix-head">' +
            '<span class="sa-community-matrix-title"><span aria-hidden="true">🎓</span> Étudiants</span>' +
            '<span class="sa-community-matrix-total" title="Total étudiants">' + fmt(st.total) + '</span>' +
          '</header>' +
          '<div class="sa-community-matrix-subs">' +
            subCell(st.belgique, 'En Belgique', 'Déjà sur place', 'rejoindre-reseau.html?vue=communaute&parcours=belgique#adhesion', 'Rejoindre →') +
            subCell(st.cameroun, 'Au Cameroun', 'Projet d’études', 'rejoindre-reseau.html?vue=communaute&parcours=cameroun#adhesion', 'Rejoindre →') +
          '</div>' +
        '</article>' +
        '<article class="sa-community-matrix-block sa-community-matrix-block--pros">' +
          '<header class="sa-community-matrix-head">' +
            '<span class="sa-community-matrix-title"><span aria-hidden="true">💼</span> Professionnels</span>' +
            '<span class="sa-community-matrix-total" title="Total professionnels">' + fmt(pr.total) + '</span>' +
          '</header>' +
          '<div class="sa-community-matrix-subs">' +
            subCell(pr.belgique, 'En Belgique', 'Mentors &amp; diplômés', 'devenir-professionnel.html', 'Proposer mon aide →') +
            subCell(pr.cameroun, 'Au Cameroun', 'Réseau &amp; relais', 'rejoindre-reseau.html?vue=communaute&parcours=cameroun#adhesion', 'Rejoindre →') +
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
