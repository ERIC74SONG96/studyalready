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
  'assets/img/og-cover.png',
  'assets/img/og/home.png',
  'assets/img/og/tarifs-packs.png',
  'assets/img/og/blog--equivalence-bts-cameroun-belgique.png',
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
if (/rel="canonical" href="https:\/\/www\.studyalready\.com\/[^"]+\/"/.test(equivalence)) {
  console.error('Les canonicals du build Astro conservent un slash final non canonique.');
  failed = true;
}

const blogArticle = fs.readFileSync(path.join(DIST_DIR, 'blog/equivalence-bts-cameroun-belgique/index.html'), 'utf8');
if (/href=["']\/?gce-a-level-etudes-fwb/.test(blogArticle)) {
  console.error('Les liens relatifs de blog ne sont pas préfixés par /blog/.');
  failed = true;
}
if (/id=["']blogArticleFull["'][^>]*class=["'][^"']*\bhidden\b/.test(blogArticle)) {
  console.error('Le contenu complet du blog reste masqué dans le HTML généré.');
  failed = true;
}
if (!/https:\/\/www\.studyalready\.com\/assets\/img\/og\/blog--equivalence-bts-cameroun-belgique\.svg/.test(blogArticle)) {
  console.error('L’image Open Graph générée de l’article blog n’est pas référencée.');
  failed = true;
}
if (/assets\/img\/og-cover\.svg/.test(blogArticle)) {
  console.error('Le JSON-LD de l’article conserve encore l’ancienne image OG générique.');
  failed = true;
}

const home = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
if (!/"@type":"FAQPage"|"@type": "FAQPage"/.test(home) || !/"@type":"LocalBusiness"|"@type": "LocalBusiness"/.test(home)) {
  console.error('Les données structurées FAQPage / LocalBusiness sont absentes de la page d’accueil.');
  failed = true;
}

const pricing = fs.readFileSync(path.join(DIST_DIR, 'tarifs-packs/index.html'), 'utf8');
if (!/"@type":"OfferCatalog"|"@type": "OfferCatalog"/.test(pricing)) {
  console.error('Les données structurées OfferCatalog sont absentes de la page tarifs.');
  failed = true;
}

if (failed) process.exit(1);
console.log('Build Astro validé.');
