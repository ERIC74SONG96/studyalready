/**
 * StudyAlready — Logique du tableau de bord étudiant.
 *
 * Charge le dossier de l'utilisateur connecté, ses étapes,
 * ses messages, ses documents et l'historique de ses demandes.
 * Dépend de assets/js/config.js pour les clés Supabase et
 * de l'auth déjà gérée par espace-etudiant.mjs.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

const cfg = (typeof window !== 'undefined' && window.STUDYALREADY_CONFIG) || {};
const sb =
  cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
  String(cfg.SUPABASE_URL).indexOf('REMPLACER') === -1 &&
  String(cfg.SUPABASE_ANON_KEY).indexOf('REMPLACER') === -1
    ? createClient(String(cfg.SUPABASE_URL).trim(), String(cfg.SUPABASE_ANON_KEY).trim())
    : null;

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fmtDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function fmtTime(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return dt.toLocaleString('fr-BE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const SUB_TYPE_LABELS = {
  'contact': 'Contact général',
  'prequalification': 'Pré-qualification dossier',
  'rejoindre-reseau': 'Adhésion au réseau',
  'mise-en-relation': 'Mise en relation membre',
  'rapport-admission': 'Rapport admission',
  'chasseur-billet': 'Chasseur de billets',
  'departs-groupes': 'Départs groupés',
};

const STATUS_BADGES = {
  'new':         { label: 'À traiter',  bg: 'bg-amber-100',  fg: 'text-amber-800' },
  'in_progress': { label: 'En cours',   bg: 'bg-blue-100',   fg: 'text-blue-800' },
  'processed':   { label: 'Traitée',    bg: 'bg-green-100',  fg: 'text-green-800' },
  'archived':    { label: 'Archivée',   bg: 'bg-slate-100',  fg: 'text-slate-600' },
};

const STEP_BADGES = {
  'done':         { icon: '✓', bg: 'bg-green-500',  fg: 'text-white',    text: 'Terminée' },
  'in_progress':  { icon: '⏳', bg: 'bg-amber-400',  fg: 'text-amber-900', text: 'En cours' },
  'blocked':      { icon: '⚠', bg: 'bg-red-500',    fg: 'text-white',    text: 'Bloquée' },
  'pending':      { icon: '○', bg: 'bg-slate-200',  fg: 'text-slate-500', text: 'À venir' },
};

let currentUser = null;
let currentDossier = null;

async function boot() {
  const banner = $('espaceBanner');
  const errEl = $('espaceError');

  if (!sb) {
    if (banner) {
      banner.className = 'rounded-xl p-4 text-sm mb-6 bg-amber-50 border border-amber-200 text-amber-900';
      banner.textContent = 'Connexion à la base de données impossible. Forcez le rechargement (Ctrl + Shift + R).';
      banner.classList.remove('hidden');
    }
    return;
  }

  /* Vérifie la session — sinon redirige vers la page de login. */
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.replace('index.html');
    return;
  }
  currentUser = session.user;

  /* En-tête (déjà géré par espace-etudiant.mjs, on remplit aussi par sécurité) */
  const meta = (currentUser.user_metadata && currentUser.user_metadata.full_name) || '';
  if ($('dashName')) $('dashName').textContent = meta || 'Étudiant(e)';
  if ($('dashEmail')) $('dashEmail').textContent = currentUser.email || '';

  /* Bouton déconnexion (au cas où) */
  if ($('btnLogout')) {
    $('btnLogout').addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  /* Charge en parallèle les 4 blocs principaux. */
  await Promise.all([
    loadDossier(),
    loadSubmissions(),
    loadMessages(),
    loadDocuments(),
  ]);

  bindMessageForm();
  bindUploadForm();
}

/* ---------- DOSSIER ET ÉTAPES ---------- */

async function loadDossier() {
  const wrap = $('dossierBlock');
  if (!wrap) return;

  /* On prend le dossier le plus récent (priorité à un dossier dédié type fwb,
     sinon parcours_general). */
  const { data: dossiers, error } = await sb
    .from('student_dossiers')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    wrap.innerHTML = blockError('Impossible de charger votre dossier (' + escapeHtml(error.message) + ').' +
      ' Si la table n\'existe pas, demandez à l\'admin d\'exécuter la migration <code>006_student_dossiers.sql</code>.');
    return;
  }

  if (!dossiers || dossiers.length === 0) {
    wrap.innerHTML = blockEmpty('Aucun dossier ouvert pour le moment.',
      'Votre dossier sera créé automatiquement à votre prochaine connexion.');
    return;
  }

  /* Priorise un dossier "métier" (équivalence FWB, visa, etc.) sur le parcours générique. */
  const priority = ['equivalence_fwb', 'visa', 'compte_bloque', 'logement', 'pack_accueil'];
  let dossier = dossiers.find((d) => priority.indexOf(d.type) !== -1);
  if (!dossier) dossier = dossiers[0];
  currentDossier = dossier;

  const { data: steps } = await sb
    .from('dossier_steps')
    .select('*')
    .eq('dossier_id', dossier.id)
    .order('step_number', { ascending: true });

  const doneCount = (steps || []).filter((s) => s.status === 'done').length;
  const totalCount = (steps || []).length || dossier.total_steps || 1;
  const progress = Math.round((doneCount / totalCount) * 100);

  wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="p-5 border-b border-slate-100">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-lg bg-brand-dark text-brand-gold flex items-center justify-center font-display font-bold">📂</div>
          <div class="flex-1">
            <p class="text-xs uppercase tracking-widest text-slate-500">Mon dossier</p>
            <h3 class="font-display font-bold text-lg text-brand-dark">${escapeHtml(dossier.title || 'Mon parcours StudyAlready')}</h3>
            <p class="text-xs text-slate-500 mt-1">Mis à jour le ${fmtDate(dossier.updated_at)} · statut : <span class="font-semibold text-brand-dark">${escapeHtml(dossier.status)}</span></p>
          </div>
          <div class="text-right">
            <p class="text-3xl font-display font-bold text-brand-dark">${progress}%</p>
            <p class="text-xs text-slate-500">${doneCount}/${totalCount} étapes</p>
          </div>
        </div>
        <div class="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-brand-gold to-amber-500 transition-all" style="width:${progress}%"></div>
        </div>
        ${dossier.notes ? `<p class="mt-3 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">📝 ${escapeHtml(dossier.notes)}</p>` : ''}
      </div>
      <div class="divide-y divide-slate-100">
        ${(steps || []).map((s) => renderStep(s)).join('') || '<p class="p-5 text-sm text-slate-500">Aucune étape définie.</p>'}
      </div>
    </div>
  `;
}

function renderStep(s) {
  const badge = STEP_BADGES[s.status] || STEP_BADGES['pending'];
  return `
    <div class="flex gap-4 p-4">
      <div class="flex-shrink-0 w-8 h-8 rounded-full ${badge.bg} ${badge.fg} flex items-center justify-center font-bold text-sm">${badge.icon}</div>
      <div class="flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-semibold text-brand-dark text-sm">${s.step_number}. ${escapeHtml(s.title)}</p>
          <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.bg.replace('500','100').replace('400','100').replace('200','100')} ${badge.fg.replace('white','slate-700')}">${badge.text}</span>
        </div>
        ${s.description ? `<p class="mt-1 text-xs text-slate-600">${escapeHtml(s.description)}</p>` : ''}
        ${s.completed_at ? `<p class="mt-1 text-[11px] text-slate-400">Terminée le ${fmtDate(s.completed_at)}</p>` : ''}
      </div>
    </div>
  `;
}

/* ---------- DEMANDES (form_submissions) ---------- */

async function loadSubmissions() {
  const wrap = $('submissionsBlock');
  if (!wrap) return;

  const { data, error } = await sb
    .from('form_submissions')
    .select('id, form_type, status, subject, created_at, payload')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    wrap.innerHTML = blockError('Impossible de charger vos demandes.');
    return;
  }

  if (!data || data.length === 0) {
    wrap.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-600">
        <p>Vous n'avez encore envoyé aucune demande depuis ce compte.</p>
        <p class="mt-2 text-xs text-slate-500">Astuce : connectez-vous à votre espace <strong>avant</strong> de remplir un formulaire pour qu'il soit lié à votre compte.</p>
        <a href="../index.html#contact" class="mt-4 inline-block text-brand-blue underline font-semibold text-sm">Nous écrire maintenant →</a>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="divide-y divide-slate-100">
        ${data.map((s) => {
          const typeLabel = SUB_TYPE_LABELS[s.form_type] || s.form_type;
          const badge = STATUS_BADGES[s.status] || STATUS_BADGES['new'];
          return `
            <div class="p-4 flex items-start gap-3">
              <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">📨</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-semibold text-sm text-brand-dark">${escapeHtml(typeLabel)}</p>
                  <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.fg}">${badge.label}</span>
                </div>
                ${s.subject ? `<p class="text-xs text-slate-600 mt-0.5 truncate">${escapeHtml(s.subject)}</p>` : ''}
                <p class="text-[11px] text-slate-400 mt-0.5">Envoyée le ${fmtTime(s.created_at)}</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ---------- MESSAGES ---------- */

async function loadMessages() {
  const wrap = $('messagesBlock');
  if (!wrap) return;

  const { data, error } = await sb
    .from('dossier_messages')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    wrap.innerHTML = blockError('Impossible de charger les messages.');
    return;
  }

  const messagesHtml = (data && data.length) ? data.map(renderMessage).join('') :
    `<p class="text-sm text-slate-500 text-center py-6">Aucun message pour l'instant. Écrivez-nous ci-dessous, l'admin vous répondra ici.</p>`;

  wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div id="messagesList" class="p-4 space-y-3 max-h-96 overflow-y-auto bg-slate-50">
        ${messagesHtml}
      </div>
      <form id="messageForm" class="border-t border-slate-200 p-3 flex gap-2">
        <textarea id="messageInput" rows="2" placeholder="Écrivez un message à StudyAlready…"
          class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-gold outline-none resize-none"></textarea>
        <button type="submit" class="bg-brand-dark hover:bg-brand-blue text-white font-semibold px-4 rounded-lg text-sm">Envoyer</button>
      </form>
      <p id="messageStatus" class="px-4 pb-3 text-xs text-slate-500 hidden"></p>
    </div>
  `;

  /* Marque comme lus les messages reçus de l'admin (lecture côté étudiant). */
  const unread = (data || []).filter((m) => m.sender === 'admin' && !m.read_at);
  if (unread.length) {
    sb.from('dossier_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread.map((m) => m.id))
      .then(() => { /* silencieux */ });
  }
}

function renderMessage(m) {
  const isStudent = m.sender === 'student';
  return `
    <div class="flex ${isStudent ? 'justify-end' : 'justify-start'}">
      <div class="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${isStudent
        ? 'bg-brand-blue text-white rounded-br-sm'
        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}">
        <p class="whitespace-pre-wrap break-words">${escapeHtml(m.message)}</p>
        <p class="text-[10px] mt-1 ${isStudent ? 'text-blue-100' : 'text-slate-400'}">${fmtTime(m.created_at)}</p>
      </div>
    </div>
  `;
}

function bindMessageForm() {
  const form = $('messageForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('messageInput');
    const status = $('messageStatus');
    const text = (input.value || '').trim();
    if (!text) return;

    status.classList.remove('hidden', 'text-red-600', 'text-green-600');
    status.classList.add('text-slate-500');
    status.textContent = 'Envoi…';

    const row = {
      user_id: currentUser.id,
      sender: 'student',
      message: text,
      dossier_id: currentDossier ? currentDossier.id : null,
    };

    const { error } = await sb.from('dossier_messages').insert(row);
    if (error) {
      status.classList.remove('text-slate-500'); status.classList.add('text-red-600');
      status.textContent = 'Erreur : ' + error.message;
      return;
    }
    input.value = '';
    status.textContent = 'Message envoyé.';
    status.classList.remove('text-slate-500'); status.classList.add('text-green-600');
    await loadMessages();
  });
}

/* ---------- DOCUMENTS ---------- */

async function loadDocuments() {
  const wrap = $('documentsBlock');
  if (!wrap) return;

  const { data, error } = await sb
    .from('dossier_documents')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    wrap.innerHTML = blockError('Impossible de charger les documents.');
    return;
  }

  const listHtml = (data && data.length) ? data.map(renderDoc).join('') :
    `<p class="text-sm text-slate-500 text-center py-4">Aucun document pour le moment. L'admin pourra vous partager ici vos accusés, équivalence finale, etc.</p>`;

  wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="p-4 divide-y divide-slate-100">
        ${listHtml}
      </div>
      <form id="uploadForm" class="border-t border-slate-200 p-3 bg-slate-50">
        <label class="block text-xs font-semibold text-slate-600 mb-2">Téléverser un document (PDF, image, max 10 Mo)</label>
        <div class="flex gap-2">
          <input id="uploadFile" type="file" accept="application/pdf,image/*,.doc,.docx"
            class="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white" />
          <button type="submit" class="bg-brand-gold hover:bg-yellow-500 text-brand-dark font-bold px-4 rounded-lg text-sm">Envoyer</button>
        </div>
        <p id="uploadStatus" class="text-xs text-slate-500 mt-2 hidden"></p>
      </form>
    </div>
  `;
}

function renderDoc(d) {
  const fromAdmin = d.uploaded_by === 'admin';
  return `
    <div class="py-3 flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg ${fromAdmin ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center text-lg">📄</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-brand-dark truncate">${escapeHtml(d.filename)}</p>
        <p class="text-[11px] text-slate-500">${fromAdmin ? 'Partagé par StudyAlready' : 'Téléversé par vous'} · ${fmtTime(d.created_at)}</p>
      </div>
      <button data-doc-path="${escapeHtml(d.storage_path)}" data-doc-name="${escapeHtml(d.filename)}"
        class="js-doc-download text-brand-blue hover:underline text-xs font-semibold">Télécharger</button>
    </div>
  `;
}

function bindUploadForm() {
  /* Délégation : récupération des liens téléchargement à la volée. */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.js-doc-download');
    if (!btn) return;
    e.preventDefault();
    const path = btn.dataset.docPath;
    if (!path) return;
    btn.disabled = true; btn.textContent = '…';
    const { data, error } = await sb.storage.from('dossier-documents').createSignedUrl(path, 60);
    btn.disabled = false; btn.textContent = 'Télécharger';
    if (error || !data) {
      alert('Impossible d\'ouvrir ce document : ' + (error ? error.message : 'erreur inconnue'));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  });

  const form = $('uploadForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = $('uploadFile');
    const status = $('uploadStatus');
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      status.className = 'text-xs mt-2 text-red-600';
      status.textContent = 'Fichier trop volumineux (max 10 Mo).';
      status.classList.remove('hidden');
      return;
    }
    status.className = 'text-xs mt-2 text-slate-600';
    status.textContent = 'Téléversement…';
    status.classList.remove('hidden');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = currentUser.id + '/' + Date.now() + '-' + safeName;

    const up = await sb.storage.from('dossier-documents').upload(path, file, {
      cacheControl: '3600', upsert: false,
    });
    if (up.error) {
      status.className = 'text-xs mt-2 text-red-600';
      status.textContent = 'Erreur : ' + up.error.message + (up.error.message && up.error.message.indexOf('Bucket') !== -1
        ? ' (le bucket "dossier-documents" doit être créé dans Supabase Studio → Storage).' : '');
      return;
    }

    const ins = await sb.from('dossier_documents').insert({
      user_id: currentUser.id,
      dossier_id: currentDossier ? currentDossier.id : null,
      uploaded_by: 'student',
      storage_path: path,
      filename: file.name,
      size_bytes: file.size,
      mime_type: file.type || null,
    });

    if (ins.error) {
      status.className = 'text-xs mt-2 text-red-600';
      status.textContent = 'Fichier téléversé, mais erreur d\'enregistrement : ' + ins.error.message;
      return;
    }
    fileInput.value = '';
    status.className = 'text-xs mt-2 text-green-600';
    status.textContent = 'Document envoyé. L\'admin en sera notifié.';
    await loadDocuments();
  });
}

/* ---------- Helpers de rendu ---------- */

function blockError(html) {
  return `<div class="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-800">${html}</div>`;
}
function blockEmpty(title, hint) {
  return `<div class="bg-white rounded-2xl border border-slate-200 p-6 text-sm">
    <p class="font-semibold text-brand-dark">${escapeHtml(title)}</p>
    <p class="mt-1 text-slate-600">${escapeHtml(hint)}</p>
  </div>`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
