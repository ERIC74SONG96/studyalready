(function () {
  'use strict';

  var PAGE_SIZE = 24;
  var DEBOUNCE_MS = 280;
  var LEGAL_OUVERTURES = ['visa_titre_sejour', 'droit_etrangers_recours'];
  var PRO_MENTOR_OUVERTURES = ['mentorat', 'reseau_pro', 'seminaires'];
  var STATUT_PRO = 'Diplômé·e / Professionnel·le';
  var TAG_JURIDIQUE_LABELS = {
    avocat_juriste: 'Avocat·e / juriste',
    etudiant_droit: 'Étudiant·e en droit',
    experience_visa_sejour: 'Visa / séjour / recours'
  };
  var UNIVERSITE_COLORS = {
    'ULB': '#c8102e',
    'UCLouvain': '#1d3a8a',
    'ULiège': '#a30b1f',
    'UMons': '#e30613',
    'UNamur': '#5a2d82',
    'USL-B': '#0a6e3a',
    'HE Léonard de Vinci': '#0e8a6b',
    'HEH': '#0b6cb0',
    'HELHa': '#7a1f7a',
    'HE2B': '#0a2540',
    'EPHEC': '#005a9c',
    'ICHEC': '#003366',
    'Autre': '#94a3b8'
  };

  var RECENT_SEARCHES_KEY = 'sa_annuaire_recent_v1';
  var OUVERTURE_LABELS = {
    visa_titre_sejour: 'Visa / titre de séjour',
    droit_etrangers_recours: 'Droit des étrangers',
    mentorat: 'Mentorat',
    reseau_pro: 'Réseau pro',
    seminaires: 'Séminaires',
    aide_examens: 'Aide examens',
    logement: 'Logement',
    job: 'Job étudiant'
  };

  var state = {
    membres: [],
    membersById: {},
    view: 'tous',
    page: 1,
    followSet: new Set(),
    authUserId: null,
    debounceTimer: null,
    urlSync: true,
    uiBound: false,
    proUiBound: false,
    communityStats: { total: 0, students: 0, professionals: 0, published_profiles: 0 }
  };

  function colorFor(univ) {
    return UNIVERSITE_COLORS[univ] || '#94a3b8';
  }

  function initialsOf(prenom, initialNom) {
    var p = (prenom || '?').trim().charAt(0).toUpperCase();
    var n = (initialNom || '').replace(/[^A-Za-zÀ-ÿ]/g, '').charAt(0).toUpperCase();
    return n ? (p + n) : p;
  }

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseOuvertures(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw) {
      try {
        var p = JSON.parse(raw);
        return Array.isArray(p) ? p : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function isLegalMember(m) {
    if (!m) return false;
    if (m.domaine === 'Droit & sciences politiques') return true;
    var ouv = m.ouvertures || [];
    var i;
    for (i = 0; i < LEGAL_OUVERTURES.length; i++) {
      if (ouv.indexOf(LEGAL_OUVERTURES[i]) !== -1) return true;
    }
    if (m.tag_juridique && TAG_JURIDIQUE_LABELS[m.tag_juridique]) return true;
    var hay = [m.bio || '', (m.specialites || []).join(' ')].join(' ').toLowerCase();
    return /\b(avocat|juriste|visa|titre de s[eé]jour|recours|étrangers?|immigration)\b/.test(hay);
  }

  function hasProMentorOuverture(m) {
    var ouv = (m && m.ouvertures) || [];
    var i;
    for (i = 0; i < PRO_MENTOR_OUVERTURES.length; i++) {
      if (ouv.indexOf(PRO_MENTOR_OUVERTURES[i]) !== -1) return true;
    }
    return false;
  }

  function isExpert(m) {
    if (!m || m.statut !== STATUT_PRO) return false;
    if (hasProMentorOuverture(m)) return true;
    if (m.contact_publique === true) return true;
    return isLegalMember(m);
  }

  function isStudent(m) {
    return m && m.statut !== STATUT_PRO;
  }

  function legalBadgesHtml(m) {
    var parts = [];
    var ouv = m.ouvertures || [];
    if (ouv.indexOf('visa_titre_sejour') !== -1) {
      parts.push('<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-semibold mr-1">Visa / séjour</span>');
    }
    if (ouv.indexOf('droit_etrangers_recours') !== -1) {
      parts.push('<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-semibold mr-1">Droit étrangers</span>');
    }
    if (m.tag_juridique && TAG_JURIDIQUE_LABELS[m.tag_juridique]) {
      parts.push('<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold mr-1">' + escapeHTML(TAG_JURIDIQUE_LABELS[m.tag_juridique]) + '</span>');
    }
    return parts.join('');
  }

  function badgeStatut(statut) {
    if (statut === STATUT_PRO) return 'bg-amber-100 text-amber-800';
    if (statut === 'Stagiaire') return 'bg-violet-100 text-violet-800';
    return 'bg-sky-100 text-sky-800';
  }

  function normalizeMember(m) {
    if (!m) return m;
    var out = Object.assign({}, m);
    var spec = out.specialites;
    if (typeof spec === 'string') {
      out.specialites = spec.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    } else if (!Array.isArray(out.specialites)) {
      out.specialites = [];
    }
    out.ouvertures = parseOuvertures(out.ouvertures);
    out.tag_juridique = (out.tag_juridique || '').trim();
    return out;
  }

  function unique(values) {
    var seen = {};
    var out = [];
    var i;
    for (i = 0; i < values.length; i++) {
      var v = values[i];
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    }
    return out;
  }

  function fillSelect(selectEl, values, allLabel) {
    if (!selectEl) return;
    var html = '<option value="">' + escapeHTML(allLabel) + '</option>';
    var i;
    for (i = 0; i < values.length; i++) {
      html += '<option value="' + escapeHTML(values[i]) + '">' + escapeHTML(values[i]) + '</option>';
    }
    selectEl.innerHTML = html;
  }

  function followsStorageKey() {
    return 'sa_annuaire_follows_' + (state.authUserId || 'local');
  }

  function loadFollowsLocal() {
    try {
      var raw = localStorage.getItem(followsStorageKey());
      if (!raw) return new Set();
      var arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveFollowsLocal() {
    try {
      localStorage.setItem(followsStorageKey(), JSON.stringify(Array.from(state.followSet)));
    } catch (e) {}
  }

  function loadFollows(sb) {
    if (!sb) {
      state.followSet = loadFollowsLocal();
      return Promise.resolve();
    }
    return sb.auth.getSession().then(function (res) {
      var u = res.data && res.data.session && res.data.session.user;
      state.authUserId = u ? u.id : null;
      if (!state.authUserId) {
        state.followSet = new Set();
        return;
      }
      return sb.from('profile_follows').select('profile_id').eq('follower_id', state.authUserId).then(function (r) {
        if (r.error) {
          state.followSet = loadFollowsLocal();
          return;
        }
        state.followSet = new Set((r.data || []).map(function (row) { return row.profile_id; }));
        saveFollowsLocal();
      });
    }).catch(function () {
      state.followSet = loadFollowsLocal();
    });
  }

  function updateFollowCountEl() {
    var el = document.getElementById('annuaireFollowCount');
    if (!el) return;
    var n = state.followSet.size;
    el.textContent = n + ' abonnement' + (n > 1 ? 's' : '');
  }

  function toggleFollow(profileId, btn) {
    var sb = window.studyalreadySb;
    if (!state.authUserId) {
      if (window.confirm('Connectez-vous à Mon espace pour vous abonner à un profil.')) {
        window.location.href = 'espace-etudiant/';
      }
      return;
    }
    var following = state.followSet.has(profileId);
    if (following) {
      state.followSet.delete(profileId);
    } else {
      state.followSet.add(profileId);
    }
    saveFollowsLocal();
    updateFollowCountEl();
    updateStats(state.communityStats);
    syncFollowButtons();
    if (sb) {
      if (following) {
        sb.from('profile_follows').delete().eq('follower_id', state.authUserId).eq('profile_id', profileId);
      } else {
        sb.from('profile_follows').insert({ follower_id: state.authUserId, profile_id: profileId });
      }
    }
    if (state.view === 'suivis') render();
  }

  function syncFollowButtons() {
    document.querySelectorAll('[data-follow-id]').forEach(function (btn) {
      var id = btn.getAttribute('data-follow-id');
      var on = state.followSet.has(id);
      btn.classList.toggle('is-following', on);
      btn.textContent = on ? 'Abonné·e' : "S'abonner";
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function memberSearchHay(m) {
    return [
      m.prenom, m.initial_nom, m.filiere, m.universite, m.domaine, m.ville, m.bio, m.statut,
      (m.specialites || []).join(' '),
      m.tag_juridique || '',
      TAG_JURIDIQUE_LABELS[m.tag_juridique] || ''
    ].join(' ').toLowerCase();
  }

  function matches(m, filters) {
    if (filters.view === 'suivis' && !state.followSet.has(m.id)) return false;
    if (filters.view === 'etudiants' && !isStudent(m)) return false;
    if (filters.view === 'professionnels' && !isExpert(m)) return false;
    if (filters.view === 'juridique' && !isLegalMember(m)) return false;
    if (filters.view === 'belgique' && (m.reseau_segment || 'preparation') !== 'belgique') return false;
    if (filters.view === 'preparation' && (m.reseau_segment || 'preparation') !== 'preparation') return false;
    if (filters.universite && m.universite !== filters.universite) return false;
    if (filters.domaine && m.domaine !== filters.domaine) return false;
    if (filters.statut && m.statut !== filters.statut) return false;
    if (filters.ville && (m.ville || '') !== filters.ville) return false;
    if (filters.filiere) {
      var filHay = (m.filiere || '').toLowerCase();
      if (filHay.indexOf(filters.filiere.toLowerCase()) === -1) return false;
    }
    if (filters.tagJuridique && m.tag_juridique !== filters.tagJuridique) return false;
    if (filters.ouvertures && filters.ouvertures.length) {
      var ouvM = m.ouvertures || [];
      var ouvOk = false;
      var oi;
      for (oi = 0; oi < filters.ouvertures.length; oi++) {
        if (ouvM.indexOf(filters.ouvertures[oi]) !== -1) { ouvOk = true; break; }
      }
      if (!ouvOk) return false;
    }
    if (filters.avecBio && !(m.bio && String(m.bio).trim().length > 15)) return false;
    if (filters.contactPublic && m.contact_publique !== true) return false;
    if (filters.avecSpecialites && !(m.specialites && m.specialites.length > 0)) return false;
    if (filters.aide === 'juridique' && !isLegalMember(m)) return false;
    if (filters.aide === 'professionnel' && !isExpert(m)) return false;
    if (filters.q) {
      var q = filters.q.toLowerCase();
      if (memberSearchHay(m).indexOf(q) === -1) return false;
    }
    return true;
  }


  function getCheckedOuvertures() {
    var boxes = document.querySelectorAll('[data-filter-ouverture]:checked');
    var out = [];
    var i;
    for (i = 0; i < boxes.length; i++) {
      out.push(boxes[i].value);
    }
    return out;
  }

  function memberHasOuverture(m, key) {
    return (m.ouvertures || []).indexOf(key) !== -1;
  }

  function countRefineFilters(filters) {
    var n = 0;
    if (filters.universite) n++;
    if (filters.domaine) n++;
    if (filters.statut) n++;
    if (filters.ville) n++;
    if (filters.filiere) n++;
    if (filters.tagJuridique) n++;
    if (filters.avecBio) n++;
    if (filters.contactPublic) n++;
    if (filters.avecSpecialites) n++;
    if (filters.ouvertures && filters.ouvertures.length) n += filters.ouvertures.length;
    return n;
  }

  function updateRefineBadge(filters) {
    var el = document.getElementById('annuaireRefineCount');
    if (!el) return;
    var n = countRefineFilters(filters);
    if (n > 0) {
      el.textContent = String(n);
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function renderRefineCounts() {
    document.querySelectorAll('[data-count-for]').forEach(function (em) {
      var key = em.getAttribute('data-count-for');
      var n = 0;
      var i;
      for (i = 0; i < state.membres.length; i++) {
        if (memberHasOuverture(state.membres[i], key)) n++;
      }
      em.textContent = n > 0 ? '(' + n + ')' : '';
      var cb = document.querySelector('[data-filter-ouverture][value="' + key + '"]');
      if (cb) cb.disabled = n === 0;
    });
  }

  function resetRefineForm() {
    var ids = ['filterUniversite', 'filterDomaine', 'filterStatut', 'filterVille', 'filterTagJuridique'];
    var i;
    for (i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.value = '';
    }
    var fil = document.getElementById('filterFiliere');
    if (fil) fil.value = '';
    ['filterAvecBio', 'filterContactPublic', 'filterAvecSpecialites'].forEach(function (id) {
      var c = document.getElementById(id);
      if (c) c.checked = false;
    });
    document.querySelectorAll('[data-filter-ouverture]').forEach(function (cb) {
      cb.checked = false;
    });
  }

  function applyRefineFromUrl(sp) {
    var fVille = document.getElementById('filterVille');
    var fFil = document.getElementById('filterFiliere');
    var fTag = document.getElementById('filterTagJuridique');
    if (sp.get('ville') && fVille) fVille.value = sp.get('ville');
    if (sp.get('filiere') && fFil) fFil.value = sp.get('filiere');
    if (sp.get('tag') && fTag) fTag.value = sp.get('tag');
    if (sp.get('bio') === '1') {
      var b = document.getElementById('filterAvecBio');
      if (b) b.checked = true;
    }
    if (sp.get('contact') === '1') {
      var c = document.getElementById('filterContactPublic');
      if (c) c.checked = true;
    }
    if (sp.get('spec') === '1') {
      var s = document.getElementById('filterAvecSpecialites');
      if (s) s.checked = true;
    }
    var ouv = sp.get('ouverture');
    if (ouv) {
      ouv.split(',').forEach(function (key) {
        var cb = document.querySelector('[data-filter-ouverture][value="' + key.trim() + '"]');
        if (cb) cb.checked = true;
      });
    }
  }


  function buildMembersIndex() {
    state.membersById = {};
    var i;
    for (i = 0; i < state.membres.length; i++) {
      state.membersById[state.membres[i].id] = state.membres[i];
    }
  }

  function showToast(msg) {
    var old = document.querySelector('.annuaire-toast');
    if (old) old.remove();
    var el = document.createElement('p');
    el.className = 'annuaire-toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 2600);
  }

  function highlightHtml(text, query) {
    var safe = escapeHTML(text || '');
    if (!query || query.length < 2) return safe;
    var q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return safe.replace(new RegExp('(' + q + ')', 'gi'), '<mark class="annuaire-mark">$1</mark>');
    } catch (e) {
      return safe;
    }
  }

  function ouvertureBadgesHtml(m) {
    var ouv = m.ouvertures || [];
    var parts = [];
    var i;
    for (i = 0; i < ouv.length; i++) {
      if (OUVERTURE_LABELS[ouv[i]]) {
        parts.push('<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium mr-1">' + escapeHTML(OUVERTURE_LABELS[ouv[i]]) + '</span>');
      }
    }
    return parts.slice(0, 3).join('');
  }

  function renderSkeleton() {
    var html = '';
    var i;
    for (i = 0; i < 6; i++) {
      html += '<div class="annuaire-skeleton-row"><div class="annuaire-skeleton-avatar"></div><div class="flex-1 space-y-2"><div class="annuaire-skeleton-line short"></div><div class="annuaire-skeleton-line mid"></div></div></div>';
    }
    return html;
  }

  function renderDomainBreakdown() {
    var el = document.getElementById('annuaireDomainBreakdown');
    if (!el || !state.membres.length) return;
    var counts = {};
    var i;
    var dom;
    for (i = 0; i < state.membres.length; i++) {
      dom = state.membres[i].domaine || 'Autre';
      counts[dom] = (counts[dom] || 0) + 1;
    }
    var sorted = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 5);
    var max = counts[sorted[0]] || 1;
    var html = '<p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Top domaines</p>';
    for (i = 0; i < sorted.length; i++) {
      dom = sorted[i];
      var pct = Math.round((counts[dom] / max) * 100);
      html += '<div class="annuaire-domain-bar"><span title="' + escapeHTML(dom) + '">' + escapeHTML(dom) + '</span><div class="annuaire-domain-bar-track"><div class="annuaire-domain-bar-fill" style="width:' + pct + '%"></div></div><span class="text-slate-400 tabular-nums">' + counts[dom] + '</span></div>';
    }
    el.innerHTML = html;
  }

  function saveRecentSearch(q) {
    if (!q || q.length < 2) return;
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
      if (!Array.isArray(list)) list = [];
      list = list.filter(function (x) { return x !== q; });
      list.unshift(q);
      list = list.slice(0, 5);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function renderRecentSearches() {
    var wrap = document.getElementById('annuaireRecentSearches');
    if (!wrap) return;
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    } catch (e) {}
    if (!list.length) {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      return;
    }
    wrap.classList.remove('hidden');
    wrap.innerHTML = '<span class="text-[10px] text-slate-400 w-full">Récent :</span>' + list.map(function (q) {
      return '<button type="button" class="annuaire-recent-btn" data-recent="' + escapeHTML(q) + '">' + escapeHTML(q) + '</button>';
    }).join('');
    wrap.querySelectorAll('[data-recent]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fQ = document.getElementById('filterQ');
        if (fQ) { fQ.value = btn.getAttribute('data-recent'); state.page = 1; render(); }
      });
    });
  }

  function renderActiveFilterChips(filters) {
    var wrap = document.getElementById('annuaireActiveFilters');
    if (!wrap) return;
    var chips = [];
    var labels = {
      suivis: 'Mes abonnements',
      etudiants: 'Étudiants',
      professionnels: 'Professionnels',
      juridique: 'Visa / séjour',
      belgique: 'En Belgique',
      preparation: 'Hors Belgique'
    };
    if (filters.view && filters.view !== 'tous' && labels[filters.view]) {
      chips.push({ key: 'view', label: labels[filters.view] });
    }
    if (filters.universite) chips.push({ key: 'universite', label: filters.universite });
    if (filters.domaine) chips.push({ key: 'domaine', label: filters.domaine });
    if (filters.statut) chips.push({ key: 'statut', label: filters.statut });
    if (filters.ville) chips.push({ key: 'ville', label: filters.ville });
    if (filters.filiere) chips.push({ key: 'filiere', label: filters.filiere });
    if (filters.tagJuridique && TAG_JURIDIQUE_LABELS[filters.tagJuridique]) {
      chips.push({ key: 'tagJuridique', label: TAG_JURIDIQUE_LABELS[filters.tagJuridique] });
    }
    if (filters.ouvertures && filters.ouvertures.length) {
      filters.ouvertures.forEach(function (ok) {
        chips.push({ key: 'ouverture:' + ok, label: OUVERTURE_LABELS[ok] || ok });
      });
    }
    if (filters.avecBio) chips.push({ key: 'avecBio', label: 'Avec bio' });
    if (filters.contactPublic) chips.push({ key: 'contactPublic', label: 'Contact public' });
    if (filters.avecSpecialites) chips.push({ key: 'avecSpecialites', label: 'Spécialités' });
    if (filters.q) chips.push({ key: 'q', label: '"' + filters.q + '"' });
    if (!chips.length) {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      return;
    }
    wrap.classList.remove('hidden');
    wrap.innerHTML = chips.map(function (c) {
      return '<span class="annuaire-filter-pill">' + escapeHTML(c.label) + '<button type="button" data-clear-filter="' + escapeHTML(c.key) + '" aria-label="Retirer">×</button></span>';
    }).join('');
    wrap.querySelectorAll('[data-clear-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        clearFilterKey(btn.getAttribute('data-clear-filter'));
      });
    });
  }

  function clearFilterKey(key) {
    if (key === 'view') state.view = 'tous';
    else if (key === 'universite') { var el = document.getElementById('filterUniversite'); if (el) el.value = ''; }
    else if (key === 'domaine') { var el2 = document.getElementById('filterDomaine'); if (el2) el2.value = ''; }
    else if (key === 'statut') { var el3 = document.getElementById('filterStatut'); if (el3) el3.value = ''; }
    else if (key === 'q') { var el4 = document.getElementById('filterQ'); if (el4) el4.value = ''; }
    else if (key === 'ville') { var el5 = document.getElementById('filterVille'); if (el5) el5.value = ''; }
    else if (key === 'filiere') { var el6 = document.getElementById('filterFiliere'); if (el6) el6.value = ''; }
    else if (key === 'tagJuridique') { var el7 = document.getElementById('filterTagJuridique'); if (el7) el7.value = ''; }
    else if (key === 'avecBio') { var el8 = document.getElementById('filterAvecBio'); if (el8) el8.checked = false; }
    else if (key === 'contactPublic') { var el9 = document.getElementById('filterContactPublic'); if (el9) el9.checked = false; }
    else if (key === 'avecSpecialites') { var el10 = document.getElementById('filterAvecSpecialites'); if (el10) el10.checked = false; }
    else if (key.indexOf('ouverture:') === 0) {
      var ov = key.slice(10);
      var cb = document.querySelector('[data-filter-ouverture][value="' + ov + '"]');
      if (cb) cb.checked = false;
    }
    setActiveNav(state.view);
    state.page = 1;
    render();
  }

  function syncUrlFromFilters(filters) {
    if (!state.urlSync || typeof history === 'undefined' || !history.replaceState) return;
    var p = new URLSearchParams();
    if (filters.view && filters.view !== 'tous') {
      if (filters.view === 'evenements') p.set('vue', 'evenements');
      else p.set('vue', filters.view);
    }
    if (filters.universite) p.set('universite', filters.universite);
    if (filters.domaine) p.set('domaine', filters.domaine);
    if (filters.statut) p.set('statut', filters.statut);
    if (filters.q) p.set('q', filters.q);
    if (filters.ville) p.set('ville', filters.ville);
    if (filters.filiere) p.set('filiere', filters.filiere);
    if (filters.tagJuridique) p.set('tag', filters.tagJuridique);
    if (filters.ouvertures && filters.ouvertures.length) p.set('ouverture', filters.ouvertures.join(','));
    if (filters.avecBio) p.set('bio', '1');
    if (filters.contactPublic) p.set('contact', '1');
    if (filters.avecSpecialites) p.set('spec', '1');
    if (filters.aide === 'juridique') p.set('aide', 'juridique');
    if (filters.aide === 'professionnel') p.set('aide', 'professionnel');
    var qs = p.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  function copyShareLink() {
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { showToast('Lien copié dans le presse-papiers'); });
    } else {
      showToast(url);
    }
  }

  function updateSearchClearBtn() {
    var fQ = document.getElementById('filterQ');
    var btn = document.getElementById('filterQClear');
    if (!fQ || !btn) return;
    btn.classList.toggle('hidden', !fQ.value.trim());
  }

  function openProfileDrawer(id) {
    var m = state.membersById[id];
    var drawer = document.getElementById('annuaireDrawer');
    var body = document.getElementById('annuaireDrawerBody');
    if (!m || !drawer || !body) return;
    var color = colorFor(m.universite);
    var initiales = initialsOf(m.prenom, m.initial_nom);
    var msgHref = 'mise-en-relation?id=' + encodeURIComponent(m.id) + '&nom=' + encodeURIComponent(m.prenom + ' ' + (m.initial_nom || ''));
    var following = state.followSet.has(m.id);
    var spec = (m.specialites || []).map(function (s) {
      return '<span class="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 mr-1 mb-1">' + escapeHTML(s) + '</span>';
    }).join('');
    body.innerHTML =
      '<div class="annuaire-drawer-hero">' +
        '<div class="annuaire-avatar' + (isExpert(m) ? ' ring-2 ring-brand-gold' : '') + '" style="background-color:' + color + '">' + escapeHTML(initiales) + '</div>' +
        '<h3 class="mt-3 font-display font-bold text-brand-dark text-lg">' + escapeHTML(m.prenom + ' ' + (m.initial_nom || '')) + '</h3>' +
        '<p class="text-sm text-slate-500">' + escapeHTML(m.filiere || '') + ' · ' + escapeHTML(m.universite || '') + '</p>' +
        '<p class="text-xs text-slate-400 mt-1">' + escapeHTML(m.domaine || '') + (m.ville ? ' · ' + m.ville : '') + '</p>' +
        '<div class="mt-2 flex flex-wrap justify-center gap-1">' + legalBadgesHtml(m) + ouvertureBadgesHtml(m) + '</div>' +
      '</div>' +
      '<div class="annuaire-drawer-section"><h3>Présentation</h3><p class="text-sm text-slate-600 leading-relaxed">' + escapeHTML(m.bio || 'Aucune présentation.') + '</p></div>' +
      (spec ? '<div class="annuaire-drawer-section"><h3>Spécialités</h3><div>' + spec + '</div></div>' : '') +
      '<div class="annuaire-drawer-section flex flex-col gap-2">' +
        '<button type="button" class="annuaire-follow-btn w-full' + (following ? ' is-following' : '') + '" data-follow-id="' + escapeHTML(m.id) + '">' + (following ? 'Abonné·e' : "S'abonner") + '</button>' +
        '<a href="' + msgHref + '" class="block text-center bg-brand-dark text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-brand-blue">Envoyer un message</a>' +
      '</div>' +
      '<p class="mt-4 text-[10px] text-slate-400 text-center">Profil déclaré par le membre — non vérifié par StudyAlready.</p>';
    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    body.querySelectorAll('[data-follow-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFollow(btn.getAttribute('data-follow-id'), btn);
        openProfileDrawer(id);
      });
    });
  }

  function closeProfileDrawer() {
    var drawer = document.getElementById('annuaireDrawer');
    if (!drawer) return;
    drawer.classList.add('hidden');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function bindProfileRowClicks() {
    document.querySelectorAll('#annuaireGrid .annuaire-member-row, #annuaireSuggestList .annuaire-member-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.annuaire-row-actions')) return;
        openProfileDrawer(row.getAttribute('data-profile-id'));
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProfileDrawer(row.getAttribute('data-profile-id'));
        }
      });
    });
  }

  function bindAnnuaireListeners() {
    if (state.uiBound) return;
    state.uiBound = true;

    var fUniv = document.getElementById('filterUniversite');
    var fDom = document.getElementById('filterDomaine');
    var fStatut = document.getElementById('filterStatut');
    var fQ = document.getElementById('filterQ');
    var fSort = document.getElementById('filterSort');
    var btnReset = document.getElementById('filterReset');

    document.querySelectorAll('[data-annuaire-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.view = btn.getAttribute('data-annuaire-view') || 'tous';
        state.page = 1;
        var fAide = document.getElementById('filterAide');
        if (fAide) {
          if (state.view === 'juridique') fAide.value = 'juridique';
          else if (state.view === 'professionnels') fAide.value = 'professionnel';
          else fAide.value = '';
        }
        if (state.view === 'evenements' && window.StudyAlreadyEvents) window.StudyAlreadyEvents.resetEventPage();
        setActiveNav(state.view);
        render();
      });
    });

    function scheduleRender() {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(function () {
        state.page = 1;
        render();
      }, DEBOUNCE_MS);
    }

    var refineEls = [fUniv, fDom, fStatut, fSort, document.getElementById('filterVille'), document.getElementById('filterTagJuridique')];
    refineEls.forEach(function (el) {
      if (el) el.addEventListener('change', function () { state.page = 1; render(); });
    });
    var fFilEl = document.getElementById('filterFiliere');
    if (fFilEl) {
      fFilEl.addEventListener('change', function () { state.page = 1; render(); });
      fFilEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { state.page = 1; render(); }
      });
    }
    document.querySelectorAll('[data-filter-ouverture], #filterAvecBio, #filterContactPublic, #filterAvecSpecialites').forEach(function (el) {
      el.addEventListener('change', function () { state.page = 1; render(); });
    });
    if (fQ) fQ.addEventListener('input', scheduleRender);
    ['filterEventType', 'filterEventFormat', 'filterEventCity', 'filterEventPeriod'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function () {
        if (window.StudyAlreadyEvents) window.StudyAlreadyEvents.resetEventPage();
        state.page = 1;
        render();
      });
    });
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        resetRefineForm();
        if (fQ) fQ.value = '';
        var fAide = document.getElementById('filterAide');
        if (fAide) fAide.value = '';
        state.view = 'tous';
        state.page = 1;
        setActiveNav('tous');
        updateLegalNotice(false);
        render();
      });
    }
  }

  function bindProUI() {
    if (state.proUiBound) return;
    state.proUiBound = true;
    var fQ = document.getElementById('filterQ');
    var clearBtn = document.getElementById('filterQClear');
    var shareBtn = document.getElementById('annuaireShareLink');
    var emptyReset = document.getElementById('annuaireEmptyReset');
    document.querySelectorAll('[data-drawer-close]').forEach(function (el) {
      el.addEventListener('click', closeProfileDrawer);
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (fQ) fQ.focus();
      }
      if (e.key === 'Escape') closeProfileDrawer();
    });
    if (clearBtn && fQ) {
      clearBtn.addEventListener('click', function () {
        fQ.value = '';
        updateSearchClearBtn();
        state.page = 1;
        render();
        fQ.focus();
      });
    }
    if (shareBtn) shareBtn.addEventListener('click', copyShareLink);
    if (emptyReset) {
      emptyReset.addEventListener('click', function () {
        var btn = document.getElementById('filterReset');
        if (btn) btn.click();
      });
    }
    document.querySelectorAll('[data-quick-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.view = btn.getAttribute('data-quick-view');
        state.page = 1;
        setActiveNav(state.view);
        render();
      });
    });
    document.querySelectorAll('[data-quick-domain]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fDom = document.getElementById('filterDomaine');
        if (fDom) fDom.value = btn.getAttribute('data-quick-domain');
        state.page = 1;
        render();
      });
    });
    if (fQ) {
      fQ.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && fQ.value.trim()) saveRecentSearch(fQ.value.trim());
      });
    }
  }

  function sortMembers(list, sortKey, query) {
    var out = list.slice();
    var q = (query || '').toLowerCase();
    if (sortKey === 'nom') {
      out.sort(function (a, b) {
        return (a.prenom + ' ' + (a.initial_nom || '')).localeCompare(b.prenom + ' ' + (b.initial_nom || ''), 'fr');
      });
    } else if (sortKey === 'univ') {
      out.sort(function (a, b) {
        return (a.universite || '').localeCompare(b.universite || '', 'fr');
      });
    } else if (sortKey === 'pros') {
      out.sort(function (a, b) {
        var ea = isExpert(a) ? 0 : 1;
        var eb = isExpert(b) ? 0 : 1;
        if (ea !== eb) return ea - eb;
        return (a.prenom || '').localeCompare(b.prenom || '', 'fr');
      });
    } else if (q) {
      out.sort(function (a, b) {
        var ha = memberSearchHay(a);
        var hb = memberSearchHay(b);
        var pa = ha.indexOf(q) === 0 ? 0 : ha.indexOf(q);
        var pb = hb.indexOf(q) === 0 ? 0 : hb.indexOf(q);
        if (pa < 0) pa = 9999;
        if (pb < 0) pb = 9999;
        return pa - pb;
      });
    }
    return out;
  }

  function renderMemberRow(m, compact, query) {
    var color = colorFor(m.universite);
    var initiales = initialsOf(m.prenom, m.initial_nom);
    var msgHref = 'mise-en-relation?id=' + encodeURIComponent(m.id) + '&nom=' + encodeURIComponent(m.prenom + ' ' + (m.initial_nom || ''));
    var following = state.followSet.has(m.id);
    var q = query || '';
    var bio = compact ? '' : '<p class="mt-1 text-xs text-slate-600 line-clamp-2">' + highlightHtml(m.bio || '', q) + '</p>';
    var proClass = isExpert(m) ? ' is-pro' : '';

    return '' +
      '<article class="annuaire-member-row' + proClass + '" data-profile-id="' + escapeHTML(m.id) + '" role="button" tabindex="0" title="Voir la fiche">' +
      '<div class="annuaire-avatar" style="background-color:' + color + '">' + escapeHTML(initiales) + '</div>' +
      '<div class="flex-1 min-w-0">' +
        '<p class="font-display font-bold text-brand-dark text-sm truncate">' + highlightHtml(m.prenom + ' ' + (m.initial_nom || ''), q) + '</p>' +
        '<p class="text-xs text-slate-500 truncate">' + highlightHtml((m.filiere || '') + ' · ' + (m.universite || ''), q) + '</p>' +
        '<p class="text-xs text-slate-400 truncate">' + highlightHtml((m.domaine || '') + (m.ville ? ' · ' + m.ville : ''), q) + '</p>' +
        '<div class="mt-1 flex flex-wrap gap-1">' +
          '<span class="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ' + badgeStatut(m.statut) + '">' + escapeHTML((m.statut || '').replace(' / Professionnel·le', '')) + '</span>' +
          legalBadgesHtml(m) + ouvertureBadgesHtml(m) +
        '</div>' +
        bio +
      '</div>' +
      '<div class="annuaire-row-actions flex flex-col gap-1.5 shrink-0">' +
        '<button type="button" class="annuaire-follow-btn' + (following ? ' is-following' : '') + '" data-follow-id="' + escapeHTML(m.id) + '" aria-pressed="' + (following ? 'true' : 'false') + '">' + (following ? 'Abonné·e' : "S'abonner") + '</button>' +
        '<a href="' + msgHref + '" class="text-center text-[11px] font-semibold text-brand-blue hover:underline py-1">Message</a>' +
      '</div>' +
    '</article>';
  }

  function renderPagination(total, page) {
    var el = document.getElementById('annuairePagination');
    if (!el) return;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (total <= PAGE_SIZE) {
      el.innerHTML = '';
      return;
    }
    var html = '';
    var p;
    html += '<button type="button" class="annuaire-pager-btn" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>‹</button>';
    var start = Math.max(1, page - 2);
    var end = Math.min(pages, page + 2);
    for (p = start; p <= end; p++) {
      html += '<button type="button" class="annuaire-pager-btn' + (p === page ? ' is-active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    html += '<button type="button" class="annuaire-pager-btn" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var np = Number(btn.getAttribute('data-page'));
        if (np >= 1 && np <= pages) {
          state.page = np;
          render();
          var grid = document.getElementById('annuaireGrid');
          if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function updateStats(communityStats) {
    var el = document.getElementById('annuaireStats');
    if (!el) return;
    var s = communityStats || {};
    var total = Number(s.total) || 0;
    var etu = Number(s.students) || 0;
    var pros = Number(s.professionals) || 0;
    var published = Number(s.published_profiles) || 0;
    var sub = published > 0 && published < total
      ? '<p class="mt-2 text-[10px] text-slate-400 leading-snug">' + published.toLocaleString('fr-BE') + ' fiche' + (published > 1 ? 's' : '') + ' visible' + (published > 1 ? 's' : '') + ' dans l’annuaire</p>'
      : '';
    el.innerHTML =
      '<div class="annuaire-stats-grid">' +
        '<div class="annuaire-stat-card"><strong>' + total.toLocaleString('fr-BE') + '</strong><span>Membres</span></div>' +
        '<div class="annuaire-stat-card"><strong>' + etu.toLocaleString('fr-BE') + '</strong><span>Étudiants</span></div>' +
        '<div class="annuaire-stat-card"><strong>' + pros.toLocaleString('fr-BE') + '</strong><span>Pros</span></div>' +
        '<div class="annuaire-stat-card"><strong>' + state.followSet.size + '</strong><span>Abonnements</span></div>' +
      '</div>' + sub;
  }

  function renderSuggestList(membres) {
    var list = document.getElementById('annuaireSuggestList');
    var empty = document.getElementById('annuaireExpertsEmpty');
    if (!list) return;
    var experts = membres.filter(isExpert).slice(0, 5);
    if (experts.length === 0) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    list.innerHTML = experts.map(function (m) {
      return renderMemberRow(m, true, '');
    }).join('');
  }

  function setActiveNav(view) {
    document.querySelectorAll('[data-annuaire-view]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-annuaire-view') === view);
    });
  }

  function updateLegalNotice(show) {
    var el = document.getElementById('annuaireLegalNotice');
    if (el) {
      if (show) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  }

  function parseProfilesPayload(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        var p = JSON.parse(raw);
        return Array.isArray(p) ? p : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function updateProfileCta(hasOwnProfile, hasAnnuaireAccess) {
    var cta = document.getElementById('annuaireProfilCta');
    var hint = document.getElementById('annuaireOwnProfileHint');
    if (!cta) return;
    if (hasOwnProfile) {
      cta.textContent = 'Ma fiche annuaire';
      cta.href = 'espace-etudiant/dashboard';
      cta.classList.remove('bg-brand-gold', 'hover:bg-yellow-400');
      cta.classList.add('bg-white', 'border-2', 'border-brand-dark', 'text-brand-dark', 'hover:bg-brand-cream');
      if (hint) {
        hint.classList.remove('hidden');
        hint.innerHTML =
          'Votre fiche est publiée : elle n’apparaît pas ici (vous voyez les <strong>autres</strong> membres). Pour modifier : ' +
          '<a href="mailto:contact@studyalready.com" class="text-brand-blue font-semibold underline">contact@studyalready.com</a>.';
      }
    } else if (hasAnnuaireAccess) {
      cta.textContent = '+ Publier ma fiche dans l’annuaire';
      cta.href = 'creer-profil';
      cta.classList.add('bg-brand-gold', 'hover:bg-yellow-400', 'text-brand-dark');
      cta.classList.remove('bg-white', 'border-2', 'border-brand-dark', 'hover:bg-brand-cream');
      if (hint) {
        hint.classList.remove('hidden');
        hint.innerHTML =
          'Vous avez accès au réseau, mais <strong>pas encore de fiche publique</strong>. Les profils listés sont d’autres membres. ' +
          'Créez votre fiche (même e-mail que Mon espace) pour être trouvable — vous ne vous verrez pas vous-même dans cette liste.';
      }
    } else {
      cta.textContent = '+ Créer mon profil';
      cta.href = 'creer-profil';
      cta.classList.add('bg-brand-gold', 'hover:bg-yellow-400', 'text-brand-dark');
      cta.classList.remove('bg-white', 'border-2', 'border-brand-dark', 'hover:bg-brand-cream');
      if (hint) hint.classList.add('hidden');
    }
  }

  function fetchSupabaseProfiles() {
    var sb = window.studyalreadySb;
    if (!sb) return Promise.resolve({ list: [], denied: false, viewerHasProfile: false });
    return sb.auth.getSession().then(function () {
      return sb.rpc('get_annuaire_profiles');
    }).then(function (res) {
      if (res.error) {
        console.warn('StudyAlready annuaire Supabase:', res.error.message);
        return { list: [], denied: false, viewerHasProfile: false, communityStats: { total: 0, students: 0, professionals: 0, published_profiles: 0 } };
      }
      var raw = res.data;
      var denied = false;
      var viewerHasProfile = false;
      var communityStats = { total: 0, students: 0, professionals: 0, published_profiles: 0 };
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && Number(raw.schema_version) === 2) {
        denied = !!raw.denied;
        viewerHasProfile = !!raw.viewer_has_profile;
        if (raw.community_stats && typeof raw.community_stats === 'object') {
          communityStats = raw.community_stats;
        }
        raw = raw.profiles;
      }
      var arr = parseProfilesPayload(raw);
      return { list: arr.map(normalizeMember), denied: denied, viewerHasProfile: viewerHasProfile, communityStats: communityStats };
    }).catch(function (e) {
      console.warn('StudyAlready annuaire Supabase:', e);
      return { list: [], denied: false, viewerHasProfile: false, communityStats: { total: 0, students: 0, professionals: 0, published_profiles: 0 } };
    });
  }

  function getFiltersFromDom() {
    var fUniv = document.getElementById('filterUniversite');
    var fDom = document.getElementById('filterDomaine');
    var fStatut = document.getElementById('filterStatut');
    var fAide = document.getElementById('filterAide');
    var fQ = document.getElementById('filterQ');
    var fSort = document.getElementById('filterSort');
    var fVille = document.getElementById('filterVille');
    var fFil = document.getElementById('filterFiliere');
    var fTag = document.getElementById('filterTagJuridique');
    var fBio = document.getElementById('filterAvecBio');
    var fContact = document.getElementById('filterContactPublic');
    var fSpec = document.getElementById('filterAvecSpecialites');
    return {
      view: state.view,
      universite: fUniv ? fUniv.value : '',
      domaine: fDom ? fDom.value : '',
      statut: fStatut ? fStatut.value : '',
      ville: fVille ? fVille.value : '',
      filiere: fFil ? fFil.value.trim() : '',
      tagJuridique: fTag ? fTag.value : '',
      ouvertures: getCheckedOuvertures(),
      avecBio: !!(fBio && fBio.checked),
      contactPublic: !!(fContact && fContact.checked),
      avecSpecialites: !!(fSpec && fSpec.checked),
      aide: fAide ? fAide.value : '',
      q: fQ ? fQ.value.trim() : '',
      sort: fSort ? fSort.value : 'pertinence'
    };
  }

  function render() {
    if (state.view === 'evenements') {
      if (window.StudyAlreadyEvents) {
        if (window.StudyAlreadyEvents.toggleAnnuaireChrome) window.StudyAlreadyEvents.toggleAnnuaireChrome(true);
        window.StudyAlreadyEvents.renderAnnuaireEventsView();
      }
      return;
    }
    if (window.StudyAlreadyEvents && window.StudyAlreadyEvents.toggleAnnuaireChrome) {
      window.StudyAlreadyEvents.toggleAnnuaireChrome(false);
    }
    var grid = document.getElementById('annuaireGrid');
    var emptyEl = document.getElementById('annuaireEmpty');
    var countEl = document.getElementById('annuaireCount');
    if (!grid) return;
    grid.className = 'min-h-[12rem]';

    var filters = getFiltersFromDom();
    updateLegalNotice(filters.view === 'juridique' || filters.aide === 'juridique');

    var filtered = state.membres.filter(function (m) { return matches(m, filters); });
    filtered = sortMembers(filtered, filters.sort, filters.q);

    var total = filtered.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;

    var start = (state.page - 1) * PAGE_SIZE;
    var slice = filtered.slice(start, start + PAGE_SIZE);

    if (total === 0) {
      grid.innerHTML = '';
      if (emptyEl) {
        emptyEl.classList.remove('hidden');
        var emptyP = emptyEl.querySelector('p');
        if (emptyP) {
          if (state.membres.length === 0) {
            emptyP.textContent = 'Aucun membre pour le moment.';
          } else if (filters.view === 'suivis') {
            emptyP.textContent = state.authUserId
              ? 'Vous ne suivez personne pour l’instant. Cliquez sur « S’abonner » sur un profil.'
              : 'Connectez-vous pour voir vos abonnements.';
          } else {
            emptyP.textContent = 'Aucun membre pour ces critères. Essayez un autre mot-clé ou filtre.';
          }
        }
      }
    } else {
      if (emptyEl) emptyEl.classList.add('hidden');
      grid.innerHTML = slice.map(function (m) { return renderMemberRow(m, false, filters.q); }).join('');
      grid.querySelectorAll('[data-follow-id]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          toggleFollow(btn.getAttribute('data-follow-id'), btn);
        });
      });
      bindProfileRowClicks();
    }

    if (countEl) {
      if (total === 0) {
        countEl.textContent = '0 membre';
      } else {
        var end = Math.min(start + PAGE_SIZE, total);
        countEl.textContent = (start + 1) + '–' + end + ' sur ' + total.toLocaleString('fr-BE');
      }
    }

    renderPagination(total, state.page);
    syncFollowButtons();
    renderActiveFilterChips(filters);
    syncUrlFromFilters(filters);
    updateSearchClearBtn();
    if (filters.q) saveRecentSearch(filters.q);
    renderRecentSearches();
    updateRefineBadge(filters);
  }

  function applyViewFromUrl() {
    try {
      var sp = new URLSearchParams(window.location.search);
      var v = sp.get('vue') || sp.get('view');
      var qAide = sp.get('aide');
      if (qAide === 'juridique') state.view = 'juridique';
      else if (qAide === 'professionnel') state.view = 'professionnels';
      else if (v === 'suivis' || v === 'etudiants' || v === 'professionnels' || v === 'juridique' || v === 'evenements' || v === 'belgique' || v === 'preparation' || v === 'tous') {
        state.view = v;
      }
      var fAide = document.getElementById('filterAide');
      if (qAide && fAide) fAide.value = qAide;
    } catch (e) {}
    setActiveNav(state.view);
  }

  function fetchSupabaseProfilesWithTimeout() {
    return Promise.race([
      fetchSupabaseProfiles(),
      new Promise(function (resolve) {
        setTimeout(function () {
          console.warn('StudyAlready annuaire: delai depasse (profils).');
          resolve({ list: [], denied: false });
        }, 15000);
      })
    ]);
  }

  function init() {
    var grid = document.getElementById('annuaireGrid');
    if (!grid) return;

    grid.innerHTML = renderSkeleton();
    bindAnnuaireListeners();
    bindProUI();
    applyViewFromUrl();

    var sb = window.studyalreadySb;
    var demoParam = String(window.location.search || '').indexOf('annuaire_demo=1') !== -1;

    Promise.allSettled([
      fetch('assets/data/membres.json', { cache: 'no-cache' }).then(function (r) {
        return r.ok ? r.json() : { membres: [] };
      }).catch(function () { return { membres: [] }; }),
      fetchSupabaseProfilesWithTimeout(),
      loadFollows(sb).catch(function () { return null; }),
      (window.StudyAlreadyEvents ? window.StudyAlreadyEvents.fetchPublishedEvents(sb) : Promise.resolve([]))
    ]).then(function (settled) {
      function val(i, fallback) {
        return settled[i] && settled[i].status === 'fulfilled' ? settled[i].value : fallback;
      }
      var data = val(0, { membres: [] }) || {};
      var remotePack = val(1, { list: [], denied: false, viewerHasProfile: false, communityStats: { total: 0, students: 0, professionals: 0, published_profiles: 0 } }) || { list: [], denied: false, viewerHasProfile: false, communityStats: { total: 0, students: 0, professionals: 0, published_profiles: 0 } };
      var eventsRaw = val(3, []);
      var eventsList = Array.isArray(eventsRaw) ? eventsRaw : [];
      var remote = remotePack.list || [];
      var accessDenied = !!remotePack.denied;
      var gateEl = document.getElementById('annuaireAccessGate');
      var mainEl = document.getElementById('annuaireMainContent');

      if (accessDenied && !demoParam) {
        if (mainEl) mainEl.classList.add('hidden');
        if (gateEl) gateEl.classList.remove('hidden');
        return;
      }
      if (mainEl) mainEl.classList.remove('hidden');
      if (gateEl) gateEl.classList.add('hidden');

      updateProfileCta(!!remotePack.viewerHasProfile, true);
      state.communityStats = remotePack.communityStats || state.communityStats;

      var demos = ((data && data.membres) || []).map(normalizeMember);
      state.membres = sb
        ? remote.length ? remote : demoParam ? demos : []
        : demos;

      var fUniv = document.getElementById('filterUniversite');
      var fDom = document.getElementById('filterDomaine');
      var fStatut = document.getElementById('filterStatut');
      var fQ = document.getElementById('filterQ');
      var fSort = document.getElementById('filterSort');
      var btnReset = document.getElementById('filterReset');
      var noteEl = document.getElementById('annuaireNote');

      var fVille = document.getElementById('filterVille');
      var fFil = document.getElementById('filterFiliere');
      var filiereList = document.getElementById('annuaireFiliereList');

      fillSelect(fUniv, unique(state.membres.map(function (m) { return m.universite; })).sort(), 'Toutes les universités');
      fillSelect(fDom, unique(state.membres.map(function (m) { return m.domaine; })).sort(), 'Tous les domaines');
      fillSelect(fStatut, unique(state.membres.map(function (m) { return m.statut; })).sort(), 'Tous les statuts');
      fillSelect(fVille, unique(state.membres.map(function (m) { return m.ville; })).sort(), 'Toutes les villes');
      if (filiereList) {
        filiereList.innerHTML = unique(state.membres.map(function (m) { return m.filiere; })).sort().map(function (f) {
          return '<option value="' + escapeHTML(f) + '">';
        }).join('');
      }

      try {
        var sp = new URLSearchParams(window.location.search);
        if (sp.get('domaine') && fDom) fDom.value = sp.get('domaine');
        if (sp.get('universite') && fUniv) fUniv.value = sp.get('universite');
        if (sp.get('statut') && fStatut) fStatut.value = sp.get('statut');
        if (sp.get('q') && fQ) fQ.value = sp.get('q');
        applyRefineFromUrl(sp);
      } catch (e) {}

      try {
        if (window.StudyAlreadyEvents) {
          window.StudyAlreadyEvents.setEvents(eventsList);
          window.StudyAlreadyEvents.setAuthUserId(state.authUserId);
        }
        buildMembersIndex();
        applyViewFromUrl();
        updateStats(state.communityStats);
        updateFollowCountEl();
        renderDomainBreakdown();
        renderRefineCounts();
        renderSuggestList(state.membres);
        bindProfileRowClicks();
        renderRecentSearches();

        if (noteEl && sb && remote.length) {
          noteEl.textContent = 'Données déclarées par les membres — sans vérification documentaire.';
        }

        render();
      } catch (bootErr) {
        console.error('StudyAlready annuaire init:', bootErr);
        grid.innerHTML = '<p class="text-center text-sm text-red-600 py-8">Erreur d’affichage. Rechargez la page.</p>';
      }
    }).catch(function (err) {
      grid.innerHTML = '<p class="text-center text-sm text-red-600 py-8">' + escapeHTML(err.message || 'Erreur.') + '</p>';
    });
  }

  window.SAAnnuaireRenderPager = renderPagination;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
