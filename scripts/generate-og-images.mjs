import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SRC_OG = path.join(ROOT_DIR, 'assets', 'img', 'og');
const DIST_OG = path.join(DIST_DIR, 'assets', 'img', 'og');
const SRC_COVER = path.join(ROOT_DIR, 'assets', 'img', 'og-cover.png');
const DIST_COVER = path.join(DIST_DIR, 'assets', 'img', 'og-cover.png');

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

fs.mkdirSync(DIST_OG, { recursive: true });
copyIfExists(SRC_COVER, DIST_COVER);

if (fs.existsSync(SRC_OG)) {
  for (const name of fs.readdirSync(SRC_OG)) {
    if (!name.endsWith('.png')) continue;
    copyIfExists(path.join(SRC_OG, name), path.join(DIST_OG, name));
  }
}

console.log('Images OG PNG copiées vers dist/assets/img/og/ et og-cover.png.');
