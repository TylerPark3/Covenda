import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
const standing = new Function(
  app.slice(app.indexOf('const REFERRER_POINTS'), app.indexOf('function renderReferrerDashboard'))
  + '; return referrerStanding;',
)();

const verified = (batch = null) => ({ status: 'verified', batch });
const working = (batch = null) => ({ status: 'working', batch });
const endorsed = (batch = null) => ({ status: 'endorsed', batch });

// The old formula was a ratio, and a ratio punishes the thing it should reward: vouching for
// one student who got verified scored 100, vouching for twenty and seeing fifteen verified
// scored lower. Referring more people made a professor look worse.
test('referring more students never lowers standing', () => {
  const one = standing([verified('AI & ML')]);
  const many = standing([...Array(15).fill(verified('AI & ML')), ...Array(5).fill(endorsed())]);
  assert.ok(many.points > one.points, `15 verified scored ${many.points}, one verified scored ${one.points}`);

  // And adding a referral that has not landed yet must not subtract.
  const before = standing([verified('AI & ML'), working()]);
  const after = standing([verified('AI & ML'), working(), endorsed(), endorsed()]);
  assert.ok(after.points >= before.points, 'a pending referral reduced standing');
});

// An endorsement is a claim. The entire product exists to separate claims from what happened.
test('an endorsement on its own is worth nothing', () => {
  assert.equal(standing([endorsed(), endorsed(), endorsed()]).points, 0);
  assert.equal(standing([]).points, 0);
  assert.match(standing([]).band, /No track record yet/);
});

// The thing that was asked for: students reaching real batches has to count.
test('batch admission counts, because it is an outcome somebody else verified', () => {
  const withBatch = standing([endorsed('AI & machine learning')]);
  const without = standing([endorsed()]);
  assert.ok(withBatch.points > without.points, 'clearing a published bar counted for nothing');

  // And it stacks with completing the work, rather than replacing it.
  assert.ok(standing([verified('AI & ML')]).points > standing([verified()]).points);
});

test('standing is a named band, not a percentage of a total that does not exist', () => {
  const s = standing([...Array(6).fill(verified('AI & ML'))]);
  assert.ok(typeof s.band === 'string' && s.band.length > 4);
  assert.ok(!('percent' in s) && !('weight' in s));
  // Progress is toward the NEXT band, which means something.
  assert.ok(s.toNext >= 0 && s.toNext <= 100);
});

test('the bands rise in order and the top one has no next', () => {
  const ladder = [0, 4, 10, 40].map(n => standing(Array(n).fill(verified('AI & ML'))));
  for (let i = 1; i < ladder.length; i += 1) {
    assert.ok(ladder[i].points >= ladder[i - 1].points, 'points went backwards');
  }
  assert.equal(ladder[ladder.length - 1].next, null, 'the top band still advertises a next one');
  assert.equal(ladder[ladder.length - 1].toNext, 100);
});

test('the counts shown include batch admissions', () => {
  const s = standing([verified('AI & ML'), working('Security'), endorsed()]);
  assert.equal(s.counts.batched, 2);
  assert.equal(s.counts.verified, 1);
  assert.equal(s.counts.endorsed, 1);
  // Batch admissions are no longer a fourth peer stat: they cut across all three statuses
  // rather than following them, so the dashboard states the count as the cross-cutting fact it
  // is. It still has to be shown, which is what this guards.
  assert.match(app, /\$\{counts\.batched\} of \$\{students\.length\} are in a batch/,
    'the dashboard does not show batch admissions');
});

// Nothing here is measured yet, and the label has to keep saying so.
test('the meter still says it is illustrative', () => {
  // The illustrative label is the guard that matters and it stays. "Standing accumulates..."
  // is deleted: the branch above it now shows the roster splitting into verified / working /
  // endorsed, so a paragraph explaining that the numbers accumulate described what is drawn.
  assert.match(app, /Illustrative · \$\{standing\.points\}/);
  assert.ok(!/Standing accumulates/.test(app), 'the deleted explanation is back');
});
