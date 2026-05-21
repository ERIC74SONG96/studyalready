/**
 * Open Graph — helpers partagés (sync source HTML + build Astro).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_SITE = 'StudyAlready';
export const OG_DEFAULT_IMAGE = 'https://www.studyalready.com/assets/img/og-cover.png';

const SKIP_PATH_SEGMENTS = new Set([
  'admin',
  'admin-login',
  'offline',
  'assets',
  'scripts',
  'supabase',
  'node_modules',
  'dist',
  '.astro',
  '.git',
]);

const SKIP_FILES = new Set([
  'admin.html',
  'dashboard.html',
  'offline.html',
  'google6b825c246d60bec6.html',
  'google670b42c1f0efa7d1.html',
]);

export function shouldSkipHtml(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (SKIP_FILES.has(norm)) return true;
  if (norm.startsWith('assets/')) return true;
  const parts = norm.split('/');
  return parts.some((p) => SKIP_PATH_SEGMENTS.has(p));
}

export function routeFromRelPath(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm === 'index.html') return '/';
  if (norm.endsWith('/index.html')) {
    return '/' + norm.slice(0, -'/index.html'.length);
  }
  if (norm.endsWith('.html')) {
    return '/' + norm.slice(0, -5);
  }
  return '/';
}

export function ogSlugFromRoute(route) {
  if (route === '/') return 'home';
  return route.replace(/^\//, '').replace(/\//g, '--');
}

export function ogImageUrlForRoute(route) {
  const slug = ogSlugFromRoute(route);
  if (slug === 'home') return OG_DEFAULT_IMAGE;
  return `https://www.studyalready.com/assets/img/og/${slug}.png`;
}

function metaContent(html, attr, name) {
  const re = new RegExp(`<meta\\s+[^>]*?${attr}=["']${name}["'][^>]*?>`, 'gi');
  let tag;
  while ((tag = re.exec(html)) !== null) {
    const m = tag[0].match(/\bcontent=(["'])([\s\S]*?)\1/i);
    if (m) return m[2].replace(/\s+/g, ' ').trim();
  }
  return '';
}

export function parseHeadFields(html) {
  const titleM = html.match(/<title>([\s\S]*?)<\/title>/i);
  const description = metaContent(html, 'name', 'description');
  const canonM = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)
    || html.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["']/i);

  const title = (titleM ? titleM[1] : 'StudyAlready').replace(/\s+/g, ' ').trim();
  const canonical = canonM ? canonM[1].trim() : '';
  const ogTitle = title.replace(/\s*[|—–-]\s*StudyAlready\s*$/i, '').trim() || title;
  const ogDescription =
    description.length > 200 ? description.slice(0, 197) + '…' : description;

  return {
    title,
    description,
    canonical,
    ogTitle,
    ogDescription: ogDescription || ogTitle,
  };
}

export function isBlogRoute(route) {
  return route.startsWith('/blog/') && route !== '/blog';
}

export function ogTypeForRoute(route) {
  if (route === '/') return 'website';
  if (isBlogRoute(route) || route.startsWith('/blog')) return 'article';
  return 'website';
}

export function buildOpenGraphBlock({ route, ogTitle, ogDescription, canonical, imageUrl, type }) {
  const url = canonical || `https://www.studyalready.com${route === '/' ? '' : route}`;
  const img = imageUrl || ogImageUrlForRoute(route);
  const desc = ogDescription || ogTitle;
  const lines = [
    '  <!-- Open Graph (WhatsApp, Facebook, LinkedIn) -->',
    `  <meta property="og:site_name" content="${OG_SITE}" />`,
    `  <meta property="og:title" content="${escapeAttr(ogTitle)}" />`,
    `  <meta property="og:description" content="${escapeAttr(desc)}" />`,
    `  <meta property="og:type" content="${type}" />`,
    `  <meta property="og:url" content="${escapeAttr(url)}" />`,
    `  <meta property="og:image" content="${escapeAttr(img)}" />`,
    `  <meta property="og:image:width" content="${OG_SIZE.width}" />`,
    `  <meta property="og:image:height" content="${OG_SIZE.height}" />`,
    `  <meta property="og:image:alt" content="${escapeAttr(ogTitle)}" />`,
    '  <meta property="og:locale" content="fr_BE" />',
    '  <!-- Twitter / X -->',
    '  <meta name="twitter:card" content="summary_large_image" />',
    `  <meta name="twitter:title" content="${escapeAttr(ogTitle)}" />`,
    `  <meta name="twitter:description" content="${escapeAttr(desc)}" />`,
    `  <meta name="twitter:image" content="${escapeAttr(img)}" />`,
  ];
  if (type === 'article' && isBlogRoute(route)) {
    lines.splice(
      lines.findIndex((l) => l.includes('og:locale')),
      0,
      '  <meta property="article:author" content="StudyAlready" />'
    );
  }
  return lines.join('\n');
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

export function stripOpenGraphBlock(html) {
  return html
    .replace(/\s*<!--\s*Open Graph[\s\S]*?-->\s*/gi, '\n')
    .replace(/\s*<!--\s*Twitter[\s\S]*?-->\s*/gi, '\n')
    .replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/\s*<meta\s+property=["']article:[^"']+["'][^>]*>\s*/gi, '');
}

export function injectOpenGraph(html, sourcePath) {
  const rel = sourcePath.replace(/\\/g, '/');
  const route = routeFromRelPath(rel);
  const fields = parseHeadFields(html);
  const canonical = fields.canonical || `https://www.studyalready.com${route === '/' ? '' : route}`;
  const block = buildOpenGraphBlock({
    route,
    ogTitle: fields.ogTitle,
    ogDescription: fields.ogDescription || fields.description,
    canonical,
    imageUrl: ogImageUrlForRoute(route),
    type: ogTypeForRoute(route),
  });

  let next = stripOpenGraphBlock(html);
  next = next.replace(/https:\/\/www\.studyalready\.com\/assets\/img\/og-cover\.svg/g, OG_DEFAULT_IMAGE);
  next = next.replace(/https:\/\/www\.studyalready\.com\/assets\/img\/og\/[^"']+\.svg/g, (m) =>
    m.replace(/\.svg$/, '.png')
  );
  next = next.replace(/https:\/\/www\.studyalready\.com\/assets\/img\/blog\/[^"']+\.svg/g, (m) => {
    const slug = ogSlugFromRoute(route);
    return `https://www.studyalready.com/assets/img/og/${slug}.png`;
  });

  if (/<\/head>/i.test(next)) {
    const anchor = next.match(/<link\s+rel=["']canonical["'][^>]*>/i);
    if (anchor) {
      return next.replace(anchor[0], `${anchor[0]}\n${block}`);
    }
    const desc = next.match(/<meta\s+name=["']description["'][^>]*>/i);
    if (desc) {
      return next.replace(desc[0], `${desc[0]}\n${block}`);
    }
    return next.replace(/<\/head>/i, `${block}\n</head>`);
  }
  return next;
}
