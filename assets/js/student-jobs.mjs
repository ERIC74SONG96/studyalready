/**
 * Mur des offres job étudiant — lecture publique, publication réservée aux comptes connectés.
 * Fichier renommé (student-jobs.mjs) pour éviter le cache navigateur/CDN sur l’ancien nom.
 * Requiert les migrations 010 + 014 (lien) + 015 (catégories) et le bucket Storage public `job-offers`.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

const BUCKET = 'job-offers';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** URL canonique pour le partage (trafic vers le site). */
const CANONICAL_JOBS_PAGE = 'https://www.studyalready.com/offres-etudiants.html';

const OFFER_CATEGORY_LABELS = {
  soutien_scolaire: 'Soutien scolaire',
  emploi_universitaire: 'Emploi étudiant',
  stage: 'Stage',
  autre_communaute: 'Autre partage',
};

function normalizeOfferCategory(v) {
  const s = String(v || '').trim();
  return Object.prototype.hasOwnProperty.call(OFFER_CATEGORY_LABELS, s) ? s : 'autre_communaute';
}

let cachedJobRows = [];
let jobsCategoryFilter = '';
let lastJobsUserId = null;
let lastJobsLogged = false;

function filterJobRows(rows) {
  if (!jobsCategoryFilter) return rows || [];
  return (rows || []).filter((r) => normalizeOfferCategory(r.offer_category) === jobsCategoryFilter);
}

function bindJobCategoryChips() {
  const wrap = document.getElementById('jobsCategoryChips');
  if (!wrap || wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-job-cat]');
    if (!btn) return;
    jobsCategoryFilter = btn.getAttribute('data-job-cat') ?? '';
    wrap.querySelectorAll('[data-job-cat]').forEach((b) => {
      const on = (b.getAttribute('data-job-cat') || '') === jobsCategoryFilter;
      b.classList.toggle('border-brand-dark', on);
      b.classList.toggle('bg-brand-dark', on);
      b.classList.toggle('text-white', on);
      b.classList.toggle('border-slate-300', !on);
      b.classList.toggle('bg-white', !on);
      b.classList.toggle('text-slate-700', !on);
    });
    const sb = getSb();
    if (!sb) return;
    renderList(sb, filterJobRows(cachedJobRows), lastJobsUserId, lastJobsLogged, cachedJobRows);
  });
}

function getSb() {
  const cfg = (typeof window !== 'undefined' && window.STUDYALREADY_CONFIG) || {};
  const url = cfg.SUPABASE_URL;
  const key = cfg.SUPABASE_ANON_KEY;
  if (!url || !key || String(url).indexOf('REMPLACER') !== -1 || String(key).indexOf('REMPLACER') !== -1) {
    return null;
  }
  return createClient(String(url).trim(), String(key).trim());
}

const $ = (id) => document.getElementById(id);

const escapeHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function escapeAttr(s) {
  return String(s == null ? '')
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

  return 'Offre étudiant';
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
function pickPreferredJobUrl(urls) {
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
function resolveJobExternalHref(row) {
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

  return pickPreferredJobUrl(extractAllHttpUrls(desc));
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
  const el = $('jobsImportLinkMsg');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
  el.classList.toggle('text-red-700', !!isError);
  el.classList.toggle('text-emerald-700', !isError && !!text);
}

function shareLinksForPost(postId, title) {
  const pageUrl = `${CANONICAL_JOBS_PAGE}#job-${postId}`;
  const shortTitle = String(title || 'Offre')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const text = `${shortTitle}\n\nVoir sur StudyAlready :\n${pageUrl}`;
  const wa = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
  const mail = `mailto:?subject=${encodeURIComponent(`Offre : ${shortTitle}`)}&body=${encodeURIComponent(text)}`;
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

function scrollToJobIfHash() {
  const h = typeof window !== 'undefined' ? window.location.hash : '';
  if (!h || h.indexOf('#job-') !== 0) return;
  const id = h.slice(1);
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function loadPosts(sb) {
  const { data, error } = await sb
    .from('student_job_posts')
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

/** Ouverture offre : clic explicite (évite les bugs pointer-events / empilement CSS). */
function ensureJobsListOfferOpenBinding() {
  const host = $('jobsList');
  if (!host || host.dataset.saOfferOpenBound === '1') return;
  host.dataset.saOfferOpenBound = '1';
  host.addEventListener('click', function (ev) {
    if (ev.type !== 'click' || ev.button !== 0) return;
    var el = clickEventTargetElement(ev);
    if (!el || !el.closest) return;
    var art = el.closest('article[data-sa-job-url]');
    if (!art) return;
    var url = art.getAttribute('data-sa-job-url');
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (el.closest('button.jobs-del') || el.closest('button.jobs-copylink')) return;
    var a = el.closest('a[href]');
    if (a) {
      var h = a.getAttribute('href') || '';
      if (a.classList.contains('jobs-share-wa') || a.classList.contains('jobs-share-fb') || a.classList.contains('jobs-share-mail')) return;
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

function renderList(sb, rowsToShow, currentUserId, isLoggedIn, allRowsForLookup) {
  const host = $('jobsList');
  if (!host) return;
  ensureJobsListOfferOpenBinding();
  const lookup = allRowsForLookup || rowsToShow;
  if (!rowsToShow.length) {
    let emptyMsg = isLoggedIn
      ? 'Aucune offre pour le moment. Publiez la première avec le formulaire à droite (ou ci-dessous sur mobile).'
      : 'Aucune offre pour le moment. Soyez le premier à en publier une (compte requis).';
    if (lookup.length && jobsCategoryFilter) {
      emptyMsg =
        'Aucune annonce dans ce type pour le moment. Choisissez « Toutes » ou publiez une annonce dans cette catégorie.';
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
      const del = own
        ? `<button type="button" class="jobs-del cursor-pointer text-xs font-semibold text-red-700 hover:underline" data-id="${escapeHtml(r.id)}">Supprimer</button>`
        : '';
      const jobHref = resolveJobExternalHref(r);
      const imgInner = imgUrl
        ? `<img src="${escapeHtml(imgUrl)}" alt="" class="w-full max-h-72 object-contain" loading="lazy" referrerpolicy="no-referrer" />`
        : '';
      const imgBlock = imgUrl
        ? `<div class="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">${imgInner}</div>`
        : '';
      const titleHtml = `<h3 class="mt-1 font-display font-bold text-lg text-brand-dark leading-snug">${escapeHtml(r.title)}</h3>`;
      const ctaHit = jobHref
        ? `<p class="mt-2"><span class="inline-flex items-center gap-2 rounded-lg bg-brand-gold text-brand-dark font-bold text-sm px-4 py-2.5 shadow-sm">Voir l’offre / postuler →</span></p>`
        : '';
      const sourceHit = jobHref
        ? `<p class="mt-2 text-sm"><span class="text-brand-blue font-semibold underline">Ouvrir sur le site de l’employeur</span></p>`
        : '';
      const contact = r.contact_hint
        ? `<p class="mt-2 text-sm text-brand-blue font-medium whitespace-pre-wrap">${escapeHtml(r.contact_hint)}</p>`
        : '';
      const { wa, fb, mail, pageUrl } = shareLinksForPost(r.id, r.title || 'Offre');
      const shareBlock =
        `<div class="mt-4 pt-3 border-t border-slate-100">` +
        `<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Partager cette annonce</p>` +
        `<div class="mt-2 flex flex-wrap gap-2">` +
        `<a href="${wa}" target="_blank" rel="noopener noreferrer" class="cursor-pointer jobs-share-wa inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2">WhatsApp</a>` +
        `<a href="${fb}" target="_blank" rel="noopener noreferrer" class="cursor-pointer jobs-share-fb inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2">Facebook</a>` +
        `<a href="${mail}" class="cursor-pointer jobs-share-mail inline-flex items-center gap-1 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2">E-mail</a>` +
        `<button type="button" class="cursor-pointer jobs-copylink inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2" data-url="${escapeHtml(pageUrl)}">Copier le lien</button>` +
        `</div></div>`;
      const cat = normalizeOfferCategory(r.offer_category);
      const catLabel = OFFER_CATEGORY_LABELS[cat] || 'Communauté';
      const badge = `<span class="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">${escapeHtml(catLabel)}</span>`;

      const descBlock = `<div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(r.description || '')}</div>`;

      const metaLine =
        `<p class="text-xs text-slate-500">${escapeHtml(fmtDate(r.created_at))} · ${escapeHtml(r.author_label || 'Membre')}</p>`;

      if (jobHref) {
        const ariaCard = escapeAttr('Ouvrir cette offre sur le site de l’annonceur (nouvel onglet)');
        return (
          `<article id="job-${escapeHtml(r.id)}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-28 cursor-pointer group hover:border-brand-gold/50 hover:shadow-md transition sa-job-offer-card" data-post-id="${escapeHtml(r.id)}" data-sa-job-url="${escapeAttr(jobHref)}" aria-label="${ariaCard}">` +
          `<div class="flex flex-wrap items-start justify-between gap-2">` +
          `<div class="min-w-0 flex-1">` +
          metaLine +
          badge +
          titleHtml +
          `</div>` +
          `<div class="shrink-0">${del}</div></div>` +
          ctaHit +
          descBlock +
          imgBlock +
          sourceHit +
          contact +
          shareBlock +
          `</article>`
        );
      }

      return (
        `<article id="job-${escapeHtml(r.id)}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-28 cursor-default" data-post-id="${escapeHtml(r.id)}">` +
        `<div class="flex flex-wrap items-start justify-between gap-2">` +
        `<div class="min-w-0 flex-1">` +
        metaLine +
        badge +
        titleHtml +
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

  host.querySelectorAll('.jobs-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id || !confirm('Supprimer cette offre ?')) return;
      const row = lookup.find((x) => x.id === id);
      const { error } = await sb.from('student_job_posts').delete().eq('id', id);
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

  host.querySelectorAll('.jobs-copylink').forEach((btn) => {
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

let __jobsAuthListenerBound = false;

async function initPage() {
  const banner = $('jobsConfigBanner');
  let sb = getSb();
  if (!sb && !window.__saJobsConfigRetried) {
    window.__saJobsConfigRetried = true;
    await new Promise((r) => setTimeout(r, 400));
    sb = getSb();
  }
  if (!sb) {
    if (banner) banner.classList.remove('hidden');
    const jl = $('jobsList');
    if (jl) {
      jl.innerHTML =
        '<p class="text-center text-sm text-slate-600 py-8">Configuration Supabase absente sur cette page. Vérifiez le bandeau jaune ci-dessus ou le chargement de <code class="bg-slate-100 px-1 rounded">/assets/js/config.js</code>.</p>';
    }
    cachedJobRows = [];
    return;
  }
  if (banner) banner.classList.add('hidden');
  window.__saJobsPageBootstrapped = true;

  if (!__jobsAuthListenerBound) {
    __jobsAuthListenerBound = true;
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
        clearTimeout(window.__saJobsAuthDebounce);
      } catch (_) {}
      window.__saJobsAuthDebounce = setTimeout(function () {
        initPage();
      }, 200);
    });
  }

  const gate = $('jobsGate');
  const form = $('jobsForm');
  let { data: sess } = await sb.auth.getSession();
  if (!sess?.session && !window.__saJobsRefreshTried) {
    window.__saJobsRefreshTried = true;
    try {
      const { data: ref } = await sb.auth.refreshSession();
      if (ref && ref.session) sess = ref;
    } catch (_) {}
  }
  const user = sess?.session?.user || null;

  const heroLogin = $('jobsHeroCtaLogin');
  const heroDash = $('jobsHeroCtaDashboard');
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
    cachedJobRows = await loadPosts(sb);
    bindJobCategoryChips();
    lastJobsUserId = user?.id || null;
    lastJobsLogged = !!user;
    renderList(sb, filterJobRows(cachedJobRows), lastJobsUserId, lastJobsLogged, cachedJobRows);
    scrollToJobIfHash();
    const err = $('jobsLoadError');
    if (err) err.classList.add('hidden');
  } catch (e) {
    const err = $('jobsLoadError');
    if (err) {
      const detail = e && e.message ? e.message : String(e);
      let text =
        'Les offres ne peuvent pas être chargées pour le moment (migration Supabase ou droits à vérifier). Détails : ' +
        detail;
      if (/source_url|external_image_url|offer_category|does not exist|42703/i.test(detail)) {
        text +=
          '\n\n→ Colonnes manquantes : exécutez les migrations SQL du dossier supabase/migrations (014 lien + image, 015 catégories) dans le SQL Editor Supabase, puis rechargez.';
      }
      err.textContent = text;
      err.classList.remove('hidden');
    }
    const jl = $('jobsList');
    if (jl) {
      jl.innerHTML =
        '<p class="text-center text-sm text-slate-600 py-8">Impossible d’afficher les annonces pour le moment. Détail au-dessus ou dans la console du navigateur (F12).</p>';
    }
    cachedJobRows = [];
  }

  const importBtn = $('jobsImportLinkBtn');
  if (importBtn && !importBtn.dataset.bound) {
    importBtn.dataset.bound = '1';
    importBtn.addEventListener('click', async () => {
      const contactRaw = (($('jobsContact') && $('jobsContact').value) || '').trim();
      const contactIsBareUrl =
        /^https?:\/\//i.test(contactRaw) && !/\s/.test(contactRaw) && contactRaw.length <= 2000;
      let raw = (($('jobsSourceUrl') && $('jobsSourceUrl').value) || '').trim();
      if (!raw && contactIsBareUrl) raw = contactRaw;
      const u = normalizeUrl(raw);
      if (!u) {
        setImportMsg('Collez une URL dans « Lien de l’offre » ou une URL seule dans « Comment postuler ».', true);
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
      const ti = $('jobsTitle');
      const de = $('jobsDesc');
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
      const su = $('jobsSourceUrl');
      if (su) su.value = u;
      const jc = $('jobsContact');
      if (jc && normalizeUrl(contactRaw) === u) jc.value = '';
      const hi = $('jobsExternalImageUrl');
      if (hi) hi.value = r.imageUrl || '';
      setImportMsg('Titre court = nom du site source ; le détail de la page est dans le texte. Vérifiez puis publiez.', false);
    });
  }

  const formEl = $('jobsForm');
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
      let description = ($('jobsDesc') && $('jobsDesc').value) || '';
      const contactRaw = (($('jobsContact') && $('jobsContact').value) || '').trim();
      const contactIsBareUrl =
        /^https?:\/\//i.test(contactRaw) && !/\s/.test(contactRaw) && contactRaw.length <= 2000;

      let rawSource = (($('jobsSourceUrl') && $('jobsSourceUrl').value) || '').trim();
      const usedContactAsSourceOnly = !rawSource && contactIsBareUrl;
      if (usedContactAsSourceOnly) rawSource = contactRaw;

      const normalizedSource = rawSource ? normalizeUrl(rawSource) : '';
      const source_url = normalizedSource || null;

      let contact_hint = contactRaw || null;
      if (usedContactAsSourceOnly && source_url) contact_hint = null;
      let external_image_url = (($('jobsExternalImageUrl') && $('jobsExternalImageUrl').value) || '').trim() || null;
      if (external_image_url && !external_image_url.startsWith('https://')) external_image_url = null;

      const fileIn = $('jobsImage');
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
        description = `Lien vers l’offre :\n${source_url}`;
      }

      const title = deriveTitle({
        title: ($('jobsTitle') && $('jobsTitle').value) || '',
        description,
        source_url,
        file,
      });

      const msg = $('jobsFormMsg');
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

      const offer_category = normalizeOfferCategory($('jobsCategory') && $('jobsCategory').value);

      const row = {
        user_id: u.id,
        author_label: authorFromUser(u),
        title,
        description: description.trim(),
        contact_hint,
        image_path,
        source_url: source_url || null,
        external_image_url: external_image_url || null,
        offer_category,
      };

      let usedLegacyInsert = false;
      let ins = await sb.from('student_job_posts').insert(row).select('id').maybeSingle();
      const errStr = (err) => String((err && err.message) || '');

      if (ins.error && /offer_category|does not exist|42703|PGRST204/i.test(errStr(ins.error))) {
        const { offer_category: _rm, ...rowNoCat } = row;
        ins = await sb.from('student_job_posts').insert(rowNoCat).select('id').maybeSingle();
      }

      if (ins.error && /source_url|external_image_url|does not exist|42703|PGRST204/i.test(errStr(ins.error))) {
        let legacyDesc = String(description).trim();
        if (source_url && !legacyDesc.includes(source_url)) {
          legacyDesc = (legacyDesc ? legacyDesc + '\n\n' : '') + 'Lien : ' + source_url;
        }
        if (external_image_url && !legacyDesc.includes(external_image_url)) {
          legacyDesc = (legacyDesc ? legacyDesc + '\n\n' : '') + 'Image : ' + external_image_url;
        }
        if (legacyDesc.length < 10) {
          legacyDesc = String(source_url || external_image_url || 'Annonce').slice(0, 8000);
        }
        const legacyRow = {
          user_id: u.id,
          author_label: authorFromUser(u),
          title,
          description: legacyDesc.slice(0, 8000),
          contact_hint,
          image_path,
        };
        ins = await sb.from('student_job_posts').insert(legacyRow).select('id').maybeSingle();
        usedLegacyInsert = true;
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
      const hi = $('jobsExternalImageUrl');
      if (hi) hi.value = '';
      setImportMsg('', false);
      if (msg) {
        msg.textContent = usedLegacyInsert
          ? 'Offre publiée. Migration SQL 014 sur Supabase : lien + image dédiés en base.'
          : 'Offre publiée.';
        msg.classList.remove('text-red-700');
        msg.classList.add('text-emerald-700');
      }
      initPage();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

window.addEventListener('hashchange', scrollToJobIfHash);
