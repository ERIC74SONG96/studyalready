/**
 * Mur des offres job étudiant — lecture publique, publication réservée aux comptes connectés.
 * Requiert la migration 010 + bucket Storage public `job-offers`.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

const cfg = (typeof window !== 'undefined' && window.STUDYALREADY_CONFIG) || {};
const BUCKET = 'job-offers';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

async function loadPosts(sb) {
  const { data, error } = await sb
    .from('student_job_posts')
    .select('id,user_id,author_label,title,description,contact_hint,image_path,created_at')
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

function renderList(sb, rows, currentUserId) {
  const host = $('jobsList');
  if (!host) return;
  if (!rows.length) {
    host.innerHTML =
      '<p class="text-slate-600 text-center py-10">Aucune offre pour le moment. Soyez le premier à en publier une (compte requis).</p>';
    return;
  }
  host.innerHTML = rows
    .map((r) => {
      const imgUrl = r.image_path ? publicImageUrl(sb, r.image_path) : '';
      const own = currentUserId && r.user_id === currentUserId;
      const del = own
        ? `<button type="button" class="jobs-del text-xs font-semibold text-red-700 hover:underline" data-id="${escapeHtml(r.id)}">Supprimer</button>`
        : '';
      const imgBlock = imgUrl
        ? `<div class="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100"><img src="${escapeHtml(imgUrl)}" alt="" class="w-full max-h-72 object-contain" loading="lazy" /></div>`
        : '';
      const contact = r.contact_hint
        ? `<p class="mt-2 text-sm text-brand-blue font-medium whitespace-pre-wrap">${escapeHtml(r.contact_hint)}</p>`
        : '';
      return (
        `<article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-post-id="${escapeHtml(r.id)}">` +
        `<div class="flex flex-wrap items-start justify-between gap-2">` +
        `<div><p class="text-xs text-slate-500">${escapeHtml(fmtDate(r.created_at))} · ${escapeHtml(r.author_label || 'Membre')}</p>` +
        `<h3 class="mt-1 font-display font-bold text-lg text-brand-dark">${escapeHtml(r.title)}</h3></div>` +
        `<div class="shrink-0">${del}</div></div>` +
        `<div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(r.description || '')}</div>` +
        imgBlock +
        contact +
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

  if (user) {
    if (gate) gate.classList.add('hidden');
    if (form) form.classList.remove('hidden');
  } else {
    if (gate) gate.classList.remove('hidden');
    if (form) form.classList.add('hidden');
  }

  try {
    const rows = await loadPosts(sb);
    renderList(sb, rows, user?.id || null);
    const err = $('jobsLoadError');
    if (err) err.classList.add('hidden');
  } catch (e) {
    const err = $('jobsLoadError');
    if (err) {
      err.textContent =
        'Les offres ne peuvent pas être chargées pour le moment (migration Supabase ou droits à vérifier). Détails : ' +
        (e && e.message ? e.message : String(e));
      err.classList.remove('hidden');
    }
    if ($('jobsList')) $('jobsList').innerHTML = '';
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
      const title = ($('jobsTitle') && $('jobsTitle').value) || '';
      const description = ($('jobsDesc') && $('jobsDesc').value) || '';
      const contact_hint = (($('jobsContact') && $('jobsContact').value) || '').trim() || null;
      const fileIn = $('jobsImage');
      const file = fileIn && fileIn.files && fileIn.files[0] ? fileIn.files[0] : null;

      if (file && file.size > MAX_IMAGE_BYTES) {
        alert('Image trop volumineuse (max. 4 Mo).');
        return;
      }
      if (!file && String(description).trim().length < 10) {
        alert('Ajoutez au moins une description (10 caractères) ou une image.');
        return;
      }

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
        title: title.trim(),
        description: description.trim(),
        contact_hint,
        image_path,
      };

      const ins = await sb.from('student_job_posts').insert(row).select('id').maybeSingle();
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
      if (msg) {
        msg.textContent = 'Offre publiée.';
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
