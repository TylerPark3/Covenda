import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BATCH_CATALOG, batchCompatibility, SPECIALISATION_SKILLS } from '../../api/batches.js';
import { verticalFor } from '../../api/vertical-map.js';

const scoreFor = (slug, student) => batchCompatibility(BATCH_CATALOG.find(b => b.slug === slug), student);

test('every batch a student can open has core skills to match against', () => {
  const unmapped = BATCH_CATALOG.filter(b => !(SPECIALISATION_SKILLS[b.slug] || []).length);
  assert.deepEqual(unmapped.map(b => b.slug), [], 'a batch with no core skills scores everyone at 0');
});

test('every batch has a vertical-map entry, so the card can say what it tests', () => {
  const orphans = BATCH_CATALOG.filter(b => !verticalFor(b.slug));
  assert.deepEqual(orphans.map(b => b.slug), []);
});

// The bug: the matcher scored word overlap against the batch's PROSE. "PyTorch" appears
// nowhere in the ai-ml summary, so an ML student matched nothing on the ML batch.
test('a skill matches through the taxonomy, not through prose wording', () => {
  const student = { skills: ['PyTorch'] };
  assert.ok(scoreFor('ai-ml', student).score > 0, 'PyTorch must reach Machine learning');
  assert.ok(scoreFor('infrastructure-data', { skills: ['Docker'] }).score > 0, 'Docker must reach Cloud & DevOps');
  assert.ok(scoreFor('investment-banking', { skills: ['DCF'] }).score > 0, 'DCF must reach Financial modeling');
});

// The old denominator was the student's own list, so every extra skill you listed lowered
// every score you had. Students were punished for filling in their profile.
test('listing more skills never lowers a score', () => {
  const few = scoreFor('ai-ml', { skills: ['Python', 'PyTorch'] }).score;
  const many = scoreFor('ai-ml', { skills: ['Python', 'PyTorch', 'Ceramics', 'Trail running', 'Bartending'] }).score;
  assert.ok(many >= few, `adding unrelated skills dropped the score ${few} -> ${many}`);
});

// A ranking where finance ties with ML for an ML student is not a ranking.
test('the right batch outranks an unrelated one for the same student', () => {
  const ml = { skills: ['Python', 'PyTorch', 'model evaluation', 'statistics'], verticals: ['software-ai'] };
  assert.ok(scoreFor('ai-ml', ml).score > scoreFor('legal-operations', ml).score);

  const banker = { skills: ['DCF', 'Excel', 'comps', 'valuation'], verticals: ['accounting-finance'] };
  assert.ok(scoreFor('investment-banking', banker).score > scoreFor('physical-ai', banker).score);
});

// Everything collapsing into one narrow band is what made the filter look broken: four
// buttons, three of them showing zero.
test('scores spread across the catalog rather than clustering', () => {
  const student = { skills: ['Python', 'PyTorch', 'SQL', 'Docker', 'React'], verticals: ['software-ai'] };
  const scores = BATCH_CATALOG.map(b => batchCompatibility(b, student).score);
  const spread = Math.max(...scores) - Math.min(...scores);
  assert.ok(spread >= 40, `catalog spread is only ${spread} points`);
  assert.ok(new Set(scores).size >= 6, `only ${new Set(scores).size} distinct scores across 25 batches`);
});

test('a score names what is still missing, not just what matched', () => {
  const r = scoreFor('ai-ml', { skills: ['Python'] });
  assert.ok(r.missing.includes('Machine learning'), 'the headline gap must be named');
  assert.ok(!r.missing.includes('Python'), 'a held skill is not missing');
  assert.match(r.why, /Still wants/);
});

test('duplicate aliases credit one requirement, not two', () => {
  const one = scoreFor('ai-ml', { skills: ['PyTorch'] }).score;
  const two = scoreFor('ai-ml', { skills: ['PyTorch', 'TensorFlow', 'deep learning'] }).score;
  assert.equal(one, two, 'three names for Machine learning triple-counted');
});

// The match was computed, filtered on and sorted by, but only ever DRAWN on the company card.
test('the student card renders the match it filters by', () => {
  const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const card = src.slice(src.indexOf('function batchCard('), src.indexOf('let batchResumeUrl'));
  assert.match(card, /compatPill\(batch\.compatibility\)/, 'student card never draws the match');
  assert.match(card, /batchSkillLedger\(batch\)/);
  assert.match(card, /batch\.evaluates/, 'the card must say what the batch tests');
});

// verticalSlug lives only on the catalog entry; the DB row is snake_case and has none. Grafting
// requirements alone left the vertical bonus unable to fire for anybody.
test('the API merges the catalog entry, not just its requirements', () => {
  const src = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('const batchesWithFit'), src.indexOf('const batchesWithFit') + 1200);
  assert.match(block, /verticalSlug: spec\.verticalSlug/);
  assert.match(block, /coreSkills: SPECIALISATION_SKILLS/);
  assert.match(block, /\{ \.\.\.spec, \.\.\.b/, 'the row must win over the catalog on live columns');
});

// Quartiles of the student's own distribution produced "1%+" and "5%+" for anybody scoring
// low, and a one percent match is not a filter anybody would choose. The number has to mean
// something independently of who is looking at it.
test('the thresholds are meaningful numbers, not cuts through one profile', () => {
  const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function batchFitSteps'), src.indexOf('// ── The simulation runner'));
  const batchFitSteps = new Function(fn + '; return batchFitSteps;')();

  for (const student of [
    { skills: ['Python', 'PyTorch', 'SQL', 'Docker', 'React'], verticals: ['software-ai'] },
    { skills: ['Writing'] },
    { skills: ['Excel', 'DCF', 'valuation'], verticals: ['accounting-finance'] },
  ]) {
    const fits = BATCH_CATALOG.map(b => batchCompatibility(b, student).score);
    for (const step of batchFitSteps(fits)) {
      if (step.value === 0) continue;
      assert.ok([25, 50, 75].includes(step.value), `${step.label} is not a threshold anybody would choose`);
    }
  }
});

// Two thresholds that hide the same batches are two buttons doing one job.
test('no two filter steps produce the same set, and none is dead', () => {
  const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function batchFitSteps'), src.indexOf('// ── The simulation runner'));
  const batchFitSteps = new Function(fn + '; return batchFitSteps;')();

  const profiles = [
    { skills: ['Python', 'PyTorch', 'SQL', 'Docker', 'React'], verticals: ['software-ai'] },
    { skills: ['Excel', 'DCF', 'valuation', 'research'], verticals: ['accounting-finance'] },
    { skills: ['Writing'] },
  ];
  for (const student of profiles) {
    const fits = BATCH_CATALOG.map(b => batchCompatibility(b, student).score);
    const counts = batchFitSteps(fits).map(s => fits.filter(f => f === null || f >= s.value).length);
    assert.equal(new Set(counts).size, counts.length, `redundant steps: ${counts.join(',')}`);
    assert.ok(!counts.includes(0), `a step hides everything: ${counts.join(',')}`);
  }
});

test('a profile with no skills collapses to a single step rather than a dead rail', () => {
  const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function batchFitSteps'), src.indexOf('// ── The simulation runner'));
  const batchFitSteps = new Function(fn + '; return batchFitSteps;')();
  assert.deepEqual(batchFitSteps(BATCH_CATALOG.map(() => null)), [{ value: 0, label: 'All' }]);
});
