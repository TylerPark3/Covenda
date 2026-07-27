import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFitScore, cleanTraits, cleanWorkStyle, WORK_STYLE_ENUMS, TRAIT_OPTIONS } from '../../api/portal.js';

const base = { verticals: ['Software & AI'], work_types: ['Build'], desired_skills: 'python' };
const student = { verticals: ['Software & AI'], work_types: ['Build'], skills: ['python'] };

test('eight axes are comparable, and every one is about how someone works', () => {
  assert.equal(Object.keys(WORK_STYLE_ENUMS).length, 8);
  // Tokenised, not substring-matched: "age" lives inside "stage", and a naive `includes`
  // would fail on a legitimate axis. This is the same trap as `\b` not crossing underscores.
  const words = new Set(
    (JSON.stringify(WORK_STYLE_ENUMS) + ' ' + JSON.stringify(TRAIT_OPTIONS))
      .toLowerCase().split(/[^a-z]+/).filter(Boolean),
  );
  // The exclusion is the reason this scoring is allowed to exist at all.
  for (const proxy of ['school', 'gpa', 'university', 'age', 'gender', 'citizen', 'visa', 'location', 'race', 'salary']) {
    assert.ok(!words.has(proxy), `"${proxy}" must never be a comparison axis`);
  }
});

// A blank must never read as a bad answer, or an incomplete profile becomes a penalised one.
test('an unanswered axis is skipped, never penalised', () => {
  const none = computeFitScore({ ...base }, { ...student });
  const some = computeFitScore(
    { ...base, env_pace: 'fast' },
    { ...student, work_style: { pace: 'fast' } },
  );
  assert.ok(some.score >= none.score, 'answering can only help');
  assert.equal(none.comparedOn, 0, 'nothing was compared, and it says so');
  assert.equal(some.comparedOn, 1);
});

test('the ideal intern actually moves the score', () => {
  const plain = computeFitScore({ ...base }, { ...student });
  const matched = computeFitScore(
    { ...base, ideal_skills: ['sql'], ideal_traits: ['ships fast'] },
    { ...student, skills: ['python', 'sql'], traits: ['ships fast'] },
  );
  assert.ok(matched.score > plain.score, `ideal-intern match must count: ${matched.score} vs ${plain.score}`);
  assert.ok(matched.reasons.some(r => /How you work lines up/.test(r)));
});

test('a mismatched trait earns nothing but is not a penalty', () => {
  const neutral = computeFitScore({ ...base }, { ...student });
  const mismatch = computeFitScore(
    { ...base, ideal_traits: ['ships fast'] },
    { ...student, traits: ['detail-obsessed'] },
  );
  assert.equal(mismatch.score, neutral.score);
});

test('the score carries one decimal, and it agrees with the integer', () => {
  const r = computeFitScore({ ...base, env_pace: 'fast' }, { ...student, work_style: { pace: 'fast' } });
  assert.equal(r.precise, Math.round(r.precise * 10) / 10);
  assert.equal(Math.round(r.precise), r.score);
});

test('traits outside the published list are dropped rather than stored', () => {
  assert.deepEqual(cleanTraits(['ships fast', 'went to Stanford', 'SHIPS FAST']), ['ships fast', 'ships fast']);
  assert.deepEqual(cleanTraits('not an array'), []);
  assert.equal(cleanTraits(Array(20).fill('ships fast')).length, 6, 'capped');
});

test('work style only accepts published values on published axes', () => {
  assert.deepEqual(cleanWorkStyle({ pace: 'fast', scope: 'depth', school: 'Yale' }), { pace: 'fast', scope: 'depth' });
  assert.equal(cleanWorkStyle({ pace: 'sideways' }), null);
});
