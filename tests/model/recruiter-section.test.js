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
  assert.match(band, /twenty-seven specialisations/i);
  assert.equal(BATCH_CATALOG.length, 27, 'the copy says twenty-seven and the catalogue disagrees');
});

// Every vertical the copy names has to be one Covenda actually runs.
test('every vertical it names exists in the catalogue', () => {
  const disciplines = new Set(BATCH_CATALOG.map(b => b.discipline.toLowerCase()));
  const named = { software: 'software & ai', finance: 'accounting & finance', healthcare: 'healthcare operations',
    retail: 'consumer & retail', 'professional services': 'professional services' };
  for (const [word, discipline] of Object.entries(named)) {
    assert.ok(band.toLowerCase().includes(word), `${word} is missing from the copy`);
    assert.ok(disciplines.has(discipline), `the copy names ${word} and the catalogue has no ${discipline}`);
  }
  assert.equal(batchesByVertical().length, Object.keys(named).length, 'the copy lists a different number of verticals than exist');
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
  assert.match(band, /No placements yet/i, 'the limitation must be stated where it is most tempting to omit');
  assert.match(band, /none invented/i);
});

// Saying what the product is NOT is what makes the rest credible to a buyer who has been
// sold a résumé database before.
test('it says plainly what it does not offer', () => {
  assert.match(band, /No résumé database|No resume database/i);
  assert.match(band, /no score to sort by/i);
});

test('the evidence claim carries its own limits, as the evidence model does', () => {
  assert.match(band, /what it proves and what it does not/i);
});

// ── The diagram ───────────────────────────────────────────────────────────────────────
// It carries the argument, which is the only reason the prose can be three sentences.
test('the diagram is readable by someone who cannot see it', () => {
  const map = band.slice(band.indexOf('class="rmap"'), band.indexOf('recruiter-grid'));
  assert.match(map, /role="img"/);
  const label = map.match(/aria-label="([^"]+)"/);
  assert.ok(label && label[1].length > 80, 'the diagram has no usable description');
  assert.match(label[1], /verified and defended/i, 'the description must carry the same argument as the picture');
});

test('both rows have the same three slots, so the columns compare', () => {
  const map = band.slice(band.indexOf('class="rmap"'), band.indexOf('recruiter-grid'));
  const rows = map.split('rmap-row').slice(1);
  assert.equal(rows.length, 2);
  for (const row of rows) assert.equal((row.match(/<li/g) || []).length, 3, 'the rows do not line up');
});

// The border weight is the information: dashed for a claim, solid for something backed.
test('a claim and a backed step are drawn differently', () => {
  const map = band.slice(band.indexOf('class="rmap"'), band.indexOf('recruiter-grid'));
  const before = map.slice(0, map.indexOf('is-after'));
  const after = map.slice(map.indexOf('is-after'));
  assert.ok(!before.includes('is-on'), 'a résumé claim is drawn as though it were backed');
  assert.equal((after.match(/is-on/g) || []).length, 3);
  assert.match(css, /\.rmap-steps li \{[^}]*border: 1px dashed/);
  assert.match(css, /\.rmap-steps li\.is-on \{[^}]*border-style: solid/);
});

test('the diagram is built in HTML so it inherits the type scale', () => {
  const map = band.slice(band.indexOf('class="rmap"'), band.indexOf('recruiter-grid'));
  assert.ok(!/<svg|<path|viewBox/.test(map), 'raw SVG cannot inherit the tokens and its labels overflow');
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
  assert.match(css, /@media \(max-width: 860px\)[\s\S]{0,260}\.recruiter-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]{0,200}\.rmap-steps \{ grid-auto-flow: row; \}/, 'the diagram must stack on a phone');
});

test('the copy carries no em dashes', () => {
  assert.ok(!band.replace(/<[^>]+>/g, ' ').includes('—'));
});

test('its icons resolve', () => {
  for (const icon of [...band.matchAll(/#(icon-[a-z-]+)/g)].map(m => m[1])) {
    assert.ok(html.includes(`id="${icon}"`), `${icon} is referenced but not defined`);
  }
});

// The rewrite was for length. A section that grows back to four paragraphs has lost the point.
test('the section stays short', () => {
  const words = band.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  assert.ok(words < 220, `the recruiter section is back up to ${words} words`);
  const paragraphs = (band.match(/<p class="recruiter-body">/g) || []).length;
  assert.ok(paragraphs <= 1, `${paragraphs} lede paragraphs, the diagram is meant to carry the argument`);
});
