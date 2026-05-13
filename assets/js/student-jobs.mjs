/**
 * Mur des offres job étudiant — lecture publique, publication réservée aux comptes connectés.
 * Fichier renommé (student-jobs.mjs) pour éviter le cache navigateur/CDN sur l’ancien nom.
 * Requiert les migrations 010 + 014 et le bucket Storage public `job-offers`.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

const cfg = (typeof window !== 'undefined' && window.STUDYALREADY_CONFIG) || {};
const BUCKET = 'job-offers';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** URL canonique pour le partage (trafic vers le site). */
const CANONICAL_JOBS_PAGE = 'https://www.studyalready.com/offres-etudiants.html';

function getSb() {
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
  const text = `${title}\n\nVoir sur StudyAlready :\n${pageUrl}`;
  return {
    pageUrl,
    wa: `https://wa.me/?text=${encodeURIComponent(text)}`,
    fb: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    mail: `mailto:?subject=${encodeURIComponent(`Offre : ${title}`)}&body=${encodeURIComponent(text)}`,
  };
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

function renderList(sb, rows, currentUserId, isLoggedIn) {
  const host = $('jobsList');
  if (!host) return;
  if (!rows.length) {
    const emptyMsg = isLoggedIn
      ? 'Aucune offre pour le moment. Publiez la première avec le formulaire à droite (ou ci-dessous sur mobile).'
      : 'Aucune offre pour le moment. Soyez le premier à en publier une (compte requis).';
    host.innerHTML = '<p class="text-slate-600 text-center py-10">' + escapeHtml(emptyMsg) + '</p>';
    return;
  }
  host.innerHTML = rows
    .map((r) => {
      const storageUrl = r.image_path ? publicImageUrl(sb, r.image_path) : '';
      const extImg = safeHttpsUrl(r.external_image_url);
      const imgUrl = storageUrl || extImg;
      const own = currentUserId && r.user_id === currentUserId;
      const del = own
        ? `<button type="button" class="jobs-del text-xs font-semibold text-red-700 hover:underline" data-id="${escapeHtml(r.id)}">Supprimer</button>`
        : '';
      const imgBlock = imgUrl
        ? `<div class="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100"><img src="${escapeHtml(imgUrl)}" alt="" class="w-full max-h-72 object-contain" loading="lazy" referrerpolicy="no-referrer" /></div>`
        : '';
      const rawSrc = String(r.source_url || '').trim();
      const sourceHref = /^https?:\/\//i.test(rawSrc) ? rawSrc : '';
      const sourceBlock = sourceHref
        ? `<p class="mt-2 text-sm"><a href="${escapeHtml(sourceHref)}" class="text-brand-blue font-semibold underline" target="_blank" rel="noopener noreferrer">Voir l’offre sur le site d’origine</a></p>`
        : '';
      const contact = r.contact_hint
        ? `<p class="mt-2 text-sm text-brand-blue font-medium whitespace-pre-wrap">${escapeHtml(r.contact_hint)}</p>`
        : '';
      const { wa, fb, mail, pageUrl } = shareLinksForPost(r.id, r.title || 'Offre');
      const shareBlock =
        `<div class="mt-4 pt-3 border-t border-slate-100">` +
        `<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Partager cette annonce</p>` +
        `<div class="mt-2 flex flex-wrap gap-2">` +
        `<a href="${escapeHtml(wa)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2">WhatsApp</a>` +
        `<a href="${escapeHtml(fb)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2">Facebook</a>` +
        `<a href="${escapeHtml(mail)}" class="inline-flex items-center gap-1 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2">E-mail</a>` +
        `<button type="button" class="jobs-copylink inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2" data-url="${escapeHtml(pageUrl)}">Copier le lien</button>` +
        `</div></div>`;

      return (
        `<article id="job-${escapeHtml(r.id)}" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-28" data-post-id="${escapeHtml(r.id)}">` +
        `<div class="flex flex-wrap items-start justify-between gap-2">` +
        `<div><p class="text-xs text-slate-500">${escapeHtml(fmtDate(r.created_at))} · ${escapeHtml(r.author_label || 'Membre')}</p>` +
        `<h3 class="mt-1 font-display font-bold text-lg text-brand-dark">${escapeHtml(r.title)}</h3></div>` +
        `<div class="shrink-0">${del}</div></div>` +
        `<div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(r.description || '')}</div>` +
        imgBlock +
        sourceBlock +
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
      const row = rows.find((x) => x.id === id);
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
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-url');
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        const prev = btn.textContent;
        btn.textContent = 'Copié !';
        setTimeout(() => {
          btn.textContent = prev;
        }, 2000);
      } catch {
        prompt('Copiez ce lien :', url);
      }
    });
  });
}

let __jobsAuthListenerBound = false;

async function initPage() {
  const banner = $('jobsConfigBanner');
  const sb = getSb();
  if (!sb) {
    if (banner) banner.classList.remove('hidden');
    if ($('jobsList')) $('jobsList').innerHTML = '';
    return;
  }
  if (banner) banner.classList.add('hidden');

  if (!__jobsAuthListenerBound) {
    __jobsAuthListenerBound = true;
    sb.auth.onAuthStateChange(function (event) {
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return;
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
  const { data: sess } = await sb.auth.getSession();
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
    const rows = await loadPosts(sb);
    renderList(sb, rows, user?.id || null, !!user);
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
      if (/source_url|external_image_url|does not exist|42703/i.test(detail)) {
        text +=
          '\n\n→ Si le message parle de colonnes manquantes : exécutez « supabase/migrations/014_student_job_posts_link_share.sql » dans le SQL Editor Supabase. La page peut aussi fonctionner sans cette migration (liste + publication avec texte).';
      }
      err.textContent = text;
      err.classList.remove('hidden');
    }
    if ($('jobsList')) $('jobsList').innerHTML = '';
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
      if (ti && r.title) ti.value = r.title.slice(0, 200);
      const de = $('jobsDesc');
      if (de && r.description) de.value = r.description.slice(0, 8000);
      const su = $('jobsSourceUrl');
      if (su) su.value = u;
      const jc = $('jobsContact');
      if (jc && normalizeUrl(contactRaw) === u) jc.value = '';
      const hi = $('jobsExternalImageUrl');
      if (hi) hi.value = r.imageUrl || '';
      setImportMsg('Champs mis à jour à partir du lien. Relisez puis publiez.', false);
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

      const row = {
        user_id: u.id,
        author_label: authorFromUser(u),
        title,
        description: description.trim(),
        contact_hint,
        image_path,
        source_url: source_url || null,
        external_image_url: external_image_url || null,
      };

      let usedLegacyInsert = false;
      let ins = await sb.from('student_job_posts').insert(row).select('id').maybeSingle();
      if (ins.error && /source_url|external_image_url|does not exist|42703|PGRST204/i.test(String(ins.error.message || ''))) {
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
          ? 'Offre publiée. Pour un lien dédié + image Open Graph en base, exécutez la migration SQL 014 sur Supabase.'
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
