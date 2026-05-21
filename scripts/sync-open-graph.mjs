#!/usr/bin/env node
/**
 * Injecte / met à jour les balises Open Graph (PNG) dans tous les HTML sources.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectOpenGraph, shouldSkipHtml } from './lib/open-graph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.astro'].includes(entry.name)) continue;
      walkHtml(abs, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
    }
  }
  return out;
}

let updated = 0;
for (const rel of walkHtml(ROOT)) {
  if (shouldSkipHtml(rel)) continue;
  const abs = path.join(ROOT, rel);
  const before = fs.readFileSync(abs, 'utf8');
  const after = injectOpenGraph(before, rel);
  if (after !== before) {
    fs.writeFileSync(abs, after, 'utf8');
    updated += 1;
  }
}

console.log(`Open Graph synchronisé sur ${updated} fichier(s).`);
