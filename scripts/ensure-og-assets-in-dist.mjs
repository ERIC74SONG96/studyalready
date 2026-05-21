#!/usr/bin/env node
/** Garantit que les PNG OG sont présents dans dist/ après le build (Vercel). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SRC_COVER = path.join(ROOT, 'assets', 'img', 'og-cover.png');
const SRC_OG = path.join(ROOT, 'assets', 'img', 'og');

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

if (!fs.existsSync(DIST)) {
  console.error('ensure-og-assets-in-dist: dist/ introuvable');
  process.exit(1);
}

let n = 0;
if (copyIfExists(SRC_COVER, path.join(DIST, 'assets', 'img', 'og-cover.png'))) n += 1;

if (fs.existsSync(SRC_OG)) {
  for (const name of fs.readdirSync(SRC_OG)) {
    if (!name.endsWith('.png')) continue;
    if (copyIfExists(path.join(SRC_OG, name), path.join(DIST, 'assets', 'img', 'og', name))) n += 1;
  }
}

console.log(`ensure-og-assets-in-dist: ${n} fichier(s) PNG copié(s).`);
