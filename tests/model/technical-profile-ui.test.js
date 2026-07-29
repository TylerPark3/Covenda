import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../portal.css', import.meta.url), 'utf8');
const panel = js.slice(js.indexOf('function renderTechnicalProfile'), js.indexOf('function renderCredibility'));
// Comments explain why a thing is NOT done, so they contain the very words these assertions
// search for. "Not a ranking against anyone" is a promise kept, not a ranking. Strip them
// and read the code, the same trap as "age" matching inside "stage".
const code = panel.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

// portal.js is a classic script: an import statement anywhere in it breaks the whole file.
test('the panel adds no module syntax to a classic script', () => {
  assert.doesNotThrow(() => new Function(js));
});

test('the panel is rendered where a student will see it', () => {
  assert.match(js, /renderTechnicalProfile\(root,state\.dashboard\)/);
  assert.match(panel, /d\?\.profile\?\.role!=='student'/, 'the panel must not render for companies');
});

// The single number is the artifact this product exists to replace, and this panel is where
// it would sit most naturally.
test('no composite score is displayed', () => {
  for (const banned of [/score/i, /rating/i, /percentile/i, /\bout of 100\b/i, /\/100/]) {
    assert.ok(!banned.test(code), `the technical panel renders a ${banned}`);
  }
});

test('breadth is drawn relative to the student, never to other students', () => {
  assert.match(code, /widest/, 'the bar must scale to this student\'s own widest domain');
  assert.ok(!/rank|percentile|average|compared/i.test(code), 'breadth is being compared across students');
});

test('every claim on screen states what backs it', () => {
  assert.match(panel, /techTierChip\(domain\.best\)/, 'a domain must show its strongest evidence tier');
  assert.match(panel, /techTierChip\(item\.tier\)/, 'a skill must show its evidence tier');
});

test('the self-reported tier is labelled as such rather than dressed up', () => {
  assert.match(js, /claimed:'Self-reported'/);
});

// A framework with nothing in it reads as a broken feature. The first version returned early,
// which hid the Add button from exactly the students who had nothing yet. It collapses to that
// one control instead.
test('an empty panel collapses to the way to fill it, rather than vanishing', () => {
  assert.match(panel, /const empty=!t\.breadth\.length&&!t\.depth\.length/);
  assert.match(panel, /Add your first evidence/);
  assert.match(panel, /Nothing here yet/);
  assert.ok(!/if\(!t\.breadth\.length&&!t\.depth\.length\)return;/.test(panel), 'the panel still returns early when empty');
});

test('gaps are framed as what is not shown, not as a deficiency', () => {
  assert.match(panel, /Not shown yet/);
  assert.match(panel, /Nothing here counts against you/);
});

test('builder history counts projects, and says so only when repetition is real', () => {
  assert.match(panel, /t\.repeatedBuilder/);
  assert.match(panel, /pattern rather than a single good term/);
});

test('every class the panel uses is styled, in both themes', () => {
  const classes = [...panel.matchAll(/className=['"]([^'"]+)['"]/g)]
    .flatMap(m => m[1].split(/\s+/))
    .filter(c => c.startsWith('tech-'));
  for (const name of new Set(classes)) {
    assert.ok(css.includes(`.${name}`), `.${name} is rendered but never styled`);
  }
  // Styled through tokens so the night theme follows from the palette rather than a parallel
  // set of rules that can drift.
  const block = css.slice(css.indexOf('/* ── Technical profile'));
  const literals = block.match(/:\s*#[0-9a-f]{6}\b/gi) || [];
  assert.ok(literals.length <= 2, `hard-coded colours will not follow the theme: ${literals.join(', ')}`);
});

test('the domain grid collapses on a phone', () => {
  assert.match(css, /@media \(max-width:560px\)[\s\S]{0,200}\.tech-domain \{ grid-template-columns:1fr auto; \}/);
});

// A domain reports its BEST tier. Rendering one list of skills under that tier made a typed
// skill look evidenced by standing next to a verified one.
test('a listed-only skill is never shown under an evidenced domain tier', () => {
  assert.match(code, /domain\.evidenced/, 'the domain must separate evidenced skills');
  assert.match(code, /domain\.claimedOnly/, 'listed-only skills must be labelled apart');
  assert.match(code, /listed only:/);
  assert.match(css, /\.tech-listed/);
});

test('the breadth bar is drawn from evidence, so listing more never widens it', () => {
  assert.match(code, /domain\.evidencedCount\/widest/);
  assert.ok(!/domain\.skillCount\/widest/.test(code), 'the bar still counts self-reported skills');
});
