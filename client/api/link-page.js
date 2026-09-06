/**
 * Server-rendered link pages: /frankydrama, /links, and any other row added to
 * link_pages. Which one to render arrives as ?slug=, set by the rewrite in
 * vercel.json.
 *
 * The rest of the site is a client-rendered SPA behind a single static
 * index.html, which is fine for pages nobody needs to find on Google. This one
 * These are the opposite: their job is to rank for a name and to produce a
 * correct share card when the link is pasted into Instagram, WhatsApp or X.
 * Those scrapers do not run JavaScript, so a React route would hand them an
 * empty document carrying the site's generic title. Hence a real HTML response.
 *
 * Content comes from the admin (GET /api/link-page/:slug) on every cache
 * revalidation, so editing a button never needs a deploy. Nothing on these
 * pages is hardcoded except the error fallback at the bottom.
 *
 * Caching is what makes that affordable. The API lives on Render's free tier,
 * so responses are cached at Vercel's edge with a short s-maxage and a long
 * stale-while-revalidate: visitors always get HTML instantly from the CDN, the
 * origin is hit at most once a minute in the background, and if the API is
 * briefly unreachable the last good copy keeps being served for up to a day.
 */

const API_BASE = (
  process.env.VITE_API_URL || process.env.API_URL || 'https://criminalcrisis.onrender.com'
).replace(/\/+$/, '');
// The apex domain 308-redirects to www, so www is the host that actually answers
// 200 and therefore the only correct canonical. Pointing canonical, og:url and
// the JSON-LD url at a redirecting host is a self-inflicted handicap on the one
// page whose entire purpose is ranking.
const SITE_URL = (process.env.SITE_URL || 'https://www.criminalcrisis.com').replace(/\/+$/, '');

/**
 * Which page to render arrives as ?slug=, set by the rewrite in vercel.json —
 * never by the visitor typing one. It still gets validated, because the value
 * ends up inside the canonical and og:url of the response.
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;

/** Vercel's Hobby functions cap out around 10s, so fail before the platform does. */
const API_TIMEOUT_MS = 9000;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) and mailto reach an href. The API validates too; this is the last gate. */
function safeUrl(url) {
  return /^(https?:\/\/|mailto:)/i.test(String(url || '')) ? String(url) : null;
}

/** Our own host, apex and www treated as one site. */
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

/** True for an http(s) URL that points somewhere other than this site. */
function isExternalProfile(url) {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    return new URL(url).hostname.replace(/^www\./, '') !== SITE_HOST;
  } catch {
    return false;
  }
}

const STYLES = `
@font-face {
  font-family: 'ABCCamera';
  src: url('/fonts/ABCCameraPlain-Bold-Trial.otf') format('opentype');
  font-weight: 400 900;
  font-style: normal;
  font-display: swap;
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  min-height: 100vh;
  background: #FAFAFA;
  color: #111111;
  font-family: 'ABCCamera', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  letter-spacing: -0.04em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
a { color: inherit; text-decoration: none; }

.wrap {
  width: 100%;
  max-width: 30rem;
  margin: 0 auto;
  padding: 3.5rem 1.25rem 3rem;
}
@media (min-width: 40em) { .wrap { padding-top: 5rem; } }

.identity { text-align: center; margin-bottom: 2.5rem; }
.identity h1 {
  margin: 0;
  font-size: 2.75rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}
@media (min-width: 40em) { .identity h1 { font-size: 3.5rem; } }
/* aspect-ratio rather than width/height attributes: the portrait is editable
   from the admin, so the slot has to reserve its space without knowing the
   dimensions of whatever gets uploaded next. cover crops a stray portrait-
   orientation upload instead of blowing the layout apart. */
.portrait {
  display: block;
  width: 100%;
  margin: 1.75rem 0 0;
  aspect-ratio: 1.91 / 1;
  object-fit: cover;
  background: #F0F0F0;
}

.tagline {
  margin: 1rem 0 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #555555;
}
.city {
  margin: 0.75rem 0 0;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #C0BABC;
}

.links { display: flex; flex-direction: column; gap: 0.625rem; }

/* min-height keeps every row a comfortable thumb target on a phone. */
.btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: 3.5rem;
  padding: 0.9rem 1.25rem;
  border: 1px solid #111111;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-align: center;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.btn:hover, .btn:focus-visible { background: #111111; color: #FAFAFA; }

/* The first link is whatever the admin put first — normally the new record. */
.btn--lead { background: #111111; color: #FAFAFA; }
.btn--lead:hover, .btn--lead:focus-visible { background: #C8302B; border-color: #C8302B; color: #FAFAFA; }

.btn__note {
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.3em;
  opacity: 0.6;
}

.foot {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid #E8E8E8;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: center;
}
.foot a {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #888888;
  transition: color 0.15s ease;
}
.foot a:hover, .foot a:focus-visible { color: #C8302B; }

:focus-visible { outline: 2px solid #C8302B; outline-offset: 3px; }
`.trim();

/** mailto opens in the mail client; every external profile opens in a new tab. */
function linkAttrs(url) {
  return url.toLowerCase().startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"';
}

function renderPage(page, canonical) {
  const CANONICAL = canonical;
  const name = page.display_name || page.slug || '';
  const title = page.seo_title || name;
  const description = page.seo_description || '';
  const image = page.og_image_url || '';
  const photo = page.photo_url || '';
  // Naming both aliases gives Google Images something to match either query
  // against, which is the whole point of the page.
  const portraitAlt = page.alternate_name ? name + ' (' + page.alternate_name + ')' : name;

  const buttons = (page.buttons || [])
    .map(b => ({ ...b, url: safeUrl(b.url) }))
    .filter(b => b.url);
  const footer = (page.footer_links || [])
    .map(b => ({ ...b, url: safeUrl(b.url) }))
    .filter(b => b.url);

  // sameAs is derived rather than a field of its own: every profile the page
  // already links to is a profile Google should associate with the entity, and
  // one less list to maintain is one less way for it to go stale.
  //
  // Links back into this site are excluded. sameAs means "the same entity,
  // elsewhere" — our own pages are not elsewhere, and the label's page links to
  // several of them, which would otherwise fill its sameAs with internal URLs
  // and tell a search engine nothing.
  const sameAs = [...new Set(
    [...buttons, ...footer].map(b => b.url).filter(isExternalProfile)
  )];

  // An artist page describes an artist; the label's page describes the label.
  const schemaType = page.schema_type === 'Organization' ? 'Organization' : 'MusicGroup';

  // For the label, the entity's canonical URL is the home page — which already
  // carries its own Organization block. Pointing both at the same url makes the
  // two describe one entity that search engines can consolidate, instead of two
  // rival organisations that happen to share a name.
  const entityUrl = schemaType === 'Organization' ? SITE_URL : CANONICAL;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name,
    ...(page.alternate_name ? { alternateName: page.alternate_name } : {}),
    ...(description ? { description } : {}),
    url: entityUrl,
    ...(image ? { image } : {}),
    ...(page.city ? { foundingLocation: { '@type': 'Place', name: page.city } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };

  const buttonsHtml = buttons.map((b, i) => [
    '      <a class="btn' + (i === 0 ? ' btn--lead' : '') + '" href="' + esc(b.url) + '"' + linkAttrs(b.url) + '>',
    b.note ? '        <span class="btn__note">' + esc(b.note) + '</span>' : null,
    '        <span class="btn__label">' + esc(b.label) + '</span>',
    '      </a>',
  ].filter(Boolean).join('\n')).join('\n');

  const footerHtml = footer
    .map(b => '      <a href="' + esc(b.url) + '"' + linkAttrs(b.url) + '>' + esc(b.label) + '</a>')
    .join('\n');

  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + esc(title) + '</title>',
    '<meta name="description" content="' + esc(description) + '">',
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">',
    '<link rel="canonical" href="' + esc(CANONICAL) + '">',
    '<link rel="icon" type="image/png" href="/img/logos/logotipo5_criminalCrisis@2x.png">',
    '<meta property="og:type" content="profile">',
    '<meta property="og:site_name" content="Criminal Crisis">',
    '<meta property="og:url" content="' + esc(CANONICAL) + '">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(description) + '">',
    image ? '<meta property="og:image" content="' + esc(image) + '">' : null,
    image ? '<meta property="og:image:alt" content="' + esc(name) + '">' : null,
    '<meta name="twitter:card" content="' + (image ? 'summary_large_image' : 'summary') + '">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(description) + '">',
    image ? '<meta name="twitter:image" content="' + esc(image) + '">' : null,
    '<style>' + STYLES + '</style>',
    // Escaping "<" keeps a stray tag in admin-entered text from closing the script.
    '<script type="application/ld+json">' + JSON.stringify(jsonLd).replace(/</g, '\\u003c') + '</script>',
  ].filter(Boolean).join('\n');

  const body = [
    '  <main class="wrap">',
    '    <header class="identity">',
    '      <h1>' + esc(name) + '</h1>',
    // Eager, not lazy: this is the largest thing above the fold, so deferring it
    // would only push out LCP on the phone screen this page is built for.
    photo
      ? '      <img class="portrait" src="' + esc(photo) + '" alt="' + esc(portraitAlt) + '" decoding="async" fetchpriority="high">'
      : null,
    page.tagline ? '      <p class="tagline">' + esc(page.tagline) + '</p>' : null,
    page.city ? '      <p class="city">' + esc(page.city) + '</p>' : null,
    '    </header>',
    '',
    '    <nav class="links" aria-label="Listen to ' + esc(name) + '">',
    buttonsHtml,
    '    </nav>',
    footer.length ? '' : null,
    footer.length ? '    <footer class="foot">' : null,
    footer.length ? footerHtml : null,
    footer.length ? '    </footer>' : null,
    '  </main>',
  ].filter(v => v !== null).join('\n');

  return '<!doctype html>\n<html lang="en">\n<head>\n' + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
}

/**
 * Served only when the API is unreachable and the CDN has nothing cached.
 * Deliberately empty of content: a hardcoded copy of the real page would drift
 * from the admin, and a 503 tells a crawler to come back later rather than
 * letting it index a stub.
 */
function renderUnavailable() {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Criminal Crisis</title>',
    '<meta name="robots" content="noindex">',
    '<style>' + STYLES + '</style>',
    '</head>',
    '<body>',
    '  <main class="wrap">',
    '    <header class="identity">',
    '      <h1>Criminal Crisis</h1>',
    '      <p class="tagline">This page is temporarily unavailable. Please try again in a moment.</p>',
    '    </header>',
    '    <nav class="links">',
    '      <a class="btn" href="' + esc(SITE_URL) + '">criminalcrisis.com</a>',
    '    </nav>',
    '  </main>',
    '</body>',
    '</html>',
  ].join('\n');
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug ?? '');
  if (!SLUG_PATTERN.test(slug)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).send(renderUnavailable());
    return;
  }

  const canonical = SITE_URL + '/' + slug;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(API_BASE + '/api/link-page/' + slug, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('API responded ' + response.status);
    const page = await response.json();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400');
    res.status(200).send(renderPage(page, canonical));
  } catch (err) {
    console.error('[link-page] could not render ' + slug + ' from the API:', err.message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).send(renderUnavailable());
  } finally {
    clearTimeout(timer);
  }
}

// Exported for the local render check in scripts and tests.
export { renderPage };
