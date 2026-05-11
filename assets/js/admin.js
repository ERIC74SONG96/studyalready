/**
 * StudyAlready — Dashboard admin
 * Lit form_submissions et profiles dans Supabase via les RLS policies "is_admin()".
 */
(function () {
  'use strict';

  var c = window.STUDYALREADY_CONFIG || {};
  var sb = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'studyalready-admin' }
      })
    : null;

  var $ = function (id) { return document.getElementById(id); };
  var gate = $('adminGate');
  var app = $('adminApp');

  function showFatal(msg) {
    gate.classList.remove('hidden');
    gate.innerHTML = '<div class="text-center"><p class="text-red-600 font-semibold mb-3">' + escapeHtml(msg) + '</p>' +
      '<a href="admin-login.html" class="underline text-brand-dark">Retour à la connexion</a></div>';
  }

  if (!sb) { showFatal('Client Supabase indisponible (bloqueur de pub ?).'); return; }

  // -------------------- Helpers --------------------

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var FORM_TYPE_LABELS = {
    'contact': 'Contact',
    'prequalification': 'Pré-qualification',
    'rejoindre-reseau': 'Réseau',
    'mise-en-relation': 'Mise en relation',
    'rapport-admission': 'Rapport admission',
    'chasseur-billet': 'Chasseur de billets',
    'departs-groupes': 'Départs groupés'
  };
  function labelType(t) { return FORM_TYPE_LABELS[t] || t || '—'; }

  var STATUS_BADGES = {
    'new':         { label: 'À traiter', cls: 'bg-amber-100 text-amber-800' },
    'in_progress': { label: 'En cours',  cls: 'bg-blue-100 text-blue-800' },
    'processed':   { label: 'Traité',    cls: 'bg-emerald-100 text-emerald-800' },
    'archived':    { label: 'Archivé',   cls: 'bg-slate-200 text-slate-600' }
  };
  function badgeStatus(s) {
    var b = STATUS_BADGES[s] || { label: s || '—', cls: 'bg-slate-100 text-slate-600' };
    return '<span class="inline-block text-xs font-semibold px-2 py-0.5 rounded ' + b.cls + '">' + escapeHtml(b.label) + '</span>';
  }

  var PROFILE_STATUS_BADGES = {
    'pending':   { label: 'En attente', cls: 'bg-amber-100 text-amber-800' },
    'published': { label: 'Publié',     cls: 'bg-emerald-100 text-emerald-800' },
    'rejected':  { label: 'Rejeté',     cls: 'bg-rose-100 text-rose-800' }
  };
  function badgeProfileStatus(s) {
    var b = PROFILE_STATUS_BADGES[s] || { label: s || '—', cls: 'bg-slate-100 text-slate-600' };
    return '<span class="inline-block text-xs font-semibold px-2 py-0.5 rounded ' + b.cls + '">' + escapeHtml(b.label) + '</span>';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mn = String(d.getMinutes()).padStart(2, '0');
    return dd + '/' + mm + ' ' + hh + ':' + mn;
  }

  // -------------------- Auth gate --------------------

  sb.auth.getSession().then(function (r) {
    var session = r && r.data && r.data.session;
    if (!session) { window.location.replace('admin-login.html'); return; }
    sb.rpc('is_admin').then(function (a) {
      if (a.error || !a.data) {
        sb.auth.signOut().then(function () { window.location.replace('admin-login.html'); });
        return;
      }
      $('adminWho').textContent = session.user.email || '';
      gate.classList.add('hidden');
      app.classList.remove('hidden');
      initApp();
    });
  });

  $('logoutBtn').addEventListener('click', function () {
    sb.auth.signOut().then(function () { window.location.replace('admin-login.html'); });
  });

  // -------------------- Onglets --------------------

  function setTab(name) {
    document.querySelectorAll('.admin-tab').forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === name;
      btn.classList.toggle('border-brand-blue', active);
      btn.classList.toggle('text-brand-dark', active);
      btn.classList.toggle('border-transparent', !active);
      btn.classList.toggle('text-slate-500', !active);
    });
    $('tabSubs').classList.toggle('hidden', name !== 'subs');
    $('tabProfiles').classList.toggle('hidden', name !== 'profiles');
    if (name === 'profiles') loadProfiles();
  }

  function initApp() {
    document.querySelectorAll('.admin-tab').forEach(function (btn) {
      btn.addEventListener('click', function () { setTab(btn.getAttribute('data-tab')); });
    });
    $('refreshSubs').addEventListener('click', loadSubmissions);
    $('refreshProfiles').addEventListener('click', loadProfiles);
    $('filterFormType').addEventListener('change', loadSubmissions);
    $('filterStatus').addEventListener('change', loadSubmissions);
    $('filterSearch').addEventListener('input', debounce(loadSubmissions, 250));
    $('filterProfileStatus').addEventListener('change', loadProfiles);
    $('filterProfileSearch').addEventListener('input', debounce(loadProfiles, 250));
    $('subModalClose').addEventListener('click', closeSubModal);
    $('subModal').addEventListener('click', function (e) {
      if (e.target.id === 'subModal') closeSubModal();
    });
    loadStats();
    loadSubmissions();
  }

  function debounce(fn, ms) {
    var t; return function () {
      var a = arguments, ctx = this; clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, a); }, ms);
    };
  }

  // -------------------- Stats --------------------

  function loadStats() {
    Promise.all([
      sb.from('form_submissions').select('id', { count: 'exact', head: true }),
      sb.from('form_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'published')
    ]).then(function (rs) {
      $('statTotalSubs').textContent = rs[0].count != null ? rs[0].count : '—';
      $('statNewSubs').textContent = rs[1].count != null ? rs[1].count : '—';
      $('statPendingProfiles').textContent = rs[2].count != null ? rs[2].count : '—';
      $('statPublishedProfiles').textContent = rs[3].count != null ? rs[3].count : '—';
    });
  }

  // -------------------- Demandes (form_submissions) --------------------

  function loadSubmissions() {
    var tbody = $('subsTbody');
    tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>';

    var q = sb.from('form_submissions').select('*').order('created_at', { ascending: false }).limit(200);
    var ft = $('filterFormType').value;
    var st = $('filterStatus').value;
    var search = $('filterSearch').value.trim();
    if (ft) q = q.eq('form_type', ft);
    if (st) q = q.eq('status', st);
    if (search) {
      var pattern = '%' + search.replace(/[%_]/g, '\\$&') + '%';
      q = q.or('nom.ilike.' + pattern + ',email.ilike.' + pattern);
    }

    q.then(function (r) {
      if (r.error) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-6 text-center text-red-600">' + escapeHtml(r.error.message) + '</td></tr>';
        return;
      }
      var rows = r.data || [];
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-6 text-center text-slate-500">Aucune demande pour ces filtres.</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(function (row) {
        return '<tr class="border-t border-slate-100 hover:bg-slate-50">' +
          '<td class="px-3 py-2 whitespace-nowrap text-slate-600">' + escapeHtml(fmtDate(row.created_at)) + '</td>' +
          '<td class="px-3 py-2"><span class="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded">' + escapeHtml(labelType(row.form_type)) + '</span></td>' +
          '<td class="px-3 py-2 font-semibold text-brand-dark">' + escapeHtml(row.nom || '—') + '</td>' +
          '<td class="px-3 py-2 text-slate-600">' + escapeHtml(row.email || '—') + '</td>' +
          '<td class="px-3 py-2 text-slate-600">' + escapeHtml(row.whatsapp || '—') + '</td>' +
          '<td class="px-3 py-2">' + badgeStatus(row.status) + '</td>' +
          '<td class="px-3 py-2 text-right"><button data-id="' + row.id + '" class="open-sub text-brand-blue hover:underline text-xs font-semibold">Voir</button></td>' +
          '</tr>';
      }).join('');

      tbody.querySelectorAll('.open-sub').forEach(function (b) {
        b.addEventListener('click', function () { openSubModal(b.getAttribute('data-id'), rows); });
      });
      loadStats();
    });
  }

  // -------------------- Modal détail --------------------

  function openSubModal(id, rows) {
    var row = rows.find(function (r) { return r.id === id; });
    if (!row) return;
    var body = $('subModalBody');
    var actions = $('subModalActions');

    var payloadRows = '';
    if (row.payload && typeof row.payload === 'object') {
      Object.keys(row.payload).forEach(function (k) {
        var v = row.payload[k];
        if (Array.isArray(v)) v = v.join(', ');
        if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
        payloadRows += '<div class="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">' +
          '<div class="text-slate-500 text-xs uppercase">' + escapeHtml(k) + '</div>' +
          '<div class="col-span-2 whitespace-pre-wrap break-words">' + escapeHtml(String(v == null ? '' : v)) + '</div>' +
          '</div>';
      });
    }

    body.innerHTML =
      '<div class="flex flex-wrap gap-2 items-center">' +
        '<span class="text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded">' + escapeHtml(labelType(row.form_type)) + '</span>' +
        badgeStatus(row.status) +
        '<span class="text-xs text-slate-500">' + escapeHtml(fmtDate(row.created_at)) + '</span>' +
      '</div>' +
      '<div class="mt-3"><strong>' + escapeHtml(row.nom || '—') + '</strong> · ' +
        (row.email ? '<a class="underline text-brand-blue" href="mailto:' + escapeHtml(row.email) + '">' + escapeHtml(row.email) + '</a>' : '—') +
        (row.whatsapp ? ' · <a class="underline text-brand-blue" target="_blank" rel="noopener" href="https://wa.me/' + escapeHtml(String(row.whatsapp).replace(/[^\d]/g, '')) + '">WhatsApp</a>' : '') +
      '</div>' +
      (row.subject ? '<div class="mt-2 text-slate-700"><span class="text-xs uppercase text-slate-500">Sujet</span><br>' + escapeHtml(row.subject) + '</div>' : '') +
      '<div class="mt-4"><p class="text-xs uppercase text-slate-500 mb-1">Contenu du formulaire</p>' +
        '<div class="bg-slate-50 rounded-lg p-3">' + (payloadRows || '<p class="text-slate-500 text-sm">Aucun champ.</p>') + '</div>' +
      '</div>' +
      (row.origin_url ? '<p class="mt-3 text-xs text-slate-500">Reçu depuis : <a class="underline" target="_blank" rel="noopener" href="' + escapeHtml(row.origin_url) + '">' + escapeHtml(row.origin_url) + '</a></p>' : '');

    actions.innerHTML = '';
    ['new', 'in_progress', 'processed', 'archived'].forEach(function (s) {
      if (s === row.status) return;
      var lbl = STATUS_BADGES[s].label;
      var btn = document.createElement('button');
      btn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50';
      btn.textContent = 'Marquer : ' + lbl;
      btn.addEventListener('click', function () { updateSubStatus(row.id, s); });
      actions.appendChild(btn);
    });
    var delBtn = document.createElement('button');
    delBtn.className = 'text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100';
    delBtn.textContent = 'Supprimer';
    delBtn.addEventListener('click', function () { deleteSub(row.id); });
    actions.appendChild(delBtn);

    $('subModal').classList.remove('hidden');
  }

  function closeSubModal() { $('subModal').classList.add('hidden'); }

  function updateSubStatus(id, status) {
    sb.from('form_submissions').update({ status: status }).eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      closeSubModal(); loadSubmissions();
    });
  }

  function deleteSub(id) {
    if (!confirm('Supprimer définitivement cette demande ?')) return;
    sb.from('form_submissions').delete().eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      closeSubModal(); loadSubmissions();
    });
  }

  // -------------------- Profils annuaire --------------------

  function loadProfiles() {
    var grid = $('profilesGrid');
    grid.innerHTML = '<p class="col-span-full text-center text-slate-500 py-6">Chargement…</p>';

    var q = sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
    var st = $('filterProfileStatus').value;
    var search = $('filterProfileSearch').value.trim();
    if (st) q = q.eq('status', st);
    if (search) {
      var pattern = '%' + search.replace(/[%_]/g, '\\$&') + '%';
      q = q.or('nom.ilike.' + pattern + ',prenom.ilike.' + pattern + ',universite.ilike.' + pattern + ',ville.ilike.' + pattern);
    }

    q.then(function (r) {
      if (r.error) {
        grid.innerHTML = '<p class="col-span-full text-center text-red-600 py-6">' + escapeHtml(r.error.message) + '</p>';
        return;
      }
      var rows = r.data || [];
      if (!rows.length) {
        grid.innerHTML = '<p class="col-span-full text-center text-slate-500 py-6">Aucun profil pour ces filtres.</p>';
        return;
      }
      grid.innerHTML = rows.map(renderProfileCard).join('');
      grid.querySelectorAll('[data-publish]').forEach(function (b) {
        b.addEventListener('click', function () { setProfileStatus(b.getAttribute('data-publish'), 'published'); });
      });
      grid.querySelectorAll('[data-reject]').forEach(function (b) {
        b.addEventListener('click', function () { setProfileStatus(b.getAttribute('data-reject'), 'rejected'); });
      });
      grid.querySelectorAll('[data-pending]').forEach(function (b) {
        b.addEventListener('click', function () { setProfileStatus(b.getAttribute('data-pending'), 'pending'); });
      });
      grid.querySelectorAll('[data-delete]').forEach(function (b) {
        b.addEventListener('click', function () { deleteProfile(b.getAttribute('data-delete')); });
      });
      loadStats();
    });
  }

  function renderProfileCard(p) {
    var full = [p.prenom, p.nom].filter(Boolean).join(' ') || '—';
    var meta = [p.universite, p.filiere, p.ville].filter(Boolean).join(' · ');
    return '<article class="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">' +
      '<div class="flex items-center justify-between gap-2">' +
        '<h3 class="font-display font-bold text-brand-dark text-sm">' + escapeHtml(full) + '</h3>' +
        badgeProfileStatus(p.status) +
      '</div>' +
      '<p class="text-xs text-slate-500">' + escapeHtml(meta) + '</p>' +
      (p.statut ? '<p class="text-xs"><span class="bg-slate-100 px-2 py-0.5 rounded">' + escapeHtml(p.statut) + '</span></p>' : '') +
      '<p class="text-xs text-slate-600 line-clamp-3">' + escapeHtml(p.specialites || p.bio || '') + '</p>' +
      '<dl class="text-xs text-slate-500 space-y-0.5 mt-1">' +
        (p.email ? '<div><strong class="text-slate-700">Email :</strong> ' + escapeHtml(p.email) + '</div>' : '') +
        (p.whatsapp ? '<div><strong class="text-slate-700">WhatsApp :</strong> ' + escapeHtml(p.whatsapp) + '</div>' : '') +
        (p.linkedin ? '<div><strong class="text-slate-700">LinkedIn :</strong> ' + escapeHtml(p.linkedin) + '</div>' : '') +
        '<div><strong class="text-slate-700">Reçu :</strong> ' + escapeHtml(fmtDate(p.created_at)) + '</div>' +
      '</dl>' +
      '<div class="flex flex-wrap gap-1 mt-2">' +
        (p.status !== 'published' ? '<button data-publish="' + p.id + '" class="text-xs font-semibold px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">Publier</button>' : '') +
        (p.status !== 'rejected' ? '<button data-reject="' + p.id + '" class="text-xs font-semibold px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100">Rejeter</button>' : '') +
        (p.status !== 'pending' ? '<button data-pending="' + p.id + '" class="text-xs font-semibold px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">Remettre en attente</button>' : '') +
        '<button data-delete="' + p.id + '" class="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">Supprimer</button>' +
      '</div>' +
      '</article>';
  }

  function setProfileStatus(id, status) {
    sb.from('profiles').update({ status: status }).eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      loadProfiles();
    });
  }

  function deleteProfile(id) {
    if (!confirm('Supprimer définitivement ce profil ?')) return;
    sb.from('profiles').delete().eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      loadProfiles();
    });
  }
})();
