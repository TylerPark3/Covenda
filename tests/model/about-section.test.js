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
