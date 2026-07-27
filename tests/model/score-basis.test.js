import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeFitScore, AXIS_COUNT } from '../../api/portal.js';

const project = { verticals: ['Software & AI'], work_types: ['Build'], desired_skills: 'python' };
const student = { verticals: ['Software & AI'], work_types: ['Build'], skills: ['python'] };

// A 78 built on two answered axes is not the claim a 78 built on eight is.
test('a score always reports what it was built on', () => {
  const thin = computeFitScore(project, student);
  assert.equal(thin.comparedOn, 0);

  const thick = computeFitScore(
    { ...project, env_pace: 'fast', env_scope: 'depth', env_autonomy: 'independent' },
    { ...student, work_style: { pace: 'fast', scope: 'depth', autonomy: 'independent' } },
  );
  assert.equal(thick.comparedOn, 3);
  assert.equal(AXIS_COUNT, 8);
});

// A score that only shows what went right is a score nobody can argue with.
test('the breakdown renders gaps, not only matches', () => {
  const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function scoreBreakdown'), src.indexOf('function renderVettingSteps'));
  assert.match(fn, /is-gap/, 'concerns must be rendered');
  assert.match(fn, /concerns\.filter/, 'and filtered of the no-concern placeholder');
  assert.match(fn, /No work-style axes compared yet/, 'a zero basis must say so plainly');
});

test('the breakdown states whether a learned model touched the number', () => {
  const src = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function scoreBreakdown'), src.indexOf('function renderVettingSteps'));
  for (const stage of ['bounded', 'shadow']) assert.match(fn, new RegExp(`'${stage}'`));
  assert.match(fn, /No learned model is affecting this number/, 'the default must be stated, not implied');
});

test('an unanswered axis still never lowers a score', () => {
  const none = computeFitScore(project, student);
  const some = computeFitScore({ ...project, env_pace: 'fast' }, { ...student, work_style: { pace: 'steady' } });
  assert.ok(some.score >= none.score - 0, 'a mismatch costs the unearned points, never more');
});
