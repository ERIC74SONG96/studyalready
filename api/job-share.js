const SUPABASE_URL = 'https://nevdhyekybmtvejhwhxz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldmRoeWVreWJtdHZlamh3aHh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA4MzUsImV4cCI6MjA5NDA4NjgzNX0.drps-e29P2HfISCRsqglnbsi3YjYqw3_jIj2F4WYBOc';
const JOBS_PAGE_URL = 'https://www.studyalready.com/offres-etudiants';
const FALLBACK_OG_IMAGE = 'https://www.studyalready.com/assets/img/og/offres-etudiants.svg';
const BUCKET = 'job-offers';

const OFFER_CATEGORY_LABELS = {
  soutien_scolaire: 'Soutien scolaire',
  emploi_universitaire: 'Emploi étudiant',
  stage: 'Stage',
  autre_communaute: 'Autre partage',
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clipText(value, max = 200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function stripLinksAndNoise(description) {
  return String(description || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter((line) => !/^lien\s*:/i.test(line))
    .filter((line) => !/^lien vers/i.test(line))
    .filter((line) => !/^image\s*:/i.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeJobId(raw) {
  const id = String(raw || '').trim();
  if (!/^[a-z0-9-]{8,64}$/i.test(id)) return '';
  return id;
}

function categoryLabel(value) {
  const key = String(value || '').trim();
  return OFFER_CATEGORY_LABELS[key] || 'Annonce étudiante';
}

function pickImageUrl(job) {
  const ext = String(job?.external_image_url || '').trim();
  if (/^https:\/\//i.test(ext)) return ext;
  const imagePath = String(job?.image_path || '').trim();
  if (!imagePath) return FALLBACK_OG_IMAGE;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(imagePath)}`;
}

async function fetchJob(id) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: 'application/json',
  };

  const selects = [
    'id,title,description,author_label,created_at,offer_category,external_image_url,image_path',
    'id,title,description,author_label,created_at,image_path',
  ];

  let lastError = null;
  for (let i = 0; i < selects.length; i++) {
    const endpoint =
      `${SUPABASE_URL}/rest/v1/student_job_posts` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=${encodeURIComponent(selects[i])}` +
      `&limit=1`;

    const res = await fetch(endpoint, { headers });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data && data.message ? String(data.message) : `Supabase ${res.status}`;
      lastError = new Error(message);
      const missingCol = /column .* does not exist/i.test(message) || String(data?.code || '') === '42703';
      if (missingCol && i < selects.length - 1) continue;
      throw lastError;
    }

    if (Array.isArray(data) && data.length) return data[0];
    if (Array.isArray(data) && data.length === 0) return null;
    lastError = new Error('Réponse Supabase invalide');
  }

  if (lastError) throw lastError;
  return null;
}

function renderNotFound(url) {
  const title = 'Offre introuvable | StudyAlready';
  const description = 'Cette annonce n’existe plus ou a été supprimée.';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="noindex,nofollow" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${escapeHtml(FALLBACK_OG_IMAGE)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(FALLBACK_OG_IMAGE)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />
</head>
<body style="font-family:Inter,system-ui,sans-serif;margin:0;padding:2rem;background:#f8fafc;color:#0f172a;">
  <main style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:1.25rem 1.25rem 1rem;">
    <h1 style="margin:0 0 .5rem;font-size:1.5rem;">Offre introuvable</h1>
    <p style="margin:.25rem 0 1rem;color:#475569;">Cette annonce n’existe plus ou a été supprimée.</p>
    <a href="${JOBS_PAGE_URL}" style="display:inline-block;background:#0a2540;color:#fff;text-decoration:none;padding:.65rem 1rem;border-radius:999px;font-weight:600;">
      Voir les annonces récentes
    </a>
  </main>
</body>
</html>`;
}

function renderJobPage(job, pageUrl) {
  const cat = categoryLabel(job.offer_category);
  const title = clipText(job.title || `${cat} — StudyAlready`, 120);
  const bodyText = stripLinksAndNoise(job.description);
  const description = clipText(
    bodyText || `${cat}. Annonce publiée par un membre de la communauté StudyAlready.`,
    220
  );
  const image = pickImageUrl(job);
  const createdAt = job.created_at
    ? new Date(job.created_at).toLocaleString('fr-BE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const author = clipText(job.author_label || 'Membre StudyAlready', 60);
  const boardUrl = `${JOBS_PAGE_URL}#job-${job.id}`;
  const pageTitle = `${title} | StudyAlready`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:site_name" content="StudyAlready" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body style="font-family:Inter,system-ui,sans-serif;margin:0;padding:2rem;background:#f8fafc;color:#0f172a;">
  <main style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:1.25rem 1.25rem 1rem;">
    <p style="margin:0 0 .5rem;font-size:.75rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#1e3a8a;">${escapeHtml(cat)}</p>
    <h1 style="margin:0 0 .6rem;font-size:1.5rem;line-height:1.25;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 1rem;color:#475569;">${escapeHtml(description)}</p>
    <p style="margin:0 0 1rem;font-size:.85rem;color:#64748b;">
      ${createdAt ? `Publié le ${escapeHtml(createdAt)} · ` : ''}${escapeHtml(author)}
    </p>
    <a href="${escapeHtml(boardUrl)}" style="display:inline-block;background:#0a2540;color:#fff;text-decoration:none;padding:.65rem 1rem;border-radius:999px;font-weight:600;">
      Voir l’annonce complète sur StudyAlready
    </a>
    <p style="margin:.9rem 0 0;font-size:.75rem;color:#64748b;">
      StudyAlready est une plateforme communautaire. Les annonces sont publiées par les membres.
    </p>
  </main>
</body>
</html>`;
}

export default async function handler(req, res) {
  const id = normalizeJobId(req?.query?.id);
  const pageUrl = `https://www.studyalready.com/offres-etudiants/job/${encodeURIComponent(id || '')}`;

  if (!id) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderNotFound(pageUrl));
    return;
  }

  try {
    const job = await fetchJob(id);
    if (!job) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderNotFound(pageUrl));
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600');
    res.end(renderJobPage(job, pageUrl));
  } catch (_error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderNotFound(pageUrl));
  }
}
