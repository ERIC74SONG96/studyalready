import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OG_DIR = path.join(DIST_DIR, 'assets/img/og');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.name === 'index.html') out.push(abs);
  }
  return out;
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function routeFromHtml(abs, html) {
  const canonical = html.match(/rel=["']canonical["']\s+href=["']https:\/\/www\.studyalready\.com([^"']*)["']/i);
  if (canonical) return canonical[1] || '/';
  const rel = path.relative(DIST_DIR, abs).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  return '/' + rel.replace(/\/index\.html$/, '');
}

function slugFromRoute(route) {
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '--');
}

function titleFromHtml(html) {
  const m = html.match(/<title>(.*?)<\/title>/is);
  return (m ? m[1] : 'StudyAlready').replace(/\s+/g, ' ').replace(/\s*[|—].*$/, '').trim();
}

function splitTitle(title) {
  const words = title.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 34 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function svgForTitle(title) {
  const lines = splitTitle(title);
  const tspans = lines.map((line, i) =>
    `<tspan x="88" y="${248 + i * 66}">${escapeXml(line)}</tspan>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a2540"/>
      <stop offset="0.55" stop-color="#1e3a8a"/>
      <stop offset="1" stop-color="#0a2540"/>
    </linearGradient>
    <radialGradient id="halo" cx="72%" cy="18%" r="62%">
      <stop offset="0" stop-color="#f5b800" stop-opacity=".36"/>
      <stop offset="1" stop-color="#f5b800" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#halo)"/>
  <circle cx="1030" cy="110" r="150" fill="#f5b800" opacity=".14"/>
  <circle cx="96" cy="558" r="210" fill="#ffffff" opacity=".06"/>
  <rect x="70" y="70" width="1060" height="490" rx="42" fill="#ffffff" opacity=".08" stroke="#ffffff" stroke-opacity=".18"/>
  <text x="88" y="140" fill="#f5b800" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="4">STUDYALREADY</text>
  <text fill="#ffffff" font-family="Poppins, Inter, Arial, sans-serif" font-size="54" font-weight="800">${tspans}</text>
  <text x="88" y="520" fill="#dbeafe" font-family="Inter, Arial, sans-serif" font-size="28">Équivalence FWB • Belgique • Suivi jusqu'aux originaux</text>
</svg>
`;
}

fs.mkdirSync(OG_DIR, { recursive: true });
for (const abs of walk(DIST_DIR)) {
  if (abs.includes(`${path.sep}assets${path.sep}`)) continue;
  const html = fs.readFileSync(abs, 'utf8');
  const route = routeFromHtml(abs, html);
  const slug = slugFromRoute(route);
  const title = titleFromHtml(html);
  fs.writeFileSync(path.join(OG_DIR, `${slug}.svg`), svgForTitle(title));
}

console.log('Images OG générées dans dist/assets/img/og/.');
