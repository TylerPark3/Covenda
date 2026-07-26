import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ML_VERSION, FEATURES, toTrainingRow, splitRows, trainLogistic, predict,
  explainModel, evaluateModel, fitScorerModel, trainingReadiness,
} from '../../api/ml.js';

// Deterministic synthetic set: work lands when skills and evidence are both strong.
function makeRows(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const strong = i % 3 !== 0;
    rows.push({
      id: 'row-' + i,
      features: [
        strong ? 0.9 : 0.2, strong ? 0.8 : 0.15, strong ? 0.7 : 0.3,
        0.5, strong ? 1 : 0, strong ? 1 : 0, strong ? 0.6 : 0.05, strong ? 0.4 : 0,
      ],
      label: strong ? 1 : 0,
    });
  }
  return rows;
}

// The refusal is the most important behaviour in this file.
test('below the gate it refuses to produce a model, and says why', () => {
  const result = fitScorerModel(makeRows(12));
  assert.equal(result.ready, false);
  assert.equal(result.model, null);
  assert.match(result.reason, /50 completed outcomes/);
  assert.match(result.reason, /fit noise/);
  assert.equal(result.gate.ready, false);
});

test('at zero outcomes it still refuses cleanly rather than throwing', () => {
  const result = fitScorerModel([]);
  assert.equal(result.ready, false);
  assert.equal(result.model, null);
  const readiness = trainingReadiness([]);
  assert.equal(readiness.rows, 0);
  assert.equal(readiness.needed, 50);
  assert.ok(readiness.blockers.some(b => /no positive outcomes/.test(b)));
});

test('past the gate it trains, and the model actually learns the signal', () => {
  const result = fitScorerModel(makeRows(120));
  assert.equal(result.ready, true);
  assert.ok(result.model);
  assert.equal(result.evaluation.n > 0, true);
  assert.ok(result.evaluation.accuracy > result.evaluation.baseRate,
    `accuracy ${result.evaluation.accuracy} must beat base rate ${result.evaluation.baseRate}`);
  // Still shadow-deployed: Stage 5 audits the human, it does not replace them.
  assert.equal(result.deployment, 'shadow');
});

test('coefficients are readable — they ARE the audit', () => {
  const model = trainLogistic(makeRows(120));
  const explained = explainModel(model);
  assert.equal(explained.length, FEATURES.length);
  for (const row of explained) {
    assert.ok(typeof row.feature === 'string');
    assert.equal(Number.isFinite(row.coefficient), true);
  }
  // Sorted by influence, so "what moved this" is the first line.
  assert.ok(Math.abs(explained[0].coefficient) >= Math.abs(explained.at(-1).coefficient));
});

// Protected attributes cannot be smuggled in by retraining, because they are never extracted.
test('no protected attribute or proxy is a feature', () => {
  for (const f of FEATURES) {
    assert.doesNotMatch(f, /school|prestige|name|age|gender|race|ethnic|university|gpa/i);
  }
});

test('training is deterministic — same rows, same model', () => {
  const a = trainLogistic(makeRows(80));
  const b = trainLogistic(makeRows(80));
  assert.deepEqual(a.weights, b.weights);
  assert.equal(a.bias, b.bias);
});

test('the split is stable, disjoint and complete', () => {
  const rows = makeRows(120);
  const one = splitRows(rows);
  const two = splitRows(rows);
  assert.deepEqual(one.test.map(r => r.id), two.test.map(r => r.id));
  assert.equal(one.train.length + one.test.length, rows.length);
  const testIds = new Set(one.test.map(r => r.id));
  assert.equal(one.train.some(r => testIds.has(r.id)), false, 'no row may be in both folds');
});

test('accuracy is always reported next to the base rate', () => {
  // An all-positive set makes a lazy model look perfect; base rate exposes that.
  const rows = makeRows(60).map(r => ({ ...r, label: 1 }));
  const evaluation = evaluateModel(trainLogistic(rows), rows);
  assert.equal(evaluation.baseRate, 1);
  assert.ok('brier' in evaluation && 'ece' in evaluation);
});

test('a label is behaviour, not a rating', () => {
  const shipped = toTrainingRow({ id: 'm1', score_components: { skills_match: 0.8 } },
    { completed_at: '2026-08-01', conversion_outcome: 'hired' });
  assert.equal(shipped.label, 1);
  const rejected = toTrainingRow({ id: 'm2' }, { completed_at: '2026-08-01', conversion_outcome: 'rejected' });
  assert.equal(rejected.label, 0);
  const unfinished = toTrainingRow({ id: 'm3' }, {});
  assert.equal(unfinished.label, 0);
  assert.equal(shipped.features.length, FEATURES.length);
});

test('malformed components degrade to zero rather than NaN', () => {
  const row = toTrainingRow({ id: 'x', score_components: { skills_match: 'nonsense', evidence_depth: null } }, {});
  assert.ok(row.features.every(Number.isFinite));
  assert.ok(row.features.every(f => f >= 0 && f <= 1));
  assert.equal(predict(trainLogistic([]), row.features), 0.5); // zero weights -> no opinion
});

test('readiness names what is missing', () => {
  const readiness = trainingReadiness(makeRows(20));
  assert.equal(readiness.needed, 30);
  assert.equal(readiness.balanced, true);
  assert.equal(readiness.version, ML_VERSION);
});
