import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidate, resolveStage, boundedShift, deploymentReport, STAGES, MAX_SHIFT } from '../../api/scoring.js';

const rules = { score: 72, precise: 71.6, reasons: ['Matches your vertical'], concerns: [], comparedOn: 6 };
const model = { weights: Object.fromEntries(['skills_match','evidence_depth','project_relevance','availability_slack','referral_presence','ownership_verified','history_span','completed_projects'].map(k => [k, 0])), bias: 0 };

// The rules layer is the product. If the model disappears, scoring still works.
test('with no outcomes the model never speaks', () => {
  const r = scoreCandidate({ rules, outcomeCount: 0 });
  assert.equal(r.stage, STAGES.RULES);
  assert.equal(r.learned, null);
  assert.equal(r.score, 72, 'the rules score is untouched');
  assert.match(r.stageReason, /more completed outcomes/);
});

test('clearing the gate makes a stage possible, it does not advance one', () => {
  const r = scoreCandidate({ rules, outcomeCount: 500, model });
  assert.equal(r.stage, STAGES.SHADOW, 'never auto-advances to influencing anything');
  assert.equal(r.score, 72, 'shadow changes nothing');
  assert.ok(r.learned, 'but it is recorded');
  assert.equal(r.learned.applied, false);
});

test('an operator must choose bounded, and even then the influence is capped', () => {
  const r = scoreCandidate({ rules, outcomeCount: 500, model, operatorStage: STAGES.BOUNDED });
  assert.equal(r.stage, STAGES.BOUNDED);
  assert.ok(Math.abs(r.precise - rules.precise) <= MAX_SHIFT, 'blast radius is bounded');
  assert.ok(r.reasons.some(x => /Adjusted/.test(x)), 'a silent nudge is a score nobody can argue with');
});

// MAX_SHIFT is the blast radius: it makes deploying a first model recoverable.
test('the shift is symmetric, bounded, and zero when the model has no opinion', () => {
  assert.equal(boundedShift(0.5), 0);
  assert.equal(boundedShift(1), MAX_SHIFT);
  assert.equal(boundedShift(0), -MAX_SHIFT);
  assert.equal(boundedShift('nonsense'), 0, 'an unusable probability moves nothing');
  assert.equal(boundedShift(99), MAX_SHIFT, 'out-of-range is clamped, not trusted');
});

// A model that throws must never take a score down with it.
test('a model that fails falls back to rules and names the failure', () => {
  const broken = { get weights() { throw new Error('corrupt weights'); } };
  const r = scoreCandidate({ rules, outcomeCount: 500, model: broken, operatorStage: STAGES.BOUNDED });
  assert.equal(r.stage, STAGES.RULES);
  assert.equal(r.score, 72);
  assert.match(r.stageReason, /failed to score/);
});

test('the rules layer is never optional', () => {
  assert.throws(() => scoreCandidate({ outcomeCount: 500, model }), /rules layer is never optional/);
});

test('a model no better than a coin flip cannot be advanced', () => {
  const bad = deploymentReport({ outcomeCount: 500, model, evaluation: { brier: 0.31 }, operatorStage: STAGES.SHADOW });
  assert.equal(bad.canAdvance, false);
  assert.ok(bad.blockers.some(b => /coin flip/.test(b)));

  const good = deploymentReport({ outcomeCount: 500, model, evaluation: { brier: 0.14 }, operatorStage: STAGES.SHADOW });
  assert.equal(good.canAdvance, true);
  assert.equal(good.nextStage, STAGES.BOUNDED);
});

test('there is no stage where the model decides alone', () => {
  assert.deepEqual(Object.values(STAGES).sort(), ['bounded', 'rules', 'shadow']);
  const r = resolveStage({ outcomeCount: 9e9, model, operatorStage: 'autonomous' });
  assert.equal(r.stage, STAGES.SHADOW, 'an unknown stage falls back to the safe one');
});
