import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const ASSET_VERSION = '20260515menu2';
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

function routeFromSourcePath(sourcePath) {
  if (sourcePath === 'index.html') return '/';
  return '/' + sourcePath.replace(/\/index\.html$/, '').replace(/\.html$/, '');
}

function ogSlugFromSourcePath(sourcePath) {
  const route = routeFromSourcePath(sourcePath);
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '--');
}

function replaceSocialImage(html, sourcePath) {
  const slug = ogSlugFromSourcePath(sourcePath);
  const url = `https://www.studyalready.com/assets/img/og/${slug}.svg`;
  return html
    .replace(/(<meta\s+property=["']og:image["']\s+content=["'])([^"']+)(["'][^>]*>)/i, `$1${url}$3`)
    .replace(/(<meta\s+name=["']twitter:image["']\s+content=["'])([^"']+)(["'][^>]*>)/i, `$1${url}$3`)
    .replace(/https:\/\/www\.studyalready\.com\/assets\/img\/og-cover\.svg/g, url);
}

function addPreloads(html) {
  if (html.includes('rel="preload" href="/assets/css/style.css')) return html;
  return html.replace('</head>', `  <link rel="preload" href="/assets/css/style.css?v=${ASSET_VERSION}" as="style" />\n</head>`);
}

function versionCriticalAssets(html) {
  return html
    .replace(/\bhref=(["'])(?:\/)?assets\/css\/style\.css(?:\?[^"']*)?\1/g, `href="/assets/css/style.css?v=${ASSET_VERSION}"`)
    .replace(/\bsrc=(["'])(?:\/)?assets\/js\/main\.js(?:\?[^"']*)?\1/g, `src="/assets/js/main.js?v=${ASSET_VERSION}"`)
    .replace(/\bsrc=(["'])(?:\/)?assets\/js\/header\.js(?:\?[^"']*)?\1/g, `src="/assets/js/header.js?v=${ASSET_VERSION}"`);
}

function addImageDefaults(html) {
  return html.replace(/<img\b([^>]*)>/gi, (tag, attrs) => {
    let next = attrs;
    if (!/\bloading=/i.test(next)) next += ' loading="lazy"';
    if (!/\bdecoding=/i.test(next)) next += ' decoding="async"';
    return `<img${next}>`;
  });
}

function exposeBlogArticleContent(html, sourcePath) {
  if (!sourcePath.startsWith('blog/')) return html;
  return html
    .replace(/(<div\b[^>]*id=["']blogArticleGate["'][^>]*class=["'])([^"']*)(["'][^>]*>)/i, (_m, start, cls, end) => {
      const classes = cls.split(/\s+/).filter(Boolean);
      if (!classes.includes('hidden')) classes.push('hidden');
      return start + classes.join(' ') + end;
    })
    .replace(/(<div\b[^>]*id=["']blogArticleFull["'][^>]*class=["'])([^"']*)(["'][^>]*>)/i, (_m, start, cls, end) => {
      const classes = cls.split(/\s+/).filter((c) => c && c !== 'hidden');
      return start + classes.join(' ') + end;
    });
}

function structuredScript(data) {
  return `\n  <script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n  </script>`;
}

function injectStructuredData(html, sourcePath) {
  const route = routeFromSourcePath(sourcePath);
  if (route === '/') {
    const faq = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'StudyAlready est-il un service officiel de la Fédération Wallonie-Bruxelles ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Non. StudyAlready est un accompagnement indépendant : nous préparons et suivons les dossiers, mais les décisions appartiennent aux autorités et établissements compétents.'
          }
        },
        {
          '@type': 'Question',
          name: 'Quels pays sont accompagnés ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Le service est ouvert aux étudiants internationaux, avec une expertise forte Cameroun et Afrique de l’Ouest, pour un projet d’études en Belgique francophone.'
          }
        },
        {
          '@type': 'Question',
          name: 'Les tarifs sont-ils affichés ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Oui. La page Tarifs et packs présente les formules principales et les montants indicatifs avant devis personnalisé.'
          }
        }
      ]
    };
    const localBusiness = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'StudyAlready',
      url: 'https://www.studyalready.com',
      image: 'https://www.studyalready.com/assets/img/og/home.svg',
      email: 'contact@studyalready.com',
      telephone: '+32465339448',
      areaServed: ['BE', 'CM', 'SN', 'CI', 'BJ'],
      priceRange: '€€',
      sameAs: [
        'https://www.facebook.com/profile.php?id=61589453766633',
        'https://www.instagram.com/studyalready/'
      ]
    };
    return html.replace('</head>', `${structuredScript(localBusiness)}${structuredScript(faq)}\n</head>`);
  }

  if (route === '/equivalence') {
    const faq = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Qui décide de l’équivalence FWB ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'La décision revient exclusivement au service compétent de la Fédération Wallonie-Bruxelles. StudyAlready aide à préparer et suivre le dossier.'
          }
        },
        {
          '@type': 'Question',
          name: 'StudyAlready garantit-il une équivalence ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Non. L’accompagnement vise à améliorer la clarté et la complétude du dossier, sans garantir la décision finale.'
          }
        },
        {
          '@type': 'Question',
          name: 'Le suivi inclut-il les originaux ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Oui, le suivi met l’accent sur la récupération sécurisée des originaux et de la décision lorsque cela fait partie du mandat convenu.'
          }
        }
      ]
    };
    return html.replace('</head>', `${structuredScript(faq)}\n</head>`);
  }

  if (route === '/tarifs-packs') {
    const offerCatalog = {
      '@context': 'https://schema.org',
      '@type': 'OfferCatalog',
      name: 'Tarifs et packs StudyAlready',
      url: 'https://www.studyalready.com/tarifs-packs',
      itemListElement: [
        { '@type': 'Offer', name: 'Pack équivalence', price: '100', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', name: 'Pack équivalence + aide admission', price: '200', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', name: 'Pack admission seul', price: '100', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', name: 'Pack entretien + préparation', price: '100', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', name: 'Pack préparation visa', price: '100', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' }
      ]
    };
    return html.replace('</head>', `${structuredScript(offerCatalog)}\n</head>`);
  }

  return html;
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
  return addImageDefaults(
    versionCriticalAssets(
      addPreloads(
        injectStructuredData(
          exposeBlogArticleContent(
            replaceSocialImage(
              cleanSiteUrl(normalizeInternalLinks(html, sourcePath)),
              sourcePath
            ),
            sourcePath
          ),
          sourcePath
        )
      )
    )
  );
}
