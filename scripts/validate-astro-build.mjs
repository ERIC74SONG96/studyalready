import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const required = [
  'index.html',
  'equivalence/index.html',
  'prequalification-dossier/index.html',
  'espace-etudiant/index.html',
  'espace-etudiant/dashboard/index.html',
  'blog/index.html',
  'assets/css/style.css',
  'assets/js/main.js',
  'manifest.webmanifest',
  'sw.js',
  'offline.html',
  'robots.txt',
  'sitemap.xml',
];

let failed = false;
for (const rel of required) {
  const abs = path.join(DIST_DIR, rel);
  if (!fs.existsSync(abs)) {
    console.error(`Fichier attendu absent du build Astro : ${rel}`);
    failed = true;
  }
}

const sitemap = fs.readFileSync(path.join(DIST_DIR, 'sitemap.xml'), 'utf8');
if (/\.html<\/loc>/.test(sitemap)) {
  console.error('Le sitemap généré contient encore des URL .html.');
  failed = true;
}

const equivalence = fs.readFileSync(path.join(DIST_DIR, 'equivalence/index.html'), 'utf8');
if (/href=["'](?:\/)?tarifs-packs\.html/.test(equivalence)) {
  console.error('Les liens internes .html ne sont pas normalisés dans le build Astro.');
  failed = true;
}

if (failed) process.exit(1);
console.log('Build Astro validé.');
