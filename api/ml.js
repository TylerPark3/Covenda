// Stage 5 — the learned re-ranker. The MACHINE is built here; the DEPLOYMENT stays gated.
//
// ── READ THIS BEFORE ENABLING ANYTHING ────────────────────────────────────────────────
// Covenda has no completed outcomes yet. A supervised model trained on zero labels is not a
// model, and one trained on six is worse than the rule-based scorer it would replace —
// it would fit noise, report a confident number, and be impossible to defend to a company
// or a regulator. So this file will REFUSE to return a usable model below the gate
// (SCORER_REVIEW_MIN_OUTCOMES = 50 in api/hardening.js). That refusal is a feature.
//
// What exists here is everything that can honestly be built before the data arrives:
//   * a deterministic feature extractor over the match log + outcomes
//   * logistic regression trained by gradient descent, in plain JS, no dependencies
//   * a held-out split, calibration, and readable coefficients
//   * a gate that refuses to emit a model — and a readiness report saying what is missing
//
// Logistic regression is the right first model on purpose, not a limitation. Its
// coefficients ARE the audit: you can read which feature moved a decision and by how much,
// which is what an adverse-impact review and NYC LL144 need. A gradient-boosted tree would
// score marginally better and be far harder to defend. No deep nets until outcomes number
// in the hundreds.
//
// Determinism: weights initialise at zero and the split is by stable hash, so the same rows
// always produce the same model. No Math.random anywhere — a model you cannot reproduce is
// a model you cannot audit.

import { SCORER_REVIEW_MIN_OUTCOMES, scorerGate } from './hardening.js';
import { brierScore, expectedCalibrationError } from './eval-metrics.js';

export const ML_VERSION = 'learned-rerank-0.1.0-gated';

// Observable features only — the same discipline as the rule-based scorer. Protected
// attributes and their proxies (school, name, age) are absent BY CONSTRUCTION: they are not
// extracted, so no amount of retraining can smuggle them in.
export const FEATURES = [
  'skills_match',        // fraction of required skills with evidence-backed claims
  'evidence_depth',      // tier-weighted evidence strength
  'project_relevance',   // vertical / work-type overlap
  'availability_slack',  // headroom over the required hours
  'referral_presence',   // staked vouch present
  'ownership_verified',  // evidence came from an owned, connected account
  'history_span',        // longest evidence span, normalised
  'completed_projects',  // prior accepted work, normalised
];

function clamp01(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

// One training row from a recorded match + its outcome. The LABEL is behaviour, never a
// rating: shipped-and-accepted. Founders inflate scores out of politeness; they do not
// inflate whether the work landed.
export function toTrainingRow(match = {}, project = {}) {
  const c = match.score_components || {};
  return {
    features: [
      clamp01(c.skills_match),
      clamp01(c.evidence_depth),
      clamp01(c.project_relevance),
      clamp01(c.availability_slack),
      clamp01(c.referral_presence),
      c.ownership_verified ? 1 : 0,
      clamp01(Number(c.history_span_days) / 365),
      clamp01(Number(project.completed_projects_at_match) / 5),
    ],
    label: project.completed_at && project.conversion_outcome !== 'rejected' ? 1 : 0,
    id: String(match.id || project.id || ''),
  };
}

// Stable, deterministic split — same rows always land in the same fold, so a rerun cannot
// quietly produce a better-looking test score.
function stableHash(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function splitRows(rows, { testFraction = 0.3 } = {}) {
  const train = [], test = [];
  for (const row of rows) (stableHash(row.id) < testFraction ? test : train).push(row);
  return { train, test };
}

const sigmoid = z => 1 / (1 + Math.exp(-z));

// Plain batch gradient descent with L2. Small data, few features — no optimiser library
// earns its dependency here, and a hand-written loop is auditable line by line.
export function trainLogistic(rows, { epochs = 400, lr = 0.35, l2 = 0.02 } = {}) {
  const n = FEATURES.length;
  const weights = new Array(n).fill(0);
  let bias = 0;
  if (!rows.length) return { weights, bias, epochs: 0 };

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(n).fill(0);
    let gradB = 0;
    for (const row of rows) {
      const z = row.features.reduce((sum, f, i) => sum + f * weights[i], bias);
      const err = sigmoid(z) - row.label;
      for (let i = 0; i < n; i++) gradW[i] += err * row.features[i];
      gradB += err;
    }
    for (let i = 0; i < n; i++) weights[i] -= lr * (gradW[i] / rows.length + l2 * weights[i]);
    bias -= lr * (gradB / rows.length);
  }
  return { weights, bias, epochs };
}

export function predict(model, features) {
  const z = features.reduce((sum, f, i) => sum + f * (model.weights[i] || 0), model.bias || 0);
  return sigmoid(z);
}

// Coefficients as plain reading. This is the score-the-scorer audit the model card promises:
// a positive coefficient means the feature pushed toward work landing, and the magnitude is
// how hard. Weights are reported alongside the rule-based config so drift is visible.
export function explainModel(model) {
  return FEATURES
    .map((name, i) => ({ feature: name, coefficient: Math.round(model.weights[i] * 1000) / 1000 }))
    .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
}

export function evaluateModel(model, testRows) {
  if (!testRows.length) return { n: 0, note: 'No held-out rows to score.' };
  const predictions = testRows.map(r => predict(model, r.features));
  const labels = testRows.map(r => r.label);
  const correct = predictions.filter((p, i) => (p >= 0.5 ? 1 : 0) === labels[i]).length;
  const positives = labels.filter(Boolean).length;
  return {
    n: testRows.length,
    accuracy: Math.round((correct / testRows.length) * 1000) / 1000,
    // Accuracy is close to meaningless on an imbalanced set; base rate is reported next to
    // it so a model that always predicts "yes" cannot look good.
    baseRate: Math.round((positives / testRows.length) * 1000) / 1000,
    brier: brierScore(predictions, labels),
    ece: expectedCalibrationError(predictions, labels),
  };
}

// The gate. Below the threshold this returns NO model — only what is missing and why.
export function fitScorerModel(rows, options = {}) {
  const outcomes = rows.filter(r => r.label === 1).length;
  const gate = scorerGate(rows.length);
  if (!gate.ready) {
    return {
      ready: false,
      model: null,
      gate,
      outcomes,
      reason: `A learned re-ranker needs ${SCORER_REVIEW_MIN_OUTCOMES} completed outcomes; there are ${rows.length}. `
        + 'Training now would fit noise and produce a confident number nobody could defend. '
        + 'The rule-based scorer stays in production until the gate clears.',
      version: ML_VERSION,
    };
  }
  const { train, test } = splitRows(rows, options);
  const model = trainLogistic(train, options);
  return {
    ready: true,
    model,
    gate,
    outcomes,
    coefficients: explainModel(model),
    evaluation: evaluateModel(model, test),
    // Even past the gate the model DRAFTS: the explanation layer stays mandatory and a human
    // still decides. Stage 5 audits the human's judgement, it does not replace it.
    deployment: 'shadow',
    note: 'Run in shadow against the rule-based scorer for a full cycle before it influences any ranking.',
    version: ML_VERSION,
  };
}

// What is actually missing, so "when can we turn this on" has a number rather than a feeling.
export function trainingReadiness(rows = []) {
  const labelled = rows.filter(r => r.label === 1).length;
  const gate = scorerGate(rows.length);
  return {
    rows: rows.length,
    positives: labelled,
    negatives: rows.length - labelled,
    needed: Math.max(0, SCORER_REVIEW_MIN_OUTCOMES - rows.length),
    ready: gate.ready,
    // A set that is all one class teaches nothing, however large it gets.
    balanced: labelled > 0 && labelled < rows.length,
    blockers: [
      rows.length < SCORER_REVIEW_MIN_OUTCOMES ? `${SCORER_REVIEW_MIN_OUTCOMES - rows.length} more completed outcomes` : null,
      labelled === 0 ? 'no positive outcomes yet — nothing to learn from' : null,
      labelled === rows.length && rows.length > 0 ? 'no negative outcomes yet — the model cannot separate' : null,
    ].filter(Boolean),
    version: ML_VERSION,
  };
}
