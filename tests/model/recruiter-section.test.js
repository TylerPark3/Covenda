import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { batchesByVertical, BATCH_CATALOG } from '../../api/batches.js';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const band = html.slice(html.indexOf('class="recruiter-band'), html.indexOf('id="companyProductDemo"'));

test('it is shown to the company audience only', () => {
  assert.match(band, /data-for-audience="company"/);
  assert.match(band, /class="recruiter-band audience-content"/);
});

// The whole reason the section exists: a technical recruiter is asked in the job description
// itself to assess technical fit, which is the one thing a resume cannot answer.
test('it names the recruiter\'s actual problem, not the founder\'s', () => {
  assert.match(band, /assess technical fit/i);
  assert.match(band, /hiring manager/i);
  assert.ok(!/backlog|keeps getting pushed back/i.test(band), 'this is the founder framing, not the recruiter one');
});

// The claim that a pipeline is scoped by specialisation has to be true of the catalogue.
test('the specialisation count it claims matches the catalogue', () => {
  const verticals = batchesByVertical().length;
  assert.match(band, new RegExp(`twenty-five specialisations across ${verticals === 5 ? 'five' : verticals} verticals`, 'i'));
  assert.equal(BATCH_CATALOG.length, 25, 'the copy says twenty-five and the catalogue disagrees');
});

// The domains it lists as recruiter specialisms must be ones Covenda actually runs.
test('every domain it names is a vertical Covenda covers', () => {
  for (const domain of ['software', 'AI and ML', 'security', 'hardware', 'data', 'healthcare']) {
    assert.ok(band.toLowerCase().includes(domain.toLowerCase()), `${domain} is missing from the specialism list`);
  }
  const covered = JSON.stringify(BATCH_CATALOG).toLowerCase();
  for (const domain of ['security', 'robotics', 'health', 'infrastructure']) {
    assert.ok(covered.includes(domain), `the copy implies ${domain} and the catalogue has none`);
  }
});

// The standing rule. A recruiter-facing page is where invented metrics are most tempting,
// because time-to-fill is the number they are measured on.
test('it claims no results Covenda has not produced', () => {
  for (const pattern of [
    /time.to.fill (of|is|averag)/i,
    /\d+\s*(days|weeks) to (fill|hire)/i,
    /\d+\s*(students?|candidates?) placed/i,
    /trusted by/i,
    /our (clients|customers|partners)/i,
    /\d+%\s*(faster|better|acceptance|success)/i,
  ]) {
    assert.ok(!pattern.test(band), `the recruiter section makes an unfounded claim: ${pattern}`);
  }
  assert.match(band, /has not placed a student yet/i, 'the limitation must be stated where it is most tempting to omit');
  assert.match(band, /will not invent one/i);
});

// Saying what the product is NOT is what makes the rest credible to a buyer who has been
// sold a résumé database before.
test('it says plainly what it does not offer', () => {
  assert.match(band, /no résumé database|no resume database/i);
  assert.match(band, /no score to sort by/i);
});

test('the evidence claim carries its own limits, as the evidence model does', () => {
  assert.match(band, /what it establishes and what it does not/i);
});

test('it reuses the page conventions rather than inventing a look', () => {
  assert.match(band, /class="feature-kicker"/, 'the eyebrow should be the site eyebrow');
  assert.match(css, /\.section-heading h2,[^{]*\.recruiter-lede h2/, 'the heading must join the shared rule');
  const own = css.match(/\.recruiter-lede h2\s*\{[^}]*\}/)[0];
  for (const property of ['font-size', 'font-weight', 'letter-spacing']) {
    assert.ok(!own.includes(property), `.recruiter-lede h2 restates ${property} instead of inheriting it`);
  }
  const rule = css.match(/\.recruiter-band\s*\{[^}]*\}/)[0];
  assert.match(rule, /background:\s*#fff/, 'a tinted band between two white sections reads as another site');
});

test('every class it uses is styled, and the grid collapses on a phone', () => {
  const classes = [...band.matchAll(/class="([^"]+)"/g)]
    .flatMap(m => m[1].split(/\s+/))
    .filter(c => c.startsWith('recruiter-'));
  for (const name of new Set(classes)) assert.ok(css.includes(`.${name}`), `.${name} is used but never styled`);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]{0,120}\.recruiter-grid \{ grid-template-columns: 1fr; \}/);
});

test('the copy carries no em dashes', () => {
  assert.ok(!band.replace(/<[^>]+>/g, ' ').includes('—'));
});

test('its icons resolve', () => {
  for (const icon of [...band.matchAll(/#(icon-[a-z-]+)/g)].map(m => m[1])) {
    assert.ok(html.includes(`id="${icon}"`), `${icon} is referenced but not defined`);
  }
});
