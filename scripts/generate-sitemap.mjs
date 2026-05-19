import fs from 'node:fs';
import path from 'node:path';
import { listStaticHtmlPages } from '../src/lib/static-html-pages.mjs';

const ROOT_DIR = process.cwd();
const BASE_URL = 'https://www.studyalready.com';
const OUTPUT_PATH = path.join(ROOT_DIR, 'sitemap.xml');

const NOINDEX_ROUTES = new Set([
  '/404',
  '/admin',
  '/admin-login',
  '/dashboard',
  '/espace-etudiant',
  '/espace-etudiant/dashboard',
  '/jobs-etudiants',
]);

function routeFromSourcePath(sourcePath) {
  if (sourcePath === 'index.html') return '/';
  return '/' + sourcePath.replace(/\/index\.html$/, '').replace(/\.html$/, '');
}

function shouldExcludeRoute(route) {
  if (NOINDEX_ROUTES.has(route)) return true;
  return false;
}

function sourceForRoute(route, routeToSourceMap) {
  if (route === '/') return 'index.html';
  return routeToSourceMap.get(route);
}

function lastmodForSource(sourcePath) {
  const abs = path.join(ROOT_DIR, sourcePath);
  const stat = fs.statSync(abs);
  return stat.mtime.toISOString().slice(0, 10);
}

function attrsForRoute(route) {
  if (route === '/') return { changefreq: 'weekly', priority: '1.0' };
  if (route === '/blog') return { changefreq: 'weekly', priority: '0.85' };
  if (route.startsWith('/blog/')) return { changefreq: 'monthly', priority: '0.8' };
  if (
    route.startsWith('/mentions-legales') ||
    route.startsWith('/politique-') ||
    route.startsWith('/conditions-generales')
  ) {
    return { changefreq: 'yearly', priority: '0.35' };
  }
  return { changefreq: 'monthly', priority: '0.75' };
}

function xmlEntry(route, lastmod) {
  const loc = route === '/' ? `${BASE_URL}/` : `${BASE_URL}${route}`;
  const attrs = attrsForRoute(route);
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${attrs.changefreq}</changefreq>`,
    `    <priority>${attrs.priority}</priority>`,
    '  </url>',
  ].join('\n');
}

const pages = listStaticHtmlPages();
const routeToSource = new Map(pages.map((page) => [routeFromSourcePath(page.sourcePath), page.sourcePath]));
const routes = ['/', ...pages.map((page) => routeFromSourcePath(page.sourcePath))]
  .filter((route, index, all) => all.indexOf(route) === index)
  .filter((route) => !shouldExcludeRoute(route))
  .sort((a, b) => a.localeCompare(b, 'fr'));

const entries = routes.map((route) => {
  const sourcePath = sourceForRoute(route, routeToSource);
  if (!sourcePath) {
    throw new Error(`Impossible de retrouver la source pour la route: ${route}`);
  }
  const lastmod = lastmodForSource(sourcePath);
  return xmlEntry(route, lastmod);
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries,
  '</urlset>',
  '',
].join('\n');

fs.writeFileSync(OUTPUT_PATH, xml, 'utf8');
console.log(`Sitemap généré (${routes.length} URLs): ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
