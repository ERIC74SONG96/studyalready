/**
 * StudyAlready — Dashboard admin
 * Lit form_submissions et profiles dans Supabase via les RLS policies "is_admin()".
 */
(function () {
  'use strict';

  var c = window.STUDYALREADY_CONFIG || {};
  if (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY ||
      String(c.SUPABASE_URL).indexOf('REMPLACER') !== -1 ||
      String(c.SUPABASE_ANON_KEY).indexOf('REMPLACER') !== -1) {
    if (gate) {
      gate.classList.remove('hidden');
      gate.innerHTML = '<div class="text-center max-w-md mx-auto px-4"><p class="text-red-600 font-semibold mb-2">Configuration Supabase absente ou invalide.</p><p class="text-sm text-slate-600 mb-3">Vérifiez <code class="text-xs bg-slate-100 px-1 rounded">assets/js/config.js</code> (SUPABASE_URL et SUPABASE_ANON_KEY).</p><a href="admin-login.html" class="underline text-brand-dark">Retour</a></div>';
    }
    return;
  }
  var sb = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
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
  /* Plusieurs lectures getSession() espacées : avec le bundle UMD, INITIAL_SESSION
     peut ne pas se déclencher comme attendu → écran bloqué sur « Vérification… ». */

  var gateDecided = false;

  function runAdminGate(session) {
    if (gateDecided) return;
    gateDecided = true;
    if (!session) {
      window.location.replace('admin-login.html');
      return;
    }
    sb.rpc('is_admin').then(function (a) {
      if (a.error) {
        gate.classList.remove('hidden');
        gate.innerHTML = '<div class="text-center max-w-md mx-auto px-4"><p class="text-red-600 font-semibold mb-2">' +
          escapeHtml(a.error.message || 'Erreur de vérification des droits.') + '</p>' +
          '<p class="text-sm text-slate-600 mb-3">Si le message parle d’une fonction manquante, exécutez le script SQL <code class="text-xs bg-slate-100 px-1 rounded">003_admin_dashboard.sql</code> dans Supabase.</p>' +
          '<a href="admin-login.html" class="underline text-brand-dark">Retour à la connexion</a></div>';
        return;
      }
      if (a.data !== true) {
        sb.auth.signOut().then(function () {
          window.location.replace('admin-login.html?raison=non-admin');
        });
        return;
      }
      $('adminWho').textContent = session.user.email || '';
      gate.classList.add('hidden');
      app.classList.remove('hidden');
      initApp();
    });
  }

  function probeSession(retryIndex) {
    sb.auth.getSession().then(function (r) {
      if (gateDecided) return;
      var session = r && r.data && r.data.session;
      if (session) {
        runAdminGate(session);
        return;
      }
      if (retryIndex >= 2) {
        runAdminGate(null);
        return;
      }
      var waitMs = retryIndex === 0 ? 400 : 900;
      setTimeout(function () {
        probeSession(retryIndex + 1);
      }, waitMs);
    });
  }

  probeSession(0);

  function clearAdminAuthLocalStorage() {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('sb-') !== 0) continue;
        if (k.indexOf('auth-token') !== -1 || k.indexOf('auth-code') !== -1) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  $('logoutBtn').addEventListener('click', function () {
    var lo = $('logoutBtn');
    if (lo) lo.disabled = true;
    Promise.resolve()
      .then(function () {
        return sb.auth.signOut({ scope: 'local' });
      })
      .catch(function () {})
      .then(function () {
        var u = c.SUPABASE_URL;
        if (u) {
          try {
            var host = String(u).replace(/^https?:\/\//i, '').split('/')[0];
            var ref = host.split('.')[0];
            if (ref) {
              var prefix = 'sb-' + ref + '-';
              for (var j = localStorage.length - 1; j >= 0; j--) {
                var k2 = localStorage.key(j);
                if (k2 && k2.indexOf(prefix) === 0) localStorage.removeItem(k2);
              }
            }
          } catch (e2) {}
        }
        clearAdminAuthLocalStorage();
        try {
          sb.auth.signOut({ scope: 'global' });
        } catch (e3) {}
        window.location.replace('admin-login.html');
      });
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
    var tabStudents = $('tabStudents'); if (tabStudents) tabStudents.classList.toggle('hidden', name !== 'students');
    if (name === 'profiles') loadProfiles();
    if (name === 'students') loadStudents();
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
    var refreshStudents = $('refreshStudents');
    if (refreshStudents) refreshStudents.addEventListener('click', loadStudents);
    var filterStudentSearch = $('filterStudentSearch');
    if (filterStudentSearch) filterStudentSearch.addEventListener('input', debounce(loadStudents, 250));
    var studentClose = $('studentModalClose');
    if (studentClose) studentClose.addEventListener('click', closeStudentModal);
    var studentModal = $('studentModal');
    if (studentModal) studentModal.addEventListener('click', function (e) {
      if (e.target.id === 'studentModal') closeStudentModal();
    });
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

  // -------------------- Étudiants (comptes) --------------------

  function loadStudents() {
    var tbody = $('studentsTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-6 text-center text-slate-500">Chargement…</td></tr>';

    var q = sb.from('admin_students_view').select('*').order('signup_date', { ascending: false }).limit(500);
    var searchEl = $('filterStudentSearch');
    var search = searchEl ? searchEl.value.trim() : '';
    if (search) {
      var pattern = '%' + search.replace(/[%_]/g, '\\$&') + '%';
      q = q.or('email.ilike.' + pattern + ',full_name.ilike.' + pattern);
    }

    q.then(function (r) {
      if (r.error) {
        var msg = r.error.message || '';
        if (/admin_students_view/i.test(msg) || /relation .* does not exist/i.test(msg)) {
          msg = 'La vue admin_students_view n’existe pas encore. Exécutez la migration <code class="bg-slate-100 px-1 rounded text-xs">006_student_dossiers.sql</code> dans Supabase.';
        }
        tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-6 text-center text-red-600">' + msg + '</td></tr>';
        return;
      }
      var rows = r.data || [];
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-6 text-center text-slate-500">Aucun étudiant inscrit pour le moment.</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(function (row) {
        var progress = '—';
        if (row.total_steps) {
          var pct = Math.round(((row.current_step || 0) / row.total_steps) * 100);
          progress = '<div class="flex items-center gap-2"><div class="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">' +
            '<div class="h-full bg-brand-gold" style="width:' + pct + '%"></div></div>' +
            '<span class="text-xs text-slate-600">' + row.current_step + '/' + row.total_steps + '</span></div>';
        }
        var unread = row.unread_from_student ? '<span class="ml-1 inline-block bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">' + row.unread_from_student + '</span>' : '';
        return '<tr class="border-t border-slate-100 hover:bg-slate-50">' +
          '<td class="px-3 py-2 whitespace-nowrap text-slate-600">' + escapeHtml(fmtDate(row.signup_date)) + '</td>' +
          '<td class="px-3 py-2 font-semibold text-brand-dark">' + escapeHtml(row.full_name || '—') + unread + '</td>' +
          '<td class="px-3 py-2 text-slate-600">' + escapeHtml(row.email || '—') + '</td>' +
          '<td class="px-3 py-2"><span class="text-xs bg-slate-100 px-2 py-0.5 rounded">' + escapeHtml(row.dossier_type || '—') + '</span></td>' +
          '<td class="px-3 py-2">' + progress + '</td>' +
          '<td class="px-3 py-2 text-right"><button data-user="' + escapeHtml(row.user_id) + '" class="open-student text-brand-blue hover:underline text-xs font-semibold">Ouvrir</button></td>' +
          '</tr>';
      }).join('');
      tbody.querySelectorAll('.open-student').forEach(function (b) {
        b.addEventListener('click', function () { openStudentModal(b.getAttribute('data-user')); });
      });
    });
  }

  function openStudentModal(userId) {
    var modal = $('studentModal');
    var body = $('studentModalBody');
    var title = $('studentModalTitle');
    body.innerHTML = '<p class="text-slate-500">Chargement…</p>';
    modal.classList.remove('hidden');

    Promise.all([
      sb.from('admin_students_view').select('*').eq('user_id', userId).maybeSingle(),
      sb.from('student_dossiers').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      sb.from('dossier_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      sb.from('dossier_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      sb.from('form_submissions').select('id, form_type, status, subject, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    ]).then(function (rs) {
      var info = rs[0].data || {};
      var dossiers = rs[1].data || [];
      var messages = rs[2].data || [];
      var docs = rs[3].data || [];
      var subs = rs[4].data || [];

      title.textContent = (info.full_name || info.email || 'Étudiant') + ' — Dossier';

      var dossiersHtml = dossiers.map(renderAdminDossierBlock).join('') ||
        '<p class="text-sm text-slate-500">Aucun dossier ouvert pour cet étudiant.</p>';

      var subsHtml = subs.length
        ? '<ul class="text-sm divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">' +
          subs.map(function (s) {
            return '<li class="px-3 py-2 flex items-center justify-between">' +
              '<span><span class="text-xs bg-slate-100 px-2 py-0.5 rounded mr-2">' + escapeHtml(labelType(s.form_type)) + '</span>' +
              escapeHtml(s.subject || '') + '</span>' +
              '<span class="text-xs text-slate-500">' + escapeHtml(fmtDate(s.created_at)) + ' · ' + badgeStatus(s.status) + '</span>' +
              '</li>';
          }).join('') + '</ul>'
        : '<p class="text-sm text-slate-500">Aucune demande envoyée depuis ce compte.</p>';

      var docsHtml = docs.length
        ? '<ul class="text-sm space-y-1.5">' + docs.map(function (d) {
          return '<li class="flex items-center justify-between gap-2">' +
            '<span>📄 ' + escapeHtml(d.filename) + ' <span class="text-xs text-slate-500">(' + (d.uploaded_by === 'admin' ? 'admin' : 'étudiant') + ', ' + fmtDate(d.created_at) + ')</span></span>' +
            '<button data-doc-path="' + escapeHtml(d.storage_path) + '" class="admin-doc-download text-brand-blue hover:underline text-xs font-semibold">Télécharger</button>' +
            '</li>';
        }).join('') + '</ul>'
        : '<p class="text-sm text-slate-500">Aucun document partagé.</p>';

      var msgsHtml = messages.length
        ? '<div class="space-y-2 max-h-64 overflow-y-auto bg-slate-50 p-3 rounded-lg border border-slate-200">' +
          messages.map(function (m) {
            var isAdmin = m.sender === 'admin';
            return '<div class="flex ' + (isAdmin ? 'justify-end' : 'justify-start') + '">' +
              '<div class="max-w-[80%] rounded-2xl px-3 py-2 text-sm ' + (isAdmin ? 'bg-brand-dark text-white' : 'bg-white border border-slate-200') + '">' +
              '<p class="whitespace-pre-wrap break-words">' + escapeHtml(m.message) + '</p>' +
              '<p class="text-[10px] mt-1 ' + (isAdmin ? 'text-slate-300' : 'text-slate-400') + '">' + escapeHtml(fmtDate(m.created_at)) + '</p>' +
              '</div></div>';
          }).join('') + '</div>'
        : '<p class="text-sm text-slate-500 mb-2">Aucun message échangé pour le moment.</p>';

      body.innerHTML =
        '<div class="bg-slate-50 rounded-lg p-3 text-sm border border-slate-200">' +
          '<p><strong>' + escapeHtml(info.full_name || '—') + '</strong>' +
          (info.email ? ' · <a class="underline text-brand-blue" href="mailto:' + escapeHtml(info.email) + '">' + escapeHtml(info.email) + '</a>' : '') +
          '</p>' +
          '<p class="text-xs text-slate-500 mt-1">Inscrit le ' + escapeHtml(fmtDate(info.signup_date)) + '</p>' +
        '</div>' +

        '<div><h4 class="font-display font-bold text-brand-dark mb-2 text-sm">📂 Dossier(s) et étapes</h4>' + dossiersHtml + '</div>' +
        (dossiers.findIndex(function(d){return d.type==='equivalence_fwb';}) === -1
          ? '<button id="btnCreateFwb" data-user="' + escapeHtml(userId) + '" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-dark text-white hover:bg-brand-blue">Créer un dossier équivalence FWB</button>'
          : '') +

        '<div><h4 class="font-display font-bold text-brand-dark mb-2 text-sm mt-4">💬 Messages</h4>' + msgsHtml +
          '<form id="adminMessageForm" class="mt-2 flex gap-2">' +
            '<textarea id="adminMessageInput" rows="2" placeholder="Répondre à l\'étudiant…" class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"></textarea>' +
            '<button type="submit" class="bg-brand-dark hover:bg-brand-blue text-white font-semibold px-4 rounded-lg text-sm">Envoyer</button>' +
          '</form>' +
          '<p id="adminMessageStatus" class="text-xs text-slate-500 mt-1 hidden"></p>' +
        '</div>' +

        '<div><h4 class="font-display font-bold text-brand-dark mb-2 text-sm mt-4">📎 Documents</h4>' + docsHtml +
          '<form id="adminUploadForm" class="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200">' +
            '<label class="block text-xs font-semibold text-slate-600 mb-1">Téléverser un document pour cet étudiant</label>' +
            '<div class="flex gap-2">' +
              '<input id="adminUploadFile" type="file" accept="application/pdf,image/*,.doc,.docx" class="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />' +
              '<button type="submit" class="bg-brand-gold hover:bg-yellow-500 text-brand-dark font-bold px-3 rounded-lg text-sm">Envoyer</button>' +
            '</div>' +
            '<p id="adminUploadStatus" class="text-xs text-slate-500 mt-2 hidden"></p>' +
          '</form>' +
        '</div>' +

        '<div><h4 class="font-display font-bold text-brand-dark mb-2 text-sm mt-4">📋 Demandes du formulaire</h4>' + subsHtml + '</div>';

      bindStudentModalActions(userId);
    });
  }

  function renderAdminDossierBlock(d) {
    return '<details class="mb-2 border border-slate-200 rounded-lg" open>' +
      '<summary class="cursor-pointer px-3 py-2 bg-slate-50 text-sm font-semibold text-brand-dark flex items-center justify-between">' +
      '<span>' + escapeHtml(d.title || d.type) + ' — ' + escapeHtml(d.status) + '</span>' +
      '<span class="text-xs text-slate-500">' + (d.current_step || 0) + '/' + (d.total_steps || '?') + '</span>' +
      '</summary>' +
      '<div class="p-3 text-sm">' +
        (d.notes ? '<p class="text-xs italic text-slate-600 mb-2">Note actuelle (visible par l\'étudiant) : ' + escapeHtml(d.notes) + '</p>' : '') +
        '<div data-steps-for="' + escapeHtml(d.id) + '" class="space-y-1 text-xs text-slate-500">Chargement des étapes…</div>' +
      '</div>' +
      '</details>';
  }

  function bindStudentModalActions(userId) {
    /* Charge les étapes pour chaque dossier */
    document.querySelectorAll('[data-steps-for]').forEach(function (el) {
      var dossierId = el.getAttribute('data-steps-for');
      sb.from('dossier_steps').select('*').eq('dossier_id', dossierId).order('step_number').then(function (r) {
        if (r.error) { el.innerHTML = '<span class="text-red-600">' + escapeHtml(r.error.message) + '</span>'; return; }
        var rows = r.data || [];
        el.innerHTML = rows.map(function (s) {
          var cls = s.status === 'done' ? 'text-green-700' : s.status === 'in_progress' ? 'text-amber-700' : s.status === 'blocked' ? 'text-red-700' : 'text-slate-500';
          var sel = ['pending','in_progress','done','blocked'].map(function (v) {
            return '<option value="' + v + '"' + (s.status === v ? ' selected' : '') + '>' + v + '</option>';
          }).join('');
          return '<div class="flex items-center gap-2 py-1 border-t border-slate-100">' +
            '<span class="' + cls + ' font-semibold">' + s.step_number + '.</span>' +
            '<span class="flex-1">' + escapeHtml(s.title) + '</span>' +
            '<select class="text-xs border border-slate-200 rounded px-1 py-0.5" data-step-id="' + s.id + '">' + sel + '</select>' +
            '</div>';
        }).join('') || '<span class="text-xs text-slate-500">Aucune étape.</span>';

        el.querySelectorAll('[data-step-id]').forEach(function (selEl) {
          selEl.addEventListener('change', function () {
            var stepId = selEl.getAttribute('data-step-id');
            var newStatus = selEl.value;
            var patch = { status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null };
            sb.from('dossier_steps').update(patch).eq('id', stepId).then(function (rr) {
              if (rr.error) { alert(rr.error.message); return; }
              /* Rafraîchit dossier_steps + recalcule current_step côté dossier */
              sb.from('dossier_steps').select('status, step_number').eq('dossier_id', dossierId).order('step_number').then(function (rs) {
                var done = (rs.data || []).filter(function (x) { return x.status === 'done'; }).length;
                sb.from('student_dossiers').update({ current_step: done, updated_at: new Date().toISOString() }).eq('id', dossierId).then(function () {
                  loadStudents();
                });
              });
            });
          });
        });
      });
    });

    /* Création d'un dossier FWB */
    var btnFwb = $('btnCreateFwb');
    if (btnFwb) {
      btnFwb.addEventListener('click', function () {
        if (!confirm('Créer un nouveau dossier équivalence FWB pour cet étudiant ?')) return;
        sb.rpc('create_fwb_dossier', { target_user: userId }).then(function (r) {
          if (r.error) { alert(r.error.message); return; }
          openStudentModal(userId);
        });
      });
    }

    /* Envoi message admin */
    var form = $('adminMessageForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('adminMessageInput');
        var status = $('adminMessageStatus');
        var text = (input.value || '').trim();
        if (!text) return;
        status.classList.remove('hidden'); status.textContent = 'Envoi…';
        sb.from('dossier_messages').insert({
          user_id: userId, sender: 'admin', message: text
        }).then(function (r) {
          if (r.error) { status.textContent = 'Erreur : ' + r.error.message; return; }
          input.value = ''; status.textContent = 'Message envoyé.';
          setTimeout(function () { openStudentModal(userId); }, 400);
        });
      });
    }

    /* Téléchargement document */
    document.querySelectorAll('.admin-doc-download').forEach(function (b) {
      b.addEventListener('click', function () {
        var path = b.getAttribute('data-doc-path');
        b.disabled = true; b.textContent = '…';
        sb.storage.from('dossier-documents').createSignedUrl(path, 60).then(function (r) {
          b.disabled = false; b.textContent = 'Télécharger';
          if (r.error) { alert(r.error.message); return; }
          window.open(r.data.signedUrl, '_blank', 'noopener');
        });
      });
    });

    /* Upload document admin */
    var upForm = $('adminUploadForm');
    if (upForm) {
      upForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var fileInput = $('adminUploadFile');
        var status = $('adminUploadStatus');
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
          status.classList.remove('hidden'); status.textContent = 'Fichier trop volumineux (max 10 Mo).';
          return;
        }
        status.classList.remove('hidden'); status.textContent = 'Téléversement…';
        var safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var path = userId + '/admin-' + Date.now() + '-' + safe;
        sb.storage.from('dossier-documents').upload(path, file, { upsert: false }).then(function (up) {
          if (up.error) { status.textContent = 'Erreur : ' + up.error.message; return; }
          sb.from('dossier_documents').insert({
            user_id: userId, uploaded_by: 'admin', storage_path: path,
            filename: file.name, size_bytes: file.size, mime_type: file.type || null
          }).then(function (ins) {
            if (ins.error) { status.textContent = 'Erreur d\'enregistrement : ' + ins.error.message; return; }
            fileInput.value = ''; status.textContent = 'Document envoyé.';
            setTimeout(function () { openStudentModal(userId); }, 400);
          });
        });
      });
    }
  }

  function closeStudentModal() {
    var m = $('studentModal'); if (m) m.classList.add('hidden');
  }
})();
