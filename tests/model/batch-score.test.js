import test from 'node:test';
import assert from 'node:assert/strict';
import { batchScore, studentView, WEIGHTS, activityComponent, expertComponent } from '../../api/batch-score.js';

const FULL = {
  raterScores: [{ score: 8 }, { score: 7 }],
  compatibility: 80,
  activity: { correctAnswers: 8, totalAnswered: 10, exercisesCompleted: 2, exercisesOffered: 2, activeMinutes: 120 },
};

test('the three components are weighted roughly evenly', () => {
  assert.ok(Math.abs(WEIGHTS.expert + WEIGHTS.compatibility + WEIGHTS.activity - 1) < 0.001);
  for (const w of Object.values(WEIGHTS)) assert.ok(w > 0.3 && w < 0.36);
});

// Rule #1 of the vetting brief: never a student-facing person-score, never a ranking.
test('the composite is operator-facing and never binding', () => {
  const s = batchScore(FULL);
  assert.equal(s.operatorOnly, true);
  assert.equal(s.binding, false);
  assert.match(s.note, /never admits anyone on its own/);
});

test('the student sees a checklist and no number at all', () => {
  const v = studentView(FULL);
  assert.equal(v.total, undefined);
  assert.equal(v.score, undefined);
  assert.equal(v.rank, undefined);
  assert.ok(Array.isArray(v.outstanding));
});

// A partial composite ranks people on different bases, which is worse than not ranking.
test('a missing component blocks scoring instead of scoring around it', () => {
  const s = batchScore({ ...FULL, compatibility: null });
  assert.equal(s.ready, false);
  assert.deepEqual(s.missing, ['compatibility']);
  assert.match(s.reason, /add skills/i);
});

test('one reviewer is not "the expert assessment"', () => {
  const one = expertComponent([{ score: 9 }]);
  assert.equal(one.ready, false);
  assert.match(one.reason, /Needs a second/);
});

test('a wide reviewer split goes to a third reader rather than averaging', () => {
  const split = expertComponent([{ score: 4 }, { score: 9 }]);
  assert.equal(split.ready, false);
  assert.match(split.reason, /third reader/);
});

// The concern I raised: time measures availability, which correlates with not needing a job.
test('session time is capped at 15% of the activity third and saturates', () => {
  const noTime = activityComponent({ correctAnswers: 9, totalAnswered: 10, exercisesCompleted: 2, exercisesOffered: 2, activeMinutes: 0 });
  const lots = activityComponent({ correctAnswers: 9, totalAnswered: 10, exercisesCompleted: 2, exercisesOffered: 2, activeMinutes: 6000 });
  assert.ok(lots.value - noTime.value <= 16, 'time cannot swing the activity third by more than its cap');
  assert.match(lots.note, /capped at 15%/);
});

test('doing well beats being present', () => {
  const present = activityComponent({ correctAnswers: 1, totalAnswered: 10, exercisesCompleted: 0, exercisesOffered: 2, activeMinutes: 10000 });
  const capable = activityComponent({ correctAnswers: 10, totalAnswered: 10, exercisesCompleted: 2, exercisesOffered: 2, activeMinutes: 20 });
  assert.ok(capable.value > present.value * 2);
});

test('compatibility is labelled fit rather than capability', () => {
  assert.match(batchScore(FULL).components.compatibility.note, /Fit, not capability/);
});

// Number(null) is 0 and isFinite(0) is true, so an unscored student was being ranked as if
// they had scored zero — strictly worse than refusing to rank them.
test('a null component is absence, not a score of zero', () => {
  for (const missing of [null, undefined, '']) {
    const s = batchScore({ ...FULL, compatibility: missing });
    assert.equal(s.ready, false, String(missing));
    assert.deepEqual(s.missing, ['compatibility']);
  }
  // A real zero is still a real score.
  assert.equal(batchScore({ ...FULL, compatibility: 0 }).ready, true);
});
