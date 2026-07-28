import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commitmentFor, calibrate, adjudicationQueue, recordAdjudication, auditDrift, LOAD, ROLES } from '../../api/professional-review.js';

// "A professional vets this" said loosely means three different products. The one that fails
// is the one where they review every submission: they stop answering by week three.
test('the ask is bounded, and says so in hours', () => {
  const c = commitmentFor('Software & AI');
  assert.equal(c.ask.length, 3);
  assert.deepEqual(c.ask.map(a => a.role), ROLES);
  for (const item of c.ask) assert.ok(item.time, `${item.role} does not say how long it takes`);
  assert.ok(LOAD.maxAdjudicationsPerCycle <= 10, 'an uncapped tiebreak queue is an unbounded ask');
});

test('what is NOT being asked is stated up front', () => {
  const c = commitmentFor('Software & AI');
  assert.ok(c.notAsked.some(x => /Reviewing every applicant/.test(x)));
  assert.ok(c.notAsked.some(x => /commitment to hire/i.test(x)));
  assert.ok(c.notAsked.some(x => /named publicly before you agree/i.test(x)));
});

// The point of asking a practitioner is that their judgement outranks ours on their subject.
test('the bar is the practitioner median, not an average with ours', () => {
  const anchors = [4, 6, 7, 8, 9].map((score, i) => ({ ref: `a${i}`, score, why: 'reason' }));
  assert.equal(calibrate({ vertical: 'x', by: 'K', anchors }).bar, 7);
  // A median so one harsh or generous anchor cannot move the standard for everyone after.
  const skewed = [7, 7, 7, 7, 0].map((score, i) => ({ ref: `b${i}`, score, why: 'reason' }));
  assert.equal(calibrate({ vertical: 'x', by: 'K', anchors: skewed }).bar, 7);
});

test('calibration must be attributed and complete', () => {
  const anchors = [1, 2, 3, 4, 5].map((score, i) => ({ ref: `a${i}`, score, why: 'r' }));
  assert.throws(() => calibrate({ vertical: 'x', anchors }), /attributed to a named person/);
  assert.throws(() => calibrate({ vertical: 'x', by: 'K', anchors: anchors.slice(0, 3) }), /needs 5 scored anchors/);
});

// A bar with no reasoning behind it cannot be applied consistently by anyone else.
test('anchors scored without a reason are counted, not silently accepted', () => {
  const anchors = [5, 6, 7, 8, 9].map((score, i) => ({ ref: `a${i}`, score, why: i < 3 ? 'r' : null }));
  assert.equal(calibrate({ vertical: 'x', by: 'K', anchors }).incomplete, 2);
});

test('only genuine disagreements are routed, and only within budget', () => {
  const contested = { book: { python: { raters: { a: { score: 3 }, b: { score: 8 } } } }, skill: 'python' };
  const agreed = { book: { python: { raters: { a: { score: 7 }, b: { score: 7 } } } }, skill: 'python' };
  const q = adjudicationQueue([...Array(12).fill(contested), ...Array(5).fill(agreed)]);
  assert.equal(q.contested, 12, 'agreement never reaches the practitioner');
  assert.equal(q.send.length, LOAD.maxAdjudicationsPerCycle);
  assert.equal(q.absorb.length, 12 - LOAD.maxAdjudicationsPerCycle);
});

// A queue Covenda is quietly swallowing is a queue nobody knows is growing.
test('the absorbed overflow is surfaced rather than hidden', () => {
  const contested = { book: { python: { raters: { a: { score: 2 }, b: { score: 9 } } } }, skill: 'python' };
  const q = adjudicationQueue(Array(12).fill(contested));
  assert.match(q.note, /beyond the practitioner's cap/);
  assert.match(q.note, /Covenda adjudicates those internally/);
  assert.equal(adjudicationQueue([contested]).note, null, 'no note when nothing overflows');
});

test('used budget carries across the cycle', () => {
  const contested = { book: { python: { raters: { a: { score: 2 }, b: { score: 9 } } } }, skill: 'python' };
  const q = adjudicationQueue(Array(5).fill(contested), { usedThisCycle: LOAD.maxAdjudicationsPerCycle });
  assert.equal(q.send.length, 0);
  assert.equal(q.absorb.length, 5);
});

// A practitioner tiebreak and an internal one are not the same claim.
test('a practitioner adjudication is marked as one', () => {
  const book = { python: { raters: { a: { score: 3 }, b: { score: 8 } } } };
  const out = recordAdjudication(book, { skill: 'python', score: 6, by: 'K', note: 'closer to 6' });
  assert.equal(out.python.adjudicated.source, 'practitioner');
  assert.equal(out.python.adjudicated.score, 6);
});

// Scoring too generously admits people who then fail in front of a company.
test('drift reports direction, not just magnitude', () => {
  const soft = auditDrift([
    { covendaScore: 8, practitionerScore: 6 },
    { covendaScore: 7, practitionerScore: 5 },
    { covendaScore: 9, practitionerScore: 7 },
  ]);
  assert.equal(soft.drifted, true);
  assert.match(soft.direction, /softer than the practitioner/);
  assert.match(soft.action, /Re-run calibration/);

  const aligned = auditDrift([{ covendaScore: 7, practitionerScore: 7 }, { covendaScore: 6, practitionerScore: 6 }]);
  assert.equal(aligned.drifted, false);
  assert.match(aligned.action, /No change/);
});

test('the student is told what the practitioner does, not that one exists', () => {
  const src = readFileSync(new URL('../../api/reviewers.js', import.meta.url), 'utf8');
  assert.match(src, /scored the anchor submissions this bar is built from/);
  assert.match(src, /break ties when our two raters disagree/);
  assert.match(src, /re-check a sample each quarter/);
});
