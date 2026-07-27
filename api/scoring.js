// The compatibility scoring architecture: how the rule-based score and the learned re-ranker
// combine, and what happens at every stage before the model is allowed to touch anything.
//
// ── THE PROBLEM THIS SOLVES ───────────────────────────────────────────────────────────
// Two scorers exist and nothing connected them. `computeFitScore` is deterministic and runs
// today. `fitScorerModel` is a real logistic-regression re-ranker that refuses to emit a model
// below 50 completed outcomes. There was no layer deciding which one speaks, so in practice
// the model could never speak at all.
//
// ── THE ARCHITECTURE ──────────────────────────────────────────────────────────────────
// Four stages. A candidate moves down only as far as the data honestly allows.
//
//   STAGE 1  RULES        Always runs. Transparent, explainable, never skipped.
//   STAGE 2  SHADOW       Model predicts and is logged, and changes nothing. This is how you
//                         learn whether it is any good without betting anything on it.
//   STAGE 3  BOUNDED      Model may move the score, but only within a hard cap.
//   STAGE 4  —            Does not exist. There is no stage where the model decides alone.
//
// ── WHY THE MODEL RE-RANKS RATHER THAN SCORES ─────────────────────────────────────────
// A learned score replacing an explainable one trades away the only thing that makes the
// number usable: a company can ask why. So the rules score is the number, and the model is
// allowed to nudge it. If the model is removed the product still works, which is the test of
// whether a machine-learning feature is load-bearing or decorative.
//
// ── WHY THE INFLUENCE IS CAPPED ───────────────────────────────────────────────────────
// MAX_SHIFT is the blast radius. A miscalibrated model that can move a score 8 points
// reorders a shortlist at the margin; one that can move it 40 invents a different candidate.
// The cap is what makes deploying a first model a recoverable decision rather than a bet.

import { predict, toTrainingRow, ML_VERSION } from './ml.js';
import { scorerGate } from './hardening.js';

export const SCORING_VERSION = 'scoring-architecture-1.0.0';

// The most the learned layer may move a rules score, in points out of 100.
export const MAX_SHIFT = 8;

export const STAGES = {
  RULES: 'rules',       // the model has nothing to say yet
  SHADOW: 'shadow',     // it says it, we write it down, it changes nothing
  BOUNDED: 'bounded',   // it may move the number, within MAX_SHIFT
};

// Deployment stage is a deliberate operator decision, never inferred from "we have enough
// rows now". Clearing the gate makes a stage POSSIBLE; a human still has to choose it.
export function resolveStage({ outcomeCount = 0, model = null, operatorStage = null } = {}) {
  const gate = scorerGate(outcomeCount);
  if (!gate.ready || !model) {
    return { stage: STAGES.RULES, gate, reason: gate.ready ? 'No trained model is loaded.' : `Needs ${gate.needed - gate.have} more completed outcomes.` };
  }
  // Shadow is the default the moment a model exists, and staying there is a valid end state.
  if (operatorStage !== STAGES.BOUNDED) {
    return { stage: STAGES.SHADOW, gate, reason: 'A model exists and is being measured against the rules score. It is not influencing anything.' };
  }
  return { stage: STAGES.BOUNDED, gate, reason: `The model may move a score by at most ${MAX_SHIFT} points.` };
}

// Bounded, symmetric, and centred on 0.5 so a model with no opinion changes nothing.
export function boundedShift(probability) {
  const p = Number(probability);
  if (!Number.isFinite(p)) return 0;
  return Math.round(((Math.min(1, Math.max(0, p)) - 0.5) * 2 * MAX_SHIFT) * 10) / 10;
}

// The one entry point. Callers pass the rules result and whatever model state exists; they
// never decide the stage themselves, because that decision has to be made in one place.
export function scoreCandidate({ rules, match = {}, project = {}, model = null, outcomeCount = 0, operatorStage = null } = {}) {
  if (!rules || !Number.isFinite(rules.score)) throw new Error('scoreCandidate needs a rules result — the rules layer is never optional.');
  const resolved = resolveStage({ outcomeCount, model, operatorStage });

  const base = {
    score: rules.score,
    precise: Number.isFinite(rules.precise) ? rules.precise : rules.score,
    reasons: rules.reasons || [],
    concerns: rules.concerns || [],
    comparedOn: rules.comparedOn ?? null,
    stage: resolved.stage,
    stageReason: resolved.reason,
    gate: resolved.gate,
    learned: null,
    version: SCORING_VERSION,
    modelVersion: ML_VERSION,
  };
  if (resolved.stage === STAGES.RULES) return base;

  let probability = null;
  try {
    probability = predict(model, toTrainingRow(match, project).features);
  } catch (error) {
    // A model that throws must never take a score down with it. The rules answer stands and
    // the failure is named rather than swallowed.
    return { ...base, stage: STAGES.RULES, stageReason: `The model failed to score and was skipped: ${String(error?.message || error)}` };
  }

  const shift = boundedShift(probability);
  const learned = { probability: Math.round(probability * 1000) / 1000, shift, applied: resolved.stage === STAGES.BOUNDED, capped: Math.abs(shift) >= MAX_SHIFT };

  // Shadow: recorded, visible to operators, and applied to nothing.
  if (resolved.stage === STAGES.SHADOW) return { ...base, learned };

  const moved = Math.max(0, Math.min(100, base.precise + shift));
  return {
    ...base,
    score: Math.round(moved),
    precise: Math.round(moved * 10) / 10,
    learned,
    // The adjustment is stated in the reasons a company reads. A silent nudge is the thing
    // that makes a score impossible to argue with, which is the thing to avoid.
    reasons: [...base.reasons, `Adjusted ${shift >= 0 ? '+' : ''}${shift} by the outcome model, which is capped at ${MAX_SHIFT} points either way.`],
  };
}

// What an operator needs to decide whether to advance a stage. Deliberately not a
// recommendation: the numbers are here, the judgement is theirs.
export function deploymentReport({ outcomeCount = 0, model = null, evaluation = null, operatorStage = null } = {}) {
  const resolved = resolveStage({ outcomeCount, model, operatorStage });
  const blockers = [];
  if (!resolved.gate.ready) blockers.push(`${resolved.gate.needed - resolved.gate.have} more completed outcomes before a model can be trained at all.`);
  if (resolved.gate.ready && !model) blockers.push('The gate is open but no model has been trained yet.');
  if (model && evaluation && Number.isFinite(evaluation.brier) && evaluation.brier > 0.25) {
    blockers.push(`Brier score ${evaluation.brier} is worse than a coin flip dressed up. Do not advance past shadow.`);
  }
  return {
    stage: resolved.stage,
    reason: resolved.reason,
    gate: resolved.gate,
    maxShift: MAX_SHIFT,
    blockers,
    // Stated because "when can we turn it on" deserves a number rather than a feeling.
    canAdvance: resolved.stage === STAGES.SHADOW && !blockers.length,
    nextStage: resolved.stage === STAGES.RULES ? STAGES.SHADOW : resolved.stage === STAGES.SHADOW ? STAGES.BOUNDED : null,
    version: SCORING_VERSION,
  };
}
