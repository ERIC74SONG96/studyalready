import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const PUBLIC_DIRS = [
  'assets',
  'php',
];

const PUBLIC_FILES = [
  '.htaccess',
  'google6b825c246d60bec6.html',
  'manifest.webmanifest',
  'offline.html',
  'robots.txt',
  'sitemap.xml',
  'sw.js',
];

function copyDir(rel) {
  const src = path.join(ROOT_DIR, rel);
  if (!fs.existsSync(src)) return;
  const dest = path.join(DIST_DIR, rel);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
}

function copyFile(rel) {
  const src = path.join(ROOT_DIR, rel);
  if (!fs.existsSync(src)) return;
  const dest = path.join(DIST_DIR, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const dir of PUBLIC_DIRS) copyDir(dir);
for (const file of PUBLIC_FILES) copyFile(file);

console.log('Assets publics copiés dans dist/.');
