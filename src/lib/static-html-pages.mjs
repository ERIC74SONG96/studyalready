import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('../..', import.meta.url)), '..');
const SKIP_DIRS = new Set([
  '.astro',
  '.git',
  '.github',
  '.vercel',
  'dist',
  'node_modules',
  'src',
  'supabase',
]);

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(abs, out);
    } else {
      out.push(abs);
    }
  }
  return out;
}

function shouldExposeIndex(rel) {
  if (rel === 'index.html') return false;
  if (rel === '404/index.html') return false;
  if (!rel.endsWith('/index.html')) return false;
  if (rel.startsWith('assets/')) return false;
  if (rel.startsWith('scripts/')) return false;
  return true;
}

export function listStaticHtmlPages() {
  return walk(ROOT_DIR)
    .map((abs) => toPosix(path.relative(ROOT_DIR, abs)))
    .filter(shouldExposeIndex)
    .map((sourcePath) => ({
      sourcePath,
      slug: sourcePath.replace(/\/index\.html$/, ''),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug, 'fr'));
}

function splitSuffix(url) {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const indexes = [hashIndex, queryIndex].filter((i) => i !== -1);
  const splitAt = indexes.length ? Math.min(...indexes) : -1;
  if (splitAt === -1) return { pathPart: url, suffix: '' };
  return { pathPart: url.slice(0, splitAt), suffix: url.slice(splitAt) };
}

function trimCleanRouteTrailingSlash(route) {
  if (!route || route === '/') return route || '/';
  return route.endsWith('/') ? route.slice(0, -1) : route;
}

function resolveCleanRoute(pathPart, sourcePath) {
  let clean = pathPart.slice(0, -5);
  if (clean === '' || clean === '/index' || clean === 'index' || clean.endsWith('/index')) {
    clean = clean.replace(/\/?index$/, '') || '/';
  }

  if (clean.startsWith('/')) return trimCleanRouteTrailingSlash(clean);
  if (clean.startsWith('../')) {
    return trimCleanRouteTrailingSlash('/' + clean.replace(/^(\.\.\/)+/, ''));
  }

  if (sourcePath && sourcePath.startsWith('blog/') && !clean.startsWith('blog/')) {
    return trimCleanRouteTrailingSlash('/blog/' + clean);
  }

  return trimCleanRouteTrailingSlash('/' + clean);
}

function cleanSiteUrl(url) {
  return url.replace(/https:\/\/www\.studyalready\.com\/([^\s"'<>?#]+?)\.html(?=([?#"'\s<>]|$))/g, (_m, route) => {
    return 'https://www.studyalready.com/' + route.replace(/\/index$/, '');
  }).replace(/https:\/\/www\.studyalready\.com\/([^\s"'<>?#]+?)\/(?=([?#"'\s<>]|$))/g, (_m, route) => {
    return 'https://www.studyalready.com/' + route;
  });
}

function cleanInternalHtmlUrl(rawUrl, sourcePath) {
  const url = String(rawUrl || '').trim();
  if (!url || url.startsWith('#')) return rawUrl;
  if (/^(mailto:|tel:|sms:|https:\/\/wa\.me\/|javascript:)/i.test(url)) return rawUrl;

  const sameOrigin = 'https://www.studyalready.com/';
  const isAbsoluteSameOrigin = url.startsWith(sameOrigin);
  const localUrl = isAbsoluteSameOrigin ? url.slice(sameOrigin.length - 1) : url;
  if (/^https?:\/\//i.test(localUrl) || localUrl.startsWith('//')) return rawUrl;

  if (localUrl.startsWith('/assets/') || localUrl.startsWith('assets/')) return rawUrl;
  if (localUrl.startsWith('/php/') || localUrl.startsWith('php/')) return rawUrl;

  const { pathPart, suffix } = splitSuffix(localUrl);
  if (!pathPart.endsWith('.html')) return rawUrl;

  const clean = resolveCleanRoute(pathPart, sourcePath);
  if (isAbsoluteSameOrigin) {
    return sameOrigin.replace(/\/$/, '') + clean + suffix;
  }
  return clean + suffix;
}

function normalizeInternalLinks(html, sourcePath) {
  return html.replace(/\b(href|action|content)=(["'])(.*?)\2/g, (match, attr, quote, value) => {
    const clean = cleanInternalHtmlUrl(value, sourcePath);
    return `${attr}=${quote}${clean}${quote}`;
  });
}

export function readStaticHtmlPage(sourcePath) {
  const abs = path.join(ROOT_DIR, sourcePath);
  const html = fs.readFileSync(abs, 'utf8');
  return cleanSiteUrl(normalizeInternalLinks(html, sourcePath));
}
