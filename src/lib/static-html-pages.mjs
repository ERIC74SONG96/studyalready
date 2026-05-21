import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const ASSET_VERSION = '20260515fallback';
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

function ensureCanonicalLink(html, sourcePath) {
  const route = routeFromSourcePath(sourcePath);
  const canonical = `https://www.studyalready.com${route === '/' ? '' : route}`;

  if (/<link\b[^>]*rel=["']canonical["']/i.test(html)) {
    return html
      .replace(
        /(<link\b[^>]*rel=["']canonical["'][^>]*href=["'])([^"']+)(["'][^>]*>)/i,
        `$1${canonical}$3`
      )
      .replace(
        /(<link\b[^>]*href=["'])([^"']+)(["'][^>]*rel=["']canonical["'][^>]*>)/i,
        `$1${canonical}$3`
      );
  }

  return html.replace('</head>', `  <link rel="canonical" href="${canonical}" />\n</head>`);
}

function ensureRobotsMeta(html) {
  if (/<meta\b[^>]*name=["']robots["']/i.test(html)) return html;
  return html.replace(
    '</head>',
    '  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />\n</head>'
  );
}

function ensureSeoBaseline(html, sourcePath) {
  return ensureRobotsMeta(ensureCanonicalLink(html, sourcePath));
}

function ogSlugFromSourcePath(sourcePath) {
  const route = routeFromSourcePath(sourcePath);
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '--');
}

function replaceSocialImage(html, sourcePath) {
  const slug = ogSlugFromSourcePath(sourcePath);
  const url =
    slug === 'home'
      ? 'https://www.studyalready.com/assets/img/og-cover.png'
      : `https://www.studyalready.com/assets/img/og/${slug}.png`;
  return html
    .replace(/(<meta\s+property=["']og:image["']\s+content=["'])([^"']+)(["'][^>]*>)/i, `$1${url}$3`)
    .replace(/(<meta\s+name=["']twitter:image["']\s+content=["'])([^"']+)(["'][^>]*>)/i, `$1${url}$3`)
    .replace(/https:\/\/www\.studyalready\.com\/assets\/img\/og-cover\.svg/g, 'https://www.studyalready.com/assets/img/og-cover.png')
    .replace(/https:\/\/www\.studyalready\.com\/assets\/img\/og\/[^"']+\.svg/g, url)
    .replace(/https:\/\/www\.studyalready\.com\/assets\/img\/blog\/[^"']+\.svg/g, url);
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
      if (classes.length === 0) classes.push('block');
      return start + classes.join(' ') + end;
    });
}

function structuredScript(data) {
  return `\n  <script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n  </script>`;
}

function staticHeaderHtml() {
  return `<header id="site-header" class="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
      <a href="/" class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-lg bg-brand-dark flex items-center justify-center"><span class="text-brand-gold font-bold text-sm font-display">SA</span></div>
        <span class="font-display font-bold text-lg text-brand-dark">Study<span class="text-brand-gold">Already</span></span>
      </a>
      <ul class="hidden lg:flex items-center gap-6 text-sm font-medium">
        <li><a href="/" class="hover:text-brand-gold transition">Accueil</a></li>
        <li><a href="/qui-sommes-nous" class="hover:text-brand-gold transition">Qui sommes-nous ?</a></li>
        <li><a href="/equivalence" class="hover:text-brand-gold transition">Équivalence</a></li>
        <li class="relative group">
          <button type="button" aria-haspopup="true" class="hover:text-brand-gold transition inline-flex items-center gap-1">Services</button>
          <div class="hidden group-hover:block group-focus-within:block absolute top-full left-0 pt-3 z-50">
            <div class="w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2">
              <a href="/tarifs-packs" class="block px-4 py-2 hover:bg-brand-cream text-brand-dark font-semibold">Tarifs &amp; packs</a>
              <a href="/analyseur-admission" class="block px-4 py-2 hover:bg-amber-50 text-amber-800 font-semibold">Analyseur d'admission</a>
              <a href="/notre-dossier-fwb" class="block px-4 py-2 hover:bg-slate-50">Notre dossier FWB</a>
              <a href="/inscription-universitaire" class="block px-4 py-2 hover:bg-slate-50">Aide admission universitaire</a>
              <a href="/compte-bloque" class="block px-4 py-2 hover:bg-slate-50">Compte bloqué</a>
              <a href="/assurance-visa" class="block px-4 py-2 hover:bg-slate-50">Assurance visa &amp; santé</a>
              <a href="/logement-etudiant" class="block px-4 py-2 hover:bg-slate-50">Logement étudiant</a>
              <a href="/pack-accueil" class="block px-4 py-2 hover:bg-slate-50">Pack accueil</a>
              <a href="/preparer-voyage" class="block px-4 py-2 hover:bg-slate-50">Préparer mon voyage</a>
              <a href="/services-bancaires" class="block px-4 py-2 hover:bg-slate-50">Assistance bancaire</a>
              <a href="/accelerateur-job" class="block px-4 py-2 hover:bg-slate-50">Accélérateur de Job</a>
              <a href="/offres-etudiants" class="block px-4 py-2 hover:bg-emerald-50 text-emerald-900 font-semibold">Mur des offres job</a>
              <a href="/prequalification-dossier" class="block px-4 py-2 hover:bg-slate-50 text-brand-dark font-semibold border-t border-slate-100 mt-1">Pré-qualification détaillée</a>
            </div>
          </div>
        </li>
        <li class="relative group">
          <button type="button" aria-haspopup="true" class="hover:text-brand-gold transition inline-flex items-center gap-1">Communauté</button>
          <div class="hidden group-hover:block group-focus-within:block absolute top-full left-0 pt-3 z-50">
            <div class="w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2">
              <a href="/communaute" class="block px-4 py-2 hover:bg-slate-50">Vision &amp; deux parcours</a>
              <a href="/annuaire" class="block px-4 py-2 hover:bg-slate-50">Annuaire des membres</a>
              <a href="/besoin-d-aide" class="block px-4 py-2 hover:bg-amber-50 text-amber-800 font-semibold">Besoin d'aide ?</a>
              <a href="/evenements-seminaires" class="block px-4 py-2 hover:bg-slate-50">Événements &amp; séminaires</a>
              <a href="/offres-etudiants" class="block px-4 py-2 hover:bg-slate-50">Offres job étudiant</a>
              <a href="/rejoindre-reseau" class="block px-4 py-2 hover:bg-slate-50 text-brand-dark font-semibold border-t border-slate-100 mt-1">Rejoindre le réseau</a>
              <a href="/devenir-professionnel" class="block px-4 py-2 hover:bg-amber-50 text-amber-900 font-semibold">Professionnels &amp; mentors</a>
              <a href="/creer-profil" class="block px-4 py-2 hover:bg-slate-50">Créer mon profil public</a>
            </div>
          </div>
        </li>
        <li><a href="/offres-etudiants" class="hover:text-brand-gold transition">Jobs étudiants</a></li>
        <li><a href="/blog" class="hover:text-brand-gold transition">Blog</a></li>
        <li class="sa-espace-nav-link"><a href="/espace-etudiant/" class="hover:text-brand-gold transition">Mon espace</a></li>
        <li class="hidden" data-sa-profile-slot data-sa-dashboard-href="/espace-etudiant/dashboard"></li>
      </ul>
      <a href="/#contact" class="hidden sm:inline-flex items-center gap-2 bg-brand-gold hover:bg-yellow-500 text-brand-dark font-semibold px-5 py-2.5 rounded-full text-sm transition shadow-sm">Contact</a>
      <button id="mobileMenuBtn" class="lg:hidden text-brand-dark" aria-label="Menu principal" aria-controls="mobileMenu" aria-expanded="false">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </nav>
    <div id="mobileMenu" class="hidden lg:hidden bg-white border-t border-slate-200 px-4 py-3 text-sm font-medium max-h-[80vh] overflow-y-auto">
      <a href="/" class="block py-2">Accueil</a>
      <a href="/qui-sommes-nous" class="block py-2">Qui sommes-nous ?</a>
      <a href="/equivalence" class="block py-2">Équivalence (guide)</a>
      <a href="/tarifs-packs" class="block py-2 border-t border-slate-100 font-semibold">Tarifs &amp; packs</a>
      <a href="/analyseur-admission" class="block py-2">Analyseur d'admission</a>
      <a href="/communaute" class="block py-2 border-t border-slate-100">Communauté</a>
      <a href="/annuaire" class="block py-2">Annuaire</a>
      <a href="/offres-etudiants" class="block py-2">Jobs étudiants</a>
      <a href="/blog" class="block py-2">Blog</a>
      <a href="/espace-etudiant/" class="sa-espace-nav-link block py-2 border-t border-slate-100">Espace personnel</a>
      <div class="hidden" data-sa-profile-slot data-sa-profile-variant="mobile" data-sa-dashboard-href="/espace-etudiant/dashboard"></div>
      <a href="/#contact" class="block py-3 border-t border-slate-100 text-brand-gold font-semibold">Contact →</a>
    </div>
  </header>`;
}

function injectStaticHeader(html) {
  return html.replace(/<header\s+id=["']site-header["'][^>]*>\s*<\/header>/i, staticHeaderHtml());
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
      image: 'https://www.studyalready.com/assets/img/og/home.png',
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
        { '@type': 'Offer', name: 'Aide pour candidater à une admission universitaire', price: '100', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
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

function canonicalForRoute(route) {
  return route === '/' ? 'https://www.studyalready.com/' : `https://www.studyalready.com${route}`;
}

function shouldNoindexRoute(route) {
  if (
    route === '/404' ||
    route === '/admin' ||
    route === '/admin-login' ||
    route === '/dashboard' ||
    route === '/espace-etudiant' ||
    route === '/espace-etudiant/dashboard' ||
    route === '/jobs-etudiants'
  ) {
    return true;
  }
  return false;
}

function upsertSeoMeta(html, sourcePath) {
  const route = routeFromSourcePath(sourcePath);
  const canonical = canonicalForRoute(route);
  const robots = shouldNoindexRoute(route) ? 'noindex,nofollow' : 'index,follow';

  let next = html;
  if (/<link\s+rel=["']canonical["']/i.test(next)) {
    next = next.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  } else {
    next = next.replace('</head>', `  <link rel="canonical" href="${canonical}" />\n</head>`);
  }

  if (/<meta\s+name=["']robots["']/i.test(next)) {
    next = next.replace(/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}" />`);
  } else {
    next = next.replace('</head>', `  <meta name="robots" content="${robots}" />\n</head>`);
  }

  if (/<meta\s+property=["']og:url["']/i.test(next)) {
    next = next.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}" />`);
  }

  next = next.replace(/("mainEntityOfPage"\s*:\s*")[^"]+(")/g, `$1${canonical}$2`);
  return next;
}

function normalizeInternalLinks(html, sourcePath) {
  return html.replace(/\b(href|action|content)=(["'])(.*?)\2/g, (match, attr, quote, value) => {
    if ((attr === 'href' || attr === 'action') && value.startsWith('#')) {
      const route = routeFromSourcePath(sourcePath);
      const prefix = route === '/' ? '' : route;
      return `${attr}=${quote}${prefix}${value}${quote}`;
    }
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
        upsertSeoMeta(
          injectStructuredData(
            exposeBlogArticleContent(
              injectStaticHeader(
                replaceSocialImage(
                  cleanSiteUrl(normalizeInternalLinks(html, sourcePath)),
                  sourcePath
                )
              ),
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
