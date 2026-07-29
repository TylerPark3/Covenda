import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const about = html.slice(html.indexOf('class="about-section"'), html.indexOf('class="final-cta"'));

// The nav said "About" and scrolled to a product explainer. A link that does not go where it
// says is the cheapest kind of broken.
test('the About nav link lands on the About section', () => {
  assert.match(html, /data-nav-target="about"/);
  assert.match(html, /id="about"/);
  assert.ok(!/data-nav-target="whyCovenda"/.test(html), 'the nav still points at the old target');
});

test('it says who built it and who it is for', () => {
  assert.match(about, /built by/i);
  assert.match(about, /students/i);
  assert.match(about, /domain expertise/i);
  assert.match(about, /17, 18 and 19/);
});

// The standing rule across this site: no traction we do not have.
test('the About section claims nothing Covenda has not done', () => {
  const forbidden = [
    /\d+\s*(students?|companies|startups)\s+(placed|hired|matched)/i,
    /trusted by/i,
    /our (partners|clients)/i,
    /success rate/i,
    /placement rate/i,
    /backed by/i,
  ];
  for (const pattern of forbidden) {
    assert.ok(!pattern.test(about), `About section makes an unfounded claim: ${pattern}`);
  }
  // And it states the limitation rather than leaving it to be inferred.
  assert.match(about, /has not placed a student yet/i);
});

test('the Instagram link is real, external, and safe to open', () => {
  const link = about.match(/<a class="about-social"[^>]*>/)[0];
  assert.match(link, /href="https:\/\/www\.instagram\.com\/covenda\.app\/"/);
  assert.match(link, /target="_blank"/);
  // Without noopener the opened tab can reach back through window.opener.
  assert.match(link, /rel="noopener noreferrer"/);
  assert.match(about, /@covenda\.app/);
});

// Repeated feedback, applied here: no em dashes anywhere in the copy.
test('the copy carries no em dashes', () => {
  const text = about.replace(/<[^>]+>/g, ' ');
  assert.ok(!text.includes('—'), 'an em dash slipped into the About copy');
});

test('every style the markup asks for exists', () => {
  const classes = [...about.matchAll(/class="([^"]+)"/g)]
    .flatMap(m => m[1].split(/\s+/))
    .filter(c => c.startsWith('about-'));
  for (const name of new Set(classes)) {
    assert.ok(css.includes(`.${name}`), `.${name} is used in markup but never styled`);
  }
});

// CSS counters skip display:none, and a numbered list whose numbers come from a counter is
// only correct while every item renders.
test('the numbered points are a real sequence, not decoration', () => {
  const items = about.match(/<li>/g) || [];
  assert.equal(items.length, 3, 'the counter styling assumes exactly three points');
  assert.match(css, /\.about-points\s*\{[^}]*counter-reset/);
});

// The point of these: "consistent" has to be checkable, or it drifts the moment someone edits
// one section without looking at the others.

test('the section sits on the same ground as its neighbours', () => {
  const rule = css.match(/\.about-section\s*\{[^}]*\}/)[0];
  // gold-pale is used site-wide for badges, banners and cards, never for a section
  // background. One tinted full-width band between two white sections reads as another site.
  assert.ok(!/background:\s*var\(--gold-pale\)/.test(rule), 'the About band is tinted where every neighbouring section is white');
  assert.match(rule, /background:\s*#fff/);
  assert.match(rule, /border-top:\s*1px solid var\(--line\)/);
});

// Copying a heading's numbers means it drifts the first time the shared rule changes.
test('the heading reuses the shared rule rather than restating it', () => {
  assert.match(css, /\.section-heading h2,[^{]*\.about-lede h2[^{]*\{/);
  const own = css.match(/\.about-lede h2\s*\{[^}]*\}/)[0];
  for (const property of ['font-size', 'font-weight', 'letter-spacing', 'line-height']) {
    assert.ok(!own.includes(property), `.about-lede h2 restates ${property} instead of inheriting it`);
  }
});

test('shared components are used by name, not reimplemented', () => {
  assert.match(about, /class="feature-kicker"/, 'the eyebrow should be the site eyebrow');
  assert.match(about, /class="stat-note"/, 'the caveat line should be the site caveat component');
  assert.ok(!/class="about-kicker"/.test(about) && !/\.about-kicker/.test(css), 'a duplicate eyebrow style survives');
  assert.ok(!/class="about-note"/.test(about) && !/\.about-note/.test(css), 'a duplicate caveat style survives');
});

test('the card matches the card treatment already on the page', () => {
  const side = css.match(/\.about-side\s*\{[^}]*\}/)[0];
  const reference = css.match(/\.referrer-cred-card\s*\{[^}]*\}/)[0];
  for (const token of ['var(--gold-light)', 'var(--gold-pale)']) {
    assert.ok(side.includes(token) && reference.includes(token), `.about-side and .referrer-cred-card disagree on ${token}`);
  }
});

// Square corners are a deliberate, site-wide choice; a rounded card would be conspicuous.
test('nothing in the section rounds its corners', () => {
  for (const rule of css.slice(css.indexOf('/* ── About us ─')).match(/\{[^}]*\}/g) || []) {
    const radius = rule.match(/border-radius:\s*([^;]+)/);
    if (radius) assert.equal(radius[1].trim(), '0', `a rounded corner appears where the site uses square: ${radius[1]}`);
  }
});

test('the two columns collapse on small screens', () => {
  assert.match(css, /@media \(max-width: 900px\) \{\s*\.about-inner \{ grid-template-columns: 1fr; \}/);
});

// The section-header treatment lives in TWO rules: one sets the display size, the other sets
// the display FACE. Adding a heading to the first and not the second leaves it in the body
// sans at weight 720 while every neighbouring header sits in the display face at 400, which
// is a different family and a different weight from one omitted selector.
test('a marketing section heading gets both halves of the shared treatment', () => {
  const selectors = rule => (css.match(rule)[1]).split(',').map(s => s.trim()).filter(Boolean);
  const size = selectors(/^(\.section-heading h2,[^{]*)\{[^}]*font-size: clamp\(38px/m);
  const face = selectors(/^(\.section-heading h2,[^{]*)\{\s*font-family: var\(--font-display\)/m);

  // The workspace headings are deliberately excluded from the face rule: they are dashboard
  // chrome rather than marketing section headers.
  const chrome = ['.workspace-title h1', '.simple-workspace-view h1'];
  const missing = size.filter(s => !face.includes(s) && !chrome.includes(s));
  assert.deepEqual(missing, [], 'these headings take the display size but not the display face');

  for (const heading of ['.about-lede h2', '.recruiter-lede h2']) {
    assert.ok(size.includes(heading), `${heading} is missing the shared size`);
    assert.ok(face.includes(heading), `${heading} is missing the shared face`);
  }
});
