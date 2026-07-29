import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

// A PNG stores its dimensions in the IHDR chunk at a fixed offset: width at byte 16, height at
// byte 20, both big-endian. Reading them directly keeps this test free of an image library,
// which matters because the one used to GENERATE these files is only present transitively.
function pngSize(path) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(1, 4).toString(), 'PNG', `${path} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const root = new URL('../../', import.meta.url).pathname;
const read = f => readFileSync(root + f, 'utf8');
const index = read('index.html');

// Google shows a generic globe when it cannot resolve a crawlable site icon. An SVG alone is
// supported but least reliably picked up, so a raster is offered first.
test('a raster favicon exists at every size Google and Android read', () => {
  for (const size of [48, 96, 192, 512]) {
    const file = `favicon-${size}.png`;
    assert.ok(existsSync(root + file), `${file} is referenced or expected but missing`);
    assert.ok(statSync(root + file).size > 500, `${file} is suspiciously small`);
  }
  assert.ok(existsSync(root + 'apple-touch-icon.png'));
  assert.ok(existsSync(root + 'favicon.svg'), 'the vector should stay for crisp rendering');
});

test('the public page links the raster icons before the vector', () => {
  const icons = [...index.matchAll(/<link rel="icon"[^>]*>/g)].map(m => m[0]);
  assert.ok(icons.length >= 3, 'only one icon size is offered');
  assert.ok(/favicon-48\.png/.test(icons[0]), 'the SVG is listed first and will be preferred');
  assert.match(index, /rel="apple-touch-icon"/);
  // Absolute from the root: a relative href resolves differently on a sub-path and Google
  // needs one stable URL.
  for (const icon of icons) assert.match(icon, /href="\//, `${icon} is not root-absolute`);
});

test('every icon Google is pointed at is square and the size it claims', () => {
  for (const size of [48, 96, 192, 512]) {
    const meta = pngSize(root + `favicon-${size}.png`);
    assert.equal(meta.width, size, `favicon-${size}.png is ${meta.width}px wide`);
    assert.equal(meta.height, size, 'the icon must be square or Google will not use it');
  }
});

// A link with no card is a link nobody clicks.
test('the public page carries a full share card', () => {
  for (const tag of ['og:type', 'og:url', 'og:title', 'og:description', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:image']) {
    assert.ok(index.includes(tag), `${tag} is missing`);
  }
  assert.match(index, /content="summary_large_image"/);
  assert.match(index, /<link rel="canonical" href="https:\/\/covenda\.app\/">/);
});

test('the share image is the size every platform actually reads', () => {
  const meta = pngSize(root + 'assets/covenda-og.png');
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.match(index, /og:image:width" content="1200"/);
  assert.match(index, /og:image:height" content="630"/);
});

// Absolute URLs: a relative og:image is silently dropped by most crawlers.
test('social image URLs are absolute', () => {
  for (const [, url] of index.matchAll(/(?:og:image|twitter:image)" content="([^"]+)"/g)) {
    assert.match(url, /^https:\/\/covenda\.app\//, `${url} must be absolute`);
  }
});

test('robots.txt allows the homepage and the icons, and names the sitemap', () => {
  const robots = read('robots.txt');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.ok(!/Disallow: \/$/m.test(robots), 'the whole site is disallowed');
  assert.ok(!/Disallow:.*favicon/i.test(robots), 'blocking the icon is what produces a globe');
  assert.match(robots, /Sitemap: https:\/\/covenda\.app\/sitemap\.xml/);
});

test('the sitemap is valid and points at the canonical host', () => {
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/, 'a wrong namespace makes the sitemap invalid');
  assert.match(sitemap, /<loc>https:\/\/covenda\.app\/<\/loc>/);
});

// The private surfaces get the icon but must never be indexed or previewed.
test('the portal and admin are excluded from search, exactly once', () => {
  for (const file of ['portal.html', 'admin.html']) {
    const page = read(file);
    const robots = page.match(/<meta name="robots"[^>]*>/g) || [];
    assert.equal(robots.length, 1, `${file} has ${robots.length} robots tags`);
    assert.match(robots[0], /noindex/);
    assert.ok(!page.includes('og:image'), `${file} should not advertise a share card`);
    assert.match(page, /favicon-192\.png/, `${file} should still carry the icon`);
  }
  assert.ok(!/name="robots"/.test(index), 'the public page must not be noindexed');
});
