(function () {
  'use strict';

  var LEGAL_OUVERTURES = ['visa_titre_sejour', 'droit_etrangers_recours'];
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

  function colorFor(univ) {
    return UNIVERSITE_COLORS[univ] || '#94a3b8';
  }

  function initialsOf(prenom, initialNom) {
    var p = (prenom || '?').trim().charAt(0).toUpperCase();
    var n = (initialNom || '').replace(/[^A-Za-zÀ-ÿ]/g, '').charAt(0).toUpperCase();
    return n ? (p + n) : p;
  }

  function badgeStatut(statut) {
    if (statut === 'Diplômé·e / Professionnel·le') return 'bg-amber-100 text-amber-800';
    if (statut === 'Stagiaire') return 'bg-violet-100 text-violet-800';
    return 'bg-sky-100 text-sky-800';
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

  function isExpertLegal(m) {
    return m && m.statut === 'Diplômé·e / Professionnel·le' && isLegalMember(m);
  }

  function legalBadgesHtml(m) {
    var parts = [];
    var ouv = m.ouvertures || [];
    if (ouv.indexOf('visa_titre_sejour') !== -1) {
      parts.push('<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-semibold mr-1 mb-1">Visa / titre de séjour</span>');
    }
    if (ouv.indexOf('droit_etrangers_recours') !== -1) {
      parts.push('<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-semibold mr-1 mb-1">Droit des étrangers</span>');
    }
    if (m.tag_juridique && TAG_JURIDIQUE_LABELS[m.tag_juridique]) {
      parts.push('<span class="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold mr-1 mb-1">' + escapeHTML(TAG_JURIDIQUE_LABELS[m.tag_juridique]) + '</span>');
    }
    return parts.join('');
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

  function renderCard(m) {
    var color = colorFor(m.universite);
    var initiales = initialsOf(m.prenom, m.initial_nom);
    var specHTML = (m.specialites || []).slice(0, 3).map(function (s) {
      return '<span class="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 mr-1 mb-1">' + escapeHTML(s) + '</span>';
    }).join('');

    var linkedinHTML = '';
    var showLi = m.linkedin && (m.afficher_linkedin === true || typeof m.afficher_linkedin === 'undefined');
    if (showLi) {
      linkedinHTML = '<a href="' + escapeHTML(m.linkedin) + '" target="_blank" rel="noopener" class="inline-flex items-center justify-center gap-1 border border-slate-300 text-brand-dark font-semibold px-3 py-2 rounded-full text-xs hover:border-brand-gold">LinkedIn</a>';
    }
    var msgHref = 'mise-en-relation.html?id=' + encodeURIComponent(m.id) + '&nom=' + encodeURIComponent(m.prenom + ' ' + (m.initial_nom || ''));

    return '' +
      '<article class="relative bg-white rounded-2xl border border-slate-200 hover:border-brand-gold transition shadow-sm overflow-hidden flex flex-col">' +
        '<div class="h-1.5 w-full" style="background-color:' + color + '"></div>' +
        '<div class="p-5 flex-1 flex flex-col">' +
          '<div class="flex items-start gap-3">' +
            '<div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold font-display shrink-0" style="background-color:' + color + '">' + escapeHTML(initiales) + '</div>' +
            '<div class="min-w-0">' +
              '<h3 class="font-display font-bold text-brand-dark leading-tight truncate">' + escapeHTML(m.prenom + ' ' + (m.initial_nom || '')) + '</h3>' +
              '<p class="text-xs text-slate-500 truncate">' + escapeHTML(m.filiere || '') + ' · ' + escapeHTML(m.universite || '') + '</p>' +
              '<p class="text-xs text-slate-400 truncate">' + escapeHTML((m.annee || '') + (m.ville ? ' · ' + m.ville : '')) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="mt-3 flex flex-wrap gap-1"><span class="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ' + badgeStatut(m.statut) + '">' + escapeHTML(m.statut || '') + '</span>' + legalBadgesHtml(m) + '</div>' +
          '<p class="mt-3 text-sm text-slate-600 line-clamp-3 flex-1">' + escapeHTML(m.bio || '') + '</p>' +
          (specHTML ? '<div class="mt-3">' + specHTML + '</div>' : '') +
          '<div class="mt-4 flex gap-2 flex-wrap">' +
            '<a href="' + msgHref + '" class="inline-flex items-center justify-center gap-1 bg-brand-dark text-white font-semibold px-3 py-2 rounded-full text-xs hover:bg-brand-blue">Envoyer un message</a>' +
            linkedinHTML +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function unique(values) {
    var seen = {};
    var out = [];
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    }
    return out;
  }

  function fillSelect(selectEl, values, allLabel) {
    if (!selectEl) return;
    var html = '<option value="">' + allLabel + '</option>';
    for (var i = 0; i < values.length; i++) {
      html += '<option value="' + escapeHTML(values[i]) + '">' + escapeHTML(values[i]) + '</option>';
    }
    selectEl.innerHTML = html;
  }

  function matches(m, filters) {
    if (filters.universite && m.universite !== filters.universite) return false;
    if (filters.domaine && m.domaine !== filters.domaine) return false;
    if (filters.statut && m.statut !== filters.statut) return false;
    if (filters.aide === 'juridique' && !isLegalMember(m)) return false;
    if (filters.q) {
      var q = filters.q.toLowerCase();
      var hay = [
        m.prenom, m.initial_nom, m.filiere, m.universite, m.ville, m.bio,
        (m.specialites || []).join(' '),
        m.tag_juridique || '',
        TAG_JURIDIQUE_LABELS[m.tag_juridique] || ''
      ].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
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

  function renderExpertsSection(membres) {
    var grid = document.getElementById('annuaireExpertsGrid');
    var empty = document.getElementById('annuaireExpertsEmpty');
    if (!grid) return;
    var experts = membres.filter(isExpertLegal);
    if (experts.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    grid.innerHTML = experts.map(renderCard).join('');
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

  function fetchSupabaseProfiles() {
    var sb = window.studyalreadySb;
    if (!sb) return Promise.resolve({ list: [], denied: false });
    return sb.auth.getSession().then(function () {
      return sb.rpc('get_annuaire_profiles');
    }).then(function (res) {
      if (res.error) {
        console.warn('StudyAlready annuaire Supabase:', res.error.message);
        return { list: [], denied: false };
      }
      var raw = res.data;
      var denied = false;
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && Number(raw.schema_version) === 2) {
        denied = !!raw.denied;
        raw = raw.profiles;
      }
      var arr = parseProfilesPayload(raw);
      return { list: arr.map(normalizeMember), denied: denied };
    }).catch(function (e) {
      console.warn('StudyAlready annuaire Supabase:', e);
      return { list: [], denied: false };
    });
  }

  function init() {
    var grid = document.getElementById('annuaireGrid');
    var emptyEl = document.getElementById('annuaireEmpty');
    var countEl = document.getElementById('annuaireCount');
    var noteEl = document.getElementById('annuaireNote');
    var fUniv = document.getElementById('filterUniversite');
    var fDom = document.getElementById('filterDomaine');
    var fStatut = document.getElementById('filterStatut');
    var fQ = document.getElementById('filterQ');
    var fAide = document.getElementById('filterAide');
    var btnReset = document.getElementById('filterReset');

    if (!grid) return;

    grid.innerHTML = '<p class="col-span-full text-center text-sm text-slate-500 py-8">Chargement de l\'annuaire…</p>';

    var sb = window.studyalreadySb;
    var demoParam =
      typeof window !== 'undefined' &&
      String(window.location.search || '').indexOf('annuaire_demo=1') !== -1;

    Promise.all([
      fetch('assets/data/membres.json', { cache: 'no-cache' })
        .then(function (r) {
          return r.ok ? r.json() : { membres: [] };
        })
        .catch(function () {
          return { membres: [] };
        }),
      fetchSupabaseProfiles(),
    ]).then(function (pair) {
      var data = pair[0] || {};
      var remotePack = pair[1] || { list: [], denied: false };
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

      var demos = ((data && data.membres) || []).map(function (m) {
        return normalizeMember(m);
      });
      /* Source réelle : uniquement les profils Supabase publiés (RPC). Les entrées de membres.json
         ne servent que si ?annuaire_demo=1 (tests locaux / capture d'écran). */
      var membres = sb
        ? remote.length
          ? remote
          : demoParam
            ? demos
            : []
        : demos;

      var universites = unique(membres.map(function (m) { return m.universite; })).sort();
      var domaines = unique(membres.map(function (m) { return m.domaine; })).sort();
      var statuts = unique(membres.map(function (m) { return m.statut; }));

      fillSelect(fUniv, universites, 'Toutes les universités');
      fillSelect(fDom, domaines, 'Tous les domaines');
      fillSelect(fStatut, statuts, 'Tous les statuts');

      try {
        var sp = new URLSearchParams(window.location.search);
        var qDom = sp.get('domaine');
        var qUniv = sp.get('universite');
        var qStat = sp.get('statut');
        var qSearch = sp.get('q');
        var qAide = sp.get('aide');
        if (qDom && fDom) fDom.value = qDom;
        if (qUniv && fUniv) fUniv.value = qUniv;
        if (qStat && fStatut) fStatut.value = qStat;
        if (qSearch && fQ) fQ.value = qSearch;
        if (qAide === 'juridique' && fAide) fAide.value = 'juridique';
      } catch (e) {}

      function render() {
        var filters = {
          universite: fUniv ? fUniv.value : '',
          domaine: fDom ? fDom.value : '',
          statut: fStatut ? fStatut.value : '',
          aide: fAide ? fAide.value : '',
          q: fQ ? fQ.value.trim() : ''
        };
        updateLegalNotice(filters.aide === 'juridique');
        var filtered = membres.filter(function (m) { return matches(m, filters); });
        if (filtered.length === 0) {
          grid.innerHTML = '';
          if (emptyEl) {
            emptyEl.classList.remove('hidden');
            var emptyP = emptyEl.querySelector('p');
            if (emptyP) {
              if (membres.length === 0) {
                emptyP.textContent =
                  'Aucun membre pour le moment. Les fiches apparaissent ici après envoi du formulaire « Créer mon profil », avec le consentement du membre.';
              } else if (filters.aide === 'juridique') {
                emptyP.textContent =
                  'Aucun profil juridique / visa pour ces critères. Consultez « Besoin d’aide ? » pour CIRÉ, aide juridique gratuite (BAJ) et avocats.be.';
              } else {
                emptyP.textContent = 'Aucun membre ne correspond à ces filtres pour le moment.';
              }
            }
          }
        } else {
          if (emptyEl) emptyEl.classList.add('hidden');
          grid.innerHTML = filtered.map(renderCard).join('');
        }
        if (countEl) countEl.textContent = filtered.length + ' membre' + (filtered.length > 1 ? 's' : '');
      }

      [fUniv, fDom, fStatut, fAide].forEach(function (el) { if (el) el.addEventListener('change', render); });
      if (fQ) fQ.addEventListener('input', render);
      if (btnReset) btnReset.addEventListener('click', function () {
        if (fUniv) fUniv.value = '';
        if (fDom) fDom.value = '';
        if (fStatut) fStatut.value = '';
        if (fAide) fAide.value = '';
        if (fQ) fQ.value = '';
        updateLegalNotice(false);
        render();
      });
      renderExpertsSection(membres);

      if (noteEl) {
        if (sb) {
          if (remote.length) {
            noteEl.textContent =
              remote.length +
              ' profil' +
              (remote.length > 1 ? 's' : '') +
              ' publié' +
              (remote.length > 1 ? 's' : '') +
              ' (données déclarées par les membres, sans vérification documentaire par StudyAlready).';
          } else {
            noteEl.textContent =
              'Les profils affichés proviennent du formulaire « Créer mon profil », avec le consentement de chaque membre.';
          }
        } else {
          noteEl.textContent =
            'Chargement temporairement indisponible. Réessayez dans quelques instants ou contactez-nous si le problème persiste.';
          if (data._note) noteEl.textContent += ' ' + data._note;
        }
      }
      render();
    }).catch(function (err) {
      grid.innerHTML = '<p class="col-span-full text-center text-sm text-red-600 py-8">' + escapeHTML(err.message || 'Erreur de chargement.') + '</p>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
