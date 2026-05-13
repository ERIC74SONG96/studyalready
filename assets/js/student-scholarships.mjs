/**
 * Mur des bourses et aides aux études en Belgique — lecture publique, publication réservée aux comptes connectés.
 * Requiert la migration 016 et le bucket Storage public `scholarship-offers`.
 * Les administrateurs (table `admins`) peuvent supprimer toute annonce (modération).
 * Client Supabase : `sa-supabase-loader.mjs` (vendor local puis CDN).
 */
import { loadSupabaseCreateClient } from './sa-supabase-loader.mjs';

const BUCKET = 'scholarship-offers';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** URL canonique pour le partage (trafic vers le site). */
const CANONICAL_SCHOLARSHIPS_PAGE = 'https://www.studyalready.com/bourses-belgique.html';

/** Client Supabase unique (créé après import dynamique du SDK). */
let __saScholarshipsSbClient = null;

function getSupabaseConfig() {
  const cfg = (typeof window !== 'undefined' && window.STUDYALREADY_CONFIG) || {};
  const url = cfg.SUPABASE_URL;
  const key = cfg.SUPABASE_ANON_KEY;
  if (!url || !key || String(url).indexOf('REMPLACER') !== -1 || String(key).indexOf('REMPLACER') !== -1) {
    return null;
  }
  return { url: String(url).trim(), key: String(key).trim() };
}

async function ensureSb() {
  if (__saScholarshipsSbClient) return __saScholarshipsSbClient;
  const creds = getSupabaseConfig();
  if (!creds) return null;
  const createClient = await loadSupabaseCreateClient();
  __saScholarshipsSbClient = createClient(creds.url, creds.key);
  return __saScholarshipsSbClient;
}

function getSb() {
  return __saScholarshipsSbClient;
}

const SCOPE_CATEGORY_LABELS = {
  wallonie_bruxelles: 'Wallonie-Bruxelles',
  flandre: 'Flandre',
  bruxelles_capital: 'Bruxelles-Capitale',
  federal_eu: 'Fédéral / UE',
  universite_haute_ecole: 'Université / haute école',
  autre: 'Autre',
};

function normalizeScopeCategory(v) {
  const s = String(v || '').trim();
  return Object.prototype.hasOwnProperty.call(SCOPE_CATEGORY_LABELS, s) ? s : 'autre';
}

let cachedScholarshipRows = [];
let scholarshipsScopeFilter = '';
let lastScholarshipsUserId = null;
let lastScholarshipsLogged = false;
let lastScholarshipsIsAdmin = false;

function filterScholarshipRows(rows) {
  if (!scholarshipsScopeFilter) return rows || [];
  return (rows || []).filter((r) => normalizeScopeCategory(r.scope_category) === scholarshipsScopeFilter);
}

function bindScholarshipScopeChips() {
  const wrap = document.getElementById('scholarshipsScopeChips');
  if (!wrap || wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-scholarship-scope]');
    if (!btn) return;
    scholarshipsScopeFilter = btn.getAttribute('data-scholarship-scope') ?? '';
    wrap.querySelectorAll('[data-scholarship-scope]').forEach((b) => {
      const on = (b.getAttribute('data-scholarship-scope') || '') === scholarshipsScopeFilter;
      b.classList.toggle('border-violet-900', on);
      b.classList.toggle('bg-violet-900', on);
      b.classList.toggle('text-white', on);
      b.classList.toggle('border-slate-300', !on);
      b.classList.toggle('bg-white', !on);
      b.classList.toggle('text-slate-700', !on);
    });
    const sb = getSb();
    if (!sb) return;
    renderList(
      sb,
      filterScholarshipRows(cachedScholarshipRows),
      lastScholarshipsUserId,
      lastScholarshipsLogged,
      lastScholarshipsIsAdmin,
      cachedScholarshipRows,
    );
  });
}

const $ = (id) => document.getElementById(id);

const escapeHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/'/g, '&#39;');
}

/** Retire ponctuation / guillemets souvent collés à la fin d’une URL capturée dans du texte. */
function trimCapturedUrl(s) {
  let t = String(s || '').trim();
  t = t.replace(/[)\].,;»\s]+$/g, '');
  t = t.replace(/["'`\u2019\u201c\u201d]+$/g, '');
  return t.trim();
}

function descriptionForUrlParsing(desc) {
  return String(desc || '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fr-BE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function authorFromUser(user) {
  if (!user) return 'Membre';
  const meta = user.user_metadata || {};
  const name = (meta.full_name || meta.name || '').trim();
  if (name) return name.slice(0, 120);
  const em = (user.email || '').split('@')[0] || '';
  if (em) return em.slice(0, 40);
  return 'Membre';
}

function safeFilePart(name) {
  const base = String(name || 'image').split(/[/\\]/).pop() || 'image';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

/** Titre affiché : saisi, ou déduit (lien, texte, fichier), toujours ≥ 3 car. pour la base. */
function deriveTitle({ title, description, source_url, file }) {
  let t = String(title || '').trim();
  if (t.length >= 3) return t.slice(0, 200);

  if (source_url) {
    try {
      const hn = new URL(source_url).hostname.replace(/^www\./i, '');
      if (hn.length >= 3) return hn.slice(0, 200);
    } catch (_) {}
  }

  const desc = String(description || '').trim();
  if (desc.length >= 3) {
    const line = desc
      .split(/\r?\n/)
      .map((x) => x.trim())
      .find((x) => x.length >= 3);
    const chunk = line || desc;
    return chunk.replace(/\s+/g, ' ').slice(0, 200);
  }

  if (file && file.name) {
    const base = safeFilePart(file.name).replace(/\.[a-zA-Z0-9]+$/, '');
    const readable = base.replace(/[_.-]+/g, ' ').trim();
    if (readable.length >= 3) return readable.slice(0, 200);
  }

  return 'Bourse / aide aux études';
}

function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.href;
  } catch {
    return '';
  }
}

function extractAllHttpUrls(text) {
  const s = String(text || '');
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  const m = s.match(re);
  if (!m || !m.length) return [];
  return m.map((x) => trimCapturedUrl(x)).filter(Boolean);
}

function isLikelyImageOnlyUrl(u) {
  if (!u) return true;
  const p = String(u).split('?')[0].toLowerCase();
  return /\.(jpe?g|png|gif|webp|svg|ico)(\s|$)?$/i.test(p);
}

/** Parmi plusieurs URL dans le texte, préfère une page offre plutôt qu’une image seule. */
function pickPreferredScholarshipUrl(urls) {
  const norm = [];
  const seen = {};
  for (let i = 0; i < urls.length; i++) {
    const u = normalizeUrl(trimCapturedUrl(urls[i]));
    if (!u || u.length < 12 || seen[u]) continue;
    seen[u] = 1;
    norm.push(u);
  }
  const nonImg = norm.filter((u) => !isLikelyImageOnlyUrl(u));
  if (nonImg.length) return nonImg[0];
  return norm[0] || '';
}

/** URL de l’offre externe : colonne dédiée, contact, lignes « Lien : … », ou première URL https pertinente dans le texte. */
function resolveScholarshipExternalHref(row) {
  const fromCol = normalizeUrl(trimCapturedUrl(row && row.source_url));
  if (fromCol) return fromCol;

  const hint = String((row && row.contact_hint) || '').trim();
  if (/^https?:\/\//i.test(hint)) {
    const firstTok = hint.split(/\s/)[0];
    const u = normalizeUrl(trimCapturedUrl(firstTok));
    if (u && u.length >= 12) return u;
  }

  const desc = descriptionForUrlParsing((row && row.description) || '');
  const lines = desc.split(/\r?\n/);
  const lineRes = [
    /^Lien\s*(?:vers[^:\n]{0,56})?\s*:\s*(https?:\/\/\S+)/i,
    /^Lien\s+vers\s+l['\u2019]offre\s*:\s*(https?:\/\/\S+)/i,
    /^URL\s*:\s*(https?:\/\/\S+)/i,
    /^Site\s*(?:web)?\s*:\s*(https?:\/\/\S+)/i,
  ];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^https?:\/\//i.test(t)) {
      const first = t.split(/\s/)[0];
      const u = normalizeUrl(trimCapturedUrl(first));
      if (u && u.length >= 12 && !isLikelyImageOnlyUrl(u)) return u;
    }
    for (let r = 0; r < lineRes.length; r++) {
      const m = t.match(lineRes[r]);
      if (m) {
        const u = normalizeUrl(trimCapturedUrl(m[1]));
        if (u) return u;
      }
    }
    if (/^Lien/i.test(t) && /:\s*$/.test(t) && !/https?:\/\//i.test(t) && i + 1 < lines.length) {
      const nxt = lines[i + 1].trim();
      const um = nxt.match(/^(https?:\/\/[^\s<>"')\]]+)/i);
      if (um) {
        const u = normalizeUrl(trimCapturedUrl(um[1]));
        if (u) return u;
      }
    }
  }

  return pickPreferredScholarshipUrl(extractAllHttpUrls(desc));
}

function safeHttpsUrl(u) {
  const s = String(u || '').trim();
  return s.startsWith('https://') ? s : '';
}

/** Aperçu Open Graph / meta via Microlink (pas de clé requise, quotas possibles). */
async function fetchMicrolinkPreview(pageUrl) {
  const api = 'https://api.microlink.io/?url=' + encodeURIComponent(pageUrl);
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), 18000) : 0;
  try {
    const res = await fetch(api, ctrl ? { signal: ctrl.signal } : {});
    const j = await res.json().catch(() => ({}));
    if (j.status !== 'success' || !j.data) {
      return { error: j.message || 'Impossible de lire cette page (site bloqué ou URL invalide).' };
    }
    const d = j.data;
    const title = (d.title && String(d.title).trim()) || '';
    const description = (d.description && String(d.description).trim()) || '';
    let imageUrl = '';
    if (d.image && d.image.url) imageUrl = String(d.image.url).trim();
    return { title, description, imageUrl: safeHttpsUrl(imageUrl) };
  } catch (e) {
    return { error: e && e.name === 'AbortError' ? 'Délai dépassé.' : 'Réseau ou service indisponible.' };
  } finally {
    if (t) clearTimeout(t);
  }
}

function setImportMsg(text, isError) {
  const el = $('scholarshipsImportLinkMsg');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
  el.classList.toggle('text-red-700', !!isError);
  el.classList.toggle('text-emerald-700', !isError && !!text);
}

function shareLinksForPost(postId, title) {
  const pageUrl = `${CANONICAL_SCHOLARSHIPS_PAGE}#bourse-${postId}`;
  const shortTitle = String(title || 'Bourse')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const text = `${shortTitle}\n\nVoir sur StudyAlready :\n${pageUrl}`;
  const wa = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
  const mail = `mailto:?subject=${encodeURIComponent(`Bourse : ${shortTitle}`)}&body=${encodeURIComponent(text)}`;
  return { pageUrl, wa, fb, mail };
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('execCommand'));
    } catch (e) {
      try {
        document.body.removeChild(ta);
      } catch (_) {}
      reject(e);
    }
  });
}

function scrollToScholarshipIfHash() {
  const h = typeof window !== 'undefined' ? window.location.hash : '';
  if (!h || h.indexOf('#bourse-') !== 0) return;
  const id = h.slice(1);
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function loadPosts(sb) {
  const { data, error } = await sb
    .from('student_scholarship_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return data || [];
}

function publicImageUrl(sb, path) {
  if (!path) return '';
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

/** Cible « élément » du clic (les clics sur le texte ont souvent un #text comme target, sans .closest). */
function clickEventTargetElement(ev) {
  var t = ev.target;
  if (!t) return null;
  if (t.nodeType === 1) return t;
  return t.parentElement || null;
}

/** Ouverture fiche officielle : clic sur la carte (lien externe). */
function ensureScholarshipsListLinkBinding() {
  const host = $('scholarshipsList');
  if (!host || host.dataset.saOfferOpenBound === '1') return;
  host.dataset.saOfferOpenBound = '1';
  host.addEventListener('click', function (ev) {
    if (ev.type !== 'click' || ev.button !== 0) return;
    var el = clickEventTargetElement(ev);
    if (!el || !el.closest) return;
    var art = el.closest('article[data-sa-scholarship-url]');
    if (!art) return;
    var url = art.getAttribute('data-sa-scholarship-url');
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (el.closest('button.scholarships-del') || el.closest('button.scholarships-copylink')) return;
    var a = el.closest('a[href]');
    if (a) {
      var h = a.getAttribute('href') || '';
      if (a.classList.contains('scholarships-share-wa') || a.classList.contains('scholarships-share-fb') || a.classList.contains('scholarships-share-mail')) return;
      if (h.indexOf('mailto:') === 0) return;
    }
    ev.preventDefault();
    var w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      try {
        window.location.href = url;
      } catch (e2) {}
    }
  });
}

/** Retire les lignes techniques « Lien : https… » / « Image : https… » (legacy) quand l’offre s’ouvre déjà au clic. */
function stripRedundantLinkImageLines(desc, jobHref) {
  const u = normalizeUrl(trimCapturedUrl(jobHref));
  if (!u) return String(desc || '').trim();
  const lines = descriptionForUrlParsing(String(desc || '')).split(/\r?\n/);
  /** Puces courantes, deux-points ASCII ou pleine chasse (copier-coller messagers). */
  const bol = String.raw`^\s*(?:[-*•·]\s*)?`;
  const col = String.raw`(?:\s*:\s*|\s*：\s*)`;
  const httpInLine = String.raw`(https?:\/\/\S+)`;
  /** Lien / URL sur une seule ligne (texte après l’URL autorisé : commentaires, « (Randstad) », etc.). */
  const legacyLinkLine = new RegExp(
    bol + String.raw`Liens?` + String.raw`\s*(?:vers[^:\n\uFF1A]{0,56})?` + col + httpInLine,
    'i',
  );
  const legacyLinkLoffre = new RegExp(
    bol +
      String.raw`Lien\s+vers\s+l['\u2019]offre` +
      col +
      httpInLine,
    'i',
  );
  const legacyImageLine = new RegExp(
    bol +
      String.raw`(?:Image|Photo|Visuel|Miniature|Vignette|Aper[cç]u)` +
      col +
      httpInLine,
    'i',
  );
  const urlFieldLine = new RegExp(bol + String.raw`URL` + col + httpInLine, 'i');
  const lienHeadNoUrl = new RegExp(
    bol + String.raw`Liens?` + String.raw`\s*(?:vers[^:\n\uFF1A]{0,56})?` + col + String.raw`\s*$`,
    'i',
  );
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (legacyImageLine.test(t)) continue;
    if (legacyLinkLoffre.test(t) || legacyLinkLine.test(t)) continue;
    if (urlFieldLine.test(t)) continue;
    if (lienHeadNoUrl.test(t) && !/https?:\/\//i.test(t) && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (/^https?:\/\/\S+/i.test(next)) {
        i++;
        continue;
      }
    }
    kept.push(lines[i]);
  }
  return kept.join('\n').trim();
}

/** Texte sous le titre : sans doublons d’URL déjà ouverte par la carte. */
function descriptionBlockForList(r, externalHref) {
  let raw = String((r && r.description) || '').trim();
  if (!raw) return '';
  const u = String(externalHref || '').trim();
  if (u) {
    raw = stripRedundantLinkImageLines(raw, u);
  }
  if (!raw) return '';
  if (!u) {
    return `<div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(raw)}</div>`;
  }
  const norm = (s) =>
    String(s || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  const nDesc = norm(raw);
  const nu = normalizeUrl(trimCapturedUrl(u));
  const variants = [
    norm(`Lien vers l'offre :\n${nu}`),
    norm(`Lien vers l'offre:\n${nu}`),
    norm(`Lien vers l’offre :\n${nu}`),
    norm(`Lien vers l’offre:\n${nu}`),
    norm(`Lien vers l'offre : ${nu}`),
    norm(`Lien vers l'offre: ${nu}`),
    norm(`Lien vers la fiche officielle :\n${nu}`),
    norm(`Lien vers la fiche officielle:\n${nu}`),
    norm(`Lien vers la fiche officielle : ${nu}`),
    norm(`Lien vers la fiche officielle: ${nu}`),
    norm(nu),
  ];
  for (let i = 0; i < variants.length; i++) {
    if (variants[i] && variants[i] === nDesc) return '';
  }
  return `<div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(raw)}</div>`;
}

function fmtDeadline(isoDate) {
  if (!isoDate) return '';
  try {
    return new Date(isoDate + 'T12:00:00').toLocaleDateString('fr-BE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return String(isoDate);
  }
}

function renderList(sb, rowsToShow, currentUserId, isLoggedIn, isAdminUser, allRowsForLookup) {
  const host = $('scholarshipsList');
  if (!host) return;
  ensureScholarshipsListLinkBinding();
  const lookup = allRowsForLookup || rowsToShow;
  if (!rowsToShow.length) {
    let emptyMsg = isLoggedIn
      ? 'Aucune bourse listée pour le moment. Publiez la première avec le formulaire à droite (ou ci-dessous sur mobile).'
      : 'Aucune bourse listée pour le moment. Soyez le premier à en publier une (compte requis).';
    if (lookup.length && scholarshipsScopeFilter) {
      emptyMsg =
        'Aucune fiche dans ce filtre pour le moment. Choisissez « Toutes » ou proposez une bourse dans cette rubrique.';
    }
    host.innerHTML = '<p class="text-slate-600 text-center py-10">' + escapeHtml(emptyMsg) + '</p>';
    return;
  }
  host.innerHTML = rowsToShow
    .map((r) => {
      const storageUrl = r.image_path ? publicImageUrl(sb, r.image_path) : '';
      const extImg = safeHttpsUrl(r.external_image_url);
      const imgUrl = storageUrl || extImg;
      const own = currentUserId && r.user_id === currentUserId;
      const canDel = own || isAdminUser;
      const del = canDel
        ? `<button type="button" class="scholarships-del cursor-pointer text-xs font-semibold text-red-700 hover:underline" data-id="${escapeHtml(r.id)}">${own ? 'Supprimer' : 'Supprimer (modération)'}</button>`
        : '';
      const extHref = resolveScholarshipExternalHref(r);
      const imgInner = imgUrl
        ? `<img src="${escapeHtml(imgUrl)}" alt="" class="w-full max-h-72 object-contain" loading="lazy" referrerpolicy="no-referrer" />`
        : '';
      const imgBlock = imgUrl
        ? `<div class="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">${imgInner}</div>`
        : '';
      const titleHtml = `<h3 class="mt-1 font-display font-bold text-lg text-brand-dark leading-snug">${escapeHtml(r.title)}</h3>`;
      const contact = r.contact_hint
        ? `<p class="mt-2 text-sm text-brand-blue font-medium whitespace-pre-wrap">${escapeHtml(r.contact_hint)}</p>`
        : '';
      const { wa, fb, mail, pageUrl } = shareLinksForPost(r.id, r.title || 'Bourse');
      const shareBlock =
        `<div class="mt-4 pt-3 border-t border-slate-100">` +
        `<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Partager cette fiche</p>` +
        `<div class="mt-2 flex flex-wrap gap-2">` +
        `<a href="${wa}" target="_blank" rel="noopener noreferrer" class="cursor-pointer scholarships-share-wa inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2">WhatsApp</a>` +
        `<a href="${fb}" target="_blank" rel="noopener noreferrer" class="cursor-pointer scholarships-share-fb inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2">Facebook</a>` +
        `<a href="${mail}" class="cursor-pointer scholarships-share-mail inline-flex items-center gap-1 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2">E-mail</a>` +
        `<button type="button" class="cursor-pointer scholarships-copylink inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2" data-url="${escapeHtml(pageUrl)}">Copier le lien</button>` +
        `</div></div>`;
      const cat = normalizeScopeCategory(r.scope_category);
      const catLabel = SCOPE_CATEGORY_LABELS[cat] || 'Belgique';
      const badge = `<span class="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">${escapeHtml(catLabel)}</span>`;
      const deadlineLine =
        r.application_deadline
          ? `<p class="mt-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-block">Date limite de candidature (indicative) : ${escapeHtml(fmtDeadline(r.application_deadline))}</p>`
          : '';

      const descBlock = descriptionBlockForList(r, '');

      const metaLine =
        `<p class="text-xs text-slate-500">${escapeHtml(fmtDate(r.created_at))} · ${escapeHtml(r.author_label || 'Membre')}</p>`;

      if (extHref) {
        const ariaCard = escapeAttr('Ouvrir la fiche officielle dans un nouvel onglet');
        const descClick = descriptionBlockForList(r, extHref);
        return (
          `<article id="bourse-${escapeHtml(r.id)}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-28 cursor-pointer group hover:border-violet-400/70 hover:shadow-md transition sa-scholarship-card" data-post-id="${escapeHtml(r.id)}" data-sa-scholarship-url="${escapeAttr(extHref)}" aria-label="${ariaCard}">` +
          `<div class="flex flex-wrap items-start justify-between gap-2">` +
          `<div class="min-w-0 flex-1">` +
          metaLine +
          badge +
          titleHtml +
          deadlineLine +
          `</div>` +
          `<div class="shrink-0">${del}</div></div>` +
          descClick +
          contact +
          shareBlock +
          `</article>`
        );
      }

      return (
        `<article id="bourse-${escapeHtml(r.id)}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-28 cursor-default" data-post-id="${escapeHtml(r.id)}">` +
        `<div class="flex flex-wrap items-start justify-between gap-2">` +
        `<div class="min-w-0 flex-1">` +
        metaLine +
        badge +
        titleHtml +
        deadlineLine +
        `</div>` +
        `<div class="shrink-0">${del}</div></div>` +
        descBlock +
        imgBlock +
        contact +
        shareBlock +
        `</article>`
      );
    })
    .join('');

  host.querySelectorAll('.scholarships-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id || !confirm('Supprimer cette fiche bourse ?')) return;
      const row = lookup.find((x) => x.id === id);
      const { error } = await sb.from('student_scholarship_posts').delete().eq('id', id);
      if (error) {
        alert(error.message || 'Suppression impossible.');
        return;
      }
      if (row?.image_path) {
        try {
          await sb.storage.from(BUCKET).remove([row.image_path]);
        } catch (_) {}
      }
      initPage();
    });
  });

  host.querySelectorAll('.scholarships-copylink').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const url = btn.getAttribute('data-url');
      if (!url) return;
      try {
        await copyTextToClipboard(url);
        const prev = btn.textContent;
        btn.textContent = 'Copié !';
        setTimeout(() => {
          btn.textContent = prev;
        }, 2000);
      } catch {
        window.prompt('Copiez ce lien :', url);
      }
    });
  });
}

let __scholarshipsAuthListenerBound = false;

async function initPage() {
  try {
    const banner = $('scholarshipsConfigBanner');
    let sb = getSb();
    if (!sb && !window.__saScholarshipsConfigRetried) {
      window.__saScholarshipsConfigRetried = true;
      await new Promise((r) => setTimeout(r, 400));
      sb = getSb();
    }
    const creds = getSupabaseConfig();
    if (!sb && creds) {
      try {
        sb = await ensureSb();
      } catch (e) {
        window.__saScholarshipsSdkAttempts = (window.__saScholarshipsSdkAttempts || 0) + 1;
        if (window.__saScholarshipsSdkAttempts < 2) {
          await new Promise((r) => setTimeout(r, 1600));
          return initPage();
        }
        if (banner) banner.classList.add('hidden');
        const detail = e && e.message ? String(e.message) : String(e);
        const err = $('scholarshipsLoadError');
        if (err) {
          err.textContent =
            'Le client Supabase n’a pas pu être chargé (CDN souvent bloqué par un pare-feu ou une extension). Détail : ' +
            detail;
          err.classList.remove('hidden');
        }
        const jl = $('scholarshipsList');
        if (jl) {
          jl.innerHTML =
            '<p class="text-center text-sm text-slate-700 py-8">Essayez sans bloqueur de publicités, un autre navigateur ou la 4G. Les fiches bourses sont disponibles côté serveur.</p>';
        }
        cachedScholarshipRows = [];
        return;
      }
    }
    if (!sb) {
      if (banner) banner.classList.remove('hidden');
      const jl = $('scholarshipsList');
      if (jl) {
        jl.innerHTML =
          '<p class="text-center text-sm text-slate-600 py-8">Configuration Supabase absente sur cette page. Vérifiez le bandeau jaune ci-dessus ou le chargement de <code class="bg-slate-100 px-1 rounded">/assets/js/config.js</code>.</p>';
      }
      cachedScholarshipRows = [];
      return;
    }
    if (banner) banner.classList.add('hidden');
    try {
      window.__saScholarshipsSdkAttempts = 0;
    } catch (_) {}

    if (!__scholarshipsAuthListenerBound) {
      __scholarshipsAuthListenerBound = true;
      sb.auth.onAuthStateChange(function (event, _session) {
        /* Comme espace-etudiant.mjs : INITIAL_SESSION / TOKEN_REFRESHED peuvent arriver après le 1er getSession(). */
        if (
          event !== 'INITIAL_SESSION' &&
          event !== 'SIGNED_IN' &&
          event !== 'SIGNED_OUT' &&
          event !== 'USER_UPDATED' &&
          event !== 'TOKEN_REFRESHED'
        ) {
          return;
        }
        try {
          clearTimeout(window.__saScholarshipsAuthDebounce);
        } catch (_) {}
        window.__saScholarshipsAuthDebounce = setTimeout(function () {
          initPage();
        }, 200);
      });
    }

    const gate = $('scholarshipsGate');
  const form = $('scholarshipsForm');
  let { data: sess } = await sb.auth.getSession();
  if (!sess?.session && !window.__saScholarshipsRefreshTried) {
    window.__saScholarshipsRefreshTried = true;
    try {
      const { data: ref } = await sb.auth.refreshSession();
      if (ref && ref.session) sess = ref;
    } catch (_) {}
  }
  const user = sess?.session?.user || null;

  let isAdminUser = false;
  if (user) {
    try {
      const { data: adm, error: admErr } = await sb.rpc('is_admin');
      if (!admErr && adm === true) isAdminUser = true;
    } catch (_) {}
  }
  lastScholarshipsIsAdmin = isAdminUser;

  const heroLogin = $('scholarshipsHeroCtaLogin');
  const heroDash = $('scholarshipsHeroCtaDashboard');
  if (heroLogin && heroDash) {
    if (user) {
      heroLogin.classList.add('hidden');
      heroDash.classList.remove('hidden');
    } else {
      heroLogin.classList.remove('hidden');
      heroDash.classList.add('hidden');
    }
  }

  if (user) {
    if (gate) gate.classList.add('hidden');
    if (form) form.classList.remove('hidden');
  } else {
    if (gate) gate.classList.remove('hidden');
    if (form) form.classList.add('hidden');
  }

  try {
    cachedScholarshipRows = await loadPosts(sb);
    bindScholarshipScopeChips();
    lastScholarshipsUserId = user?.id || null;
    lastScholarshipsLogged = !!user;
    renderList(
      sb,
      filterScholarshipRows(cachedScholarshipRows),
      lastScholarshipsUserId,
      lastScholarshipsLogged,
      lastScholarshipsIsAdmin,
      cachedScholarshipRows,
    );
    scrollToScholarshipIfHash();
    const err = $('scholarshipsLoadError');
    if (err) err.classList.add('hidden');
    try {
      window.__saScholarshipsListAttempts = 0;
    } catch (_) {}
  } catch (e) {
    window.__saScholarshipsListAttempts = (window.__saScholarshipsListAttempts || 0) + 1;
    if (window.__saScholarshipsListAttempts < 2) {
      await new Promise((r) => setTimeout(r, 2000));
      return initPage();
    }
    const err = $('scholarshipsLoadError');
    if (err) {
      const detail = e && e.message ? e.message : String(e);
      let text =
        'Les fiches bourses ne peuvent pas être chargées pour le moment (migration Supabase ou droits à vérifier). Détails : ' +
        detail;
      if (/source_url|external_image_url|scope_category|application_deadline|does not exist|42703/i.test(detail)) {
        text +=
          '\n\n→ Exécutez la migration SQL `016_student_scholarship_posts.sql` dans le SQL Editor Supabase, créez le bucket public `scholarship-offers`, puis actualisez cette page.';
      }
      err.textContent = text;
      err.classList.remove('hidden');
    }
    const jl = $('scholarshipsList');
    if (jl) {
      jl.innerHTML =
        '<p class="text-center text-sm text-slate-600 py-8">Impossible d’afficher les bourses pour le moment. Le détail figure au-dessus ; vous pouvez aussi réessayer plus tard ou nous écrire : contact@studyalready.com</p>';
    }
    cachedScholarshipRows = [];
  }

  const importBtn = $('scholarshipsImportLinkBtn');
  if (importBtn && !importBtn.dataset.bound) {
    importBtn.dataset.bound = '1';
    importBtn.addEventListener('click', async () => {
      const contactRaw = (($('scholarshipsContact') && $('scholarshipsContact').value) || '').trim();
      const contactIsBareUrl =
        /^https?:\/\//i.test(contactRaw) && !/\s/.test(contactRaw) && contactRaw.length <= 2000;
      let raw = (($('scholarshipsSourceUrl') && $('scholarshipsSourceUrl').value) || '').trim();
      if (!raw && contactIsBareUrl) raw = contactRaw;
      const u = normalizeUrl(raw);
      if (!u) {
        setImportMsg('Collez une URL dans « Lien officiel » ou une URL seule dans « Candidature / contact ».', true);
        return;
      }
      setImportMsg('Lecture de la page…', false);
      const prev = importBtn.textContent;
      importBtn.disabled = true;
      importBtn.textContent = '…';
      const r = await fetchMicrolinkPreview(u);
      importBtn.disabled = false;
      importBtn.textContent = prev;
      if (r.error) {
        setImportMsg(r.error, true);
        return;
      }
      const ti = $('scholarshipsTitle');
      const de = $('scholarshipsDesc');
      try {
        const hn = new URL(u).hostname.replace(/^www\./i, '');
        if (ti) ti.value = hn.length >= 3 ? hn.slice(0, 80) : '';
      } catch {
        if (ti) ti.value = '';
      }
      if (de) {
        const bits = [];
        if (r.title) bits.push(r.title.trim());
        if (r.description) bits.push(r.description.trim());
        const merged = bits.join('\n\n').slice(0, 8000);
        if (merged) de.value = merged;
      }
      const su = $('scholarshipsSourceUrl');
      if (su) su.value = u;
      const jc = $('scholarshipsContact');
      if (jc && normalizeUrl(contactRaw) === u) jc.value = '';
      const hi = $('scholarshipsExternalImageUrl');
      if (hi) hi.value = r.imageUrl || '';
      setImportMsg('Titre court = nom du site source ; le détail de la page est dans le texte. Vérifiez puis publiez.', false);
    });
  }

  const formEl = $('scholarshipsForm');
  if (formEl && !formEl.dataset.bound) {
    formEl.dataset.bound = '1';
    formEl.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const { data: s2 } = await sb.auth.getSession();
      const u = s2?.session?.user;
      if (!u) {
        alert('Connectez-vous pour publier.');
        return;
      }
      let description = ($('scholarshipsDesc') && $('scholarshipsDesc').value) || '';
      const contactRaw = (($('scholarshipsContact') && $('scholarshipsContact').value) || '').trim();
      const contactIsBareUrl =
        /^https?:\/\//i.test(contactRaw) && !/\s/.test(contactRaw) && contactRaw.length <= 2000;

      let rawSource = (($('scholarshipsSourceUrl') && $('scholarshipsSourceUrl').value) || '').trim();
      const usedContactAsSourceOnly = !rawSource && contactIsBareUrl;
      if (usedContactAsSourceOnly) rawSource = contactRaw;

      const normalizedSource = rawSource ? normalizeUrl(rawSource) : '';
      const source_url = normalizedSource || null;

      let contact_hint = contactRaw || null;
      if (usedContactAsSourceOnly && source_url) contact_hint = null;
      let external_image_url = (($('scholarshipsExternalImageUrl') && $('scholarshipsExternalImageUrl').value) || '').trim() || null;
      if (external_image_url && !external_image_url.startsWith('https://')) external_image_url = null;

      const fileIn = $('scholarshipsImage');
      const file = fileIn && fileIn.files && fileIn.files[0] ? fileIn.files[0] : null;

      if (file && file.size > MAX_IMAGE_BYTES) {
        alert('Image trop volumineuse (max. 4 Mo).');
        return;
      }

      if (file) external_image_url = null;

      const hasFile = !!file;
      const hasDesc = description.trim().length >= 10;
      const hasExtImg = !!external_image_url;
      const hasValidSource =
        !!source_url && /^https?:\/\//i.test(source_url) && source_url.length >= 12;

      if (!hasFile && !hasDesc && !hasExtImg && !hasValidSource) {
        alert('Ajoutez une description (10 caractères), une image, un lien importé avec image, ou un lien https valide (12 caractères minimum).');
        return;
      }

      if (!hasDesc && !hasFile && !hasExtImg && hasValidSource) {
        description = `Lien vers la fiche officielle :\n${source_url}`;
      }

      const title = deriveTitle({
        title: ($('scholarshipsTitle') && $('scholarshipsTitle').value) || '',
        description,
        source_url,
        file,
      });

      const msg = $('scholarshipsFormMsg');
      if (msg) {
        msg.textContent = 'Publication…';
        msg.classList.remove('hidden', 'text-red-700');
        msg.classList.add('text-slate-600');
      }

      let image_path = null;
      if (file) {
        const ext = safeFilePart(file.name);
        const path = `${u.id}/${Date.now()}_${ext}`;
        const up = await sb.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });
        if (up.error) {
          if (msg) {
            msg.textContent = up.error.message || 'Échec du téléversement.';
            msg.classList.add('text-red-700');
          }
          return;
        }
        image_path = path;
      }

      const scope_category = normalizeScopeCategory($('scholarshipsScope') && $('scholarshipsScope').value);
      let application_deadline = null;
      const dlEl = $('scholarshipsDeadline');
      const dlRaw = dlEl && dlEl.value ? String(dlEl.value).trim() : '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dlRaw)) application_deadline = dlRaw;

      const row = {
        user_id: u.id,
        author_label: authorFromUser(u),
        title,
        description: description.trim(),
        contact_hint,
        image_path,
        source_url: source_url || null,
        external_image_url: external_image_url || null,
        scope_category,
        application_deadline,
      };

      let ins = await sb.from('student_scholarship_posts').insert(row).select('id').maybeSingle();
      const errStr = (err) => String((err && err.message) || '');

      if (ins.error && /application_deadline|does not exist|42703|PGRST204/i.test(errStr(ins.error))) {
        const { application_deadline: _dl, ...rowNoDl } = row;
        ins = await sb.from('student_scholarship_posts').insert(rowNoDl).select('id').maybeSingle();
      }

      if (ins.error && /scope_category|does not exist|42703|PGRST204/i.test(errStr(ins.error))) {
        const { scope_category: _sc, application_deadline: _dl2, ...rowNoScope } = row;
        ins = await sb.from('student_scholarship_posts').insert(rowNoScope).select('id').maybeSingle();
      }

      if (ins.error) {
        if (image_path) {
          try {
            await sb.storage.from(BUCKET).remove([image_path]);
          } catch (_) {}
        }
        if (msg) {
          msg.textContent = ins.error.message || 'Insertion refusée.';
          msg.classList.add('text-red-700');
        }
        return;
      }

      formEl.reset();
      const hi = $('scholarshipsExternalImageUrl');
      if (hi) hi.value = '';
      setImportMsg('', false);
      if (msg) {
        msg.textContent = 'Fiche publiée.';
        msg.classList.remove('text-red-700');
        msg.classList.add('text-emerald-700');
      }
      initPage();
    });
  }
  } finally {
    try {
      window.__saScholarshipsPageBootstrapped = true;
    } catch (_) {}
  }
}

try {
  window.__saScholarshipsScriptLoaded = true;
} catch (_) {}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

window.addEventListener('hashchange', scrollToScholarshipIfHash);
