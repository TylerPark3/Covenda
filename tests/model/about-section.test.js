import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const about = html.slice(html.indexOf('id="about"'), html.indexOf('class="final-cta"'));

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
  // The founders are named. "We have both worked at startups" was a story about nobody; the
  // section is About Us, so the us has to be in it.
  assert.match(about, /Tyler and Dylan/);
  assert.match(about, /\b19\b/, 'their age is what makes the story land');
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
  // The volunteered "we have not placed anyone yet" line was removed on request. The rule that
  // remains is the stronger one: nothing here may CLAIM traction that does not exist. Declining
  // to state a limitation is not the same as asserting a falsehood, and the list above catches
  // the second. The equivalent disclosure still appears where placements could be inferred,
  // which is the recruiter band, and there is a separate test for it.
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

// The numbering is gone. It asserted a sequence the content does not have: the third line is
// The premise/conclusion block was cut: with the founder story now doing that work in the left
// column, keeping it meant saying the same thing twice in two different type treatments. What
// remains in the aside is the manifesto, and its structure is the thing worth guarding.
test('the manifesto is paired opposites, in one typeface', () => {
  const pairs = about.match(/<dt>/g) || [];
  assert.equal(pairs.length, 3, 'the manifesto is three oppositions');
  assert.equal((about.match(/<dd>/g) || []).length, 3, 'every position needs its answer');
  assert.ok(!/class="about-premise"/.test(about), 'the premise block is back alongside the story');

  // One serif in this section, and it is the thesis. Five font switches in a single column is
  // what read as busy: the close was in the display face purely for emphasis.
  const close = css.match(/\.manifesto-close\s*\{[^}]*\}/)[0];
  assert.match(close, /font-family: var\(--font-sans\)/, 'the manifesto close is a second serif again');
  // One serif in this section and it is the heading. type.css is explicit that the display
  // face is for display sizes only and the sans carries h3 downward; four font switches in two
  // columns was the section disagreeing with its own type system.
  for (const cls of ['about-thesis', 'about-motto', 'manifesto-close']) {
    const rule = css.match(new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`))[0];
    assert.match(rule, /font-family: var\(--font-sans\)/, `.${cls} reintroduces a second typeface`);
  }
  const heading = css.match(/\.about-lede h2\s*\{[^}]*\}/);
  assert.ok(!heading || !/font-family: var\(--font-sans\)/.test(heading[0]),
    'the heading lost the one serif the section is meant to have');
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
  // The caveat line was removed on request, so there is no longer a .stat-note here to check.
  // The guard that outlives it is the one below: if a caveat ever returns to this section it
  // must be the shared component rather than a second style that drifts from it.
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
  const size = selectors(/^(\.section-heading h2,[^{]*)\{[^}]*font-size: var\(--text-heading\)/m);
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
