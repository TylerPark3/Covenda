// The Project Brief Engine.
//
// Startups already know a trial period is how they actually decide. What stops them running
// one is the founder time it costs. That cost is the wedge: they describe the problem, we
// produce the trial.
//
// Which means a brief has to do two jobs at once, and the whole module is organised around
// refusing to pretend when it cannot:
//
//   * USEFUL      — a bounded piece of work worth doing even if nobody is hired from it.
//   * DISCRIMINATING — it separates a strong candidate from a weak one on the traits this
//                      founder actually named.
//
// Useful but not discriminating is free labour. Discriminating but not useful is a take-home
// nobody wanted. A brief that cannot be both is refused with the reason, the same posture
// matchOpportunity takes when no candidate clears the bar.
//
// Hard constraint: no NDA'd internal data and no prior company work. Early-stage founders
// cannot get that approved quickly, and a brief that waits on legal never runs. Public,
// synthetic, or founder-approved inputs only — and the engine flags anything that drifts.
//
// This module is PURE. No I/O, no clock, no randomness. The model call lives in
// api/project-intake.js; everything here validates, decomposes, and refuses.

import { RUBRIC_ANCHORS, DEFENSE_QUESTIONS } from './hardening.js';

export const BRIEF_ENGINE_VERSION = 'brief-engine-1.0.0';

// ── Diagnosis ─────────────────────────────────────────────────────────────────────────
// Founders misdiagnose, the same way corporates do. "Sales are down, blame marketing" when
// traffic is up and the real cause is a channel conflict. So the stated problem is a claim
// to be tested, never the scope.

export const CAUSE_CLASSES = ['structural', 'behavioral'];

// Structural and behavioral causes produce completely different briefs, which is the reason
// the label is mandatory rather than decorative. A structural cause wants the process
// redesigned; a behavioral one wants the existing process actually followed.
export const CAUSE_GUIDANCE = {
  structural: 'The process or model is wrong for the work. The brief should redesign or replace it.',
  behavioral: 'The process is sound but execution is inconsistent. The brief should instrument or enforce it.',
};

// A decomposition is only MECE if the branches do not overlap and together cover the stated
// problem. We cannot prove that from text, but we can catch the two failures that matter:
// a single branch (which is not a decomposition) and duplicate branches (not exclusive).
export function checkDecomposition(branches = []) {
  const clean = (branches || [])
    .map(b => ({ ...b, label: String(b?.label || '').trim() }))
    .filter(b => b.label);
  const problems = [];
  if (clean.length < 2) problems.push('A decomposition with fewer than two branches is not a decomposition.');
  const seen = new Set();
  for (const b of clean) {
    const key = b.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) problems.push(`Branch "${b.label}" is a duplicate — branches must be mutually exclusive.`);
    seen.add(key);
  }
  // Collective exhaustiveness cannot be proven, so it is asserted by the author and shown to
  // the founder rather than silently claimed.
  return { ok: problems.length === 0, branches: clean, problems };
}

export function normaliseDiagnosis(raw = {}) {
  const decomposition = checkDecomposition(raw.decomposition);
  const rootCauseClass = CAUSE_CLASSES.includes(raw.rootCauseClass) ? raw.rootCauseClass : null;
  const stated = String(raw.statedProblem || '').trim();
  const likely = String(raw.likelyProblem || '').trim();

  return {
    statedProblem: stated,
    likelyProblem: likely,
    // Shown to the founder explicitly when they diverge; they get to overrule us.
    diverges: Boolean(stated && likely && stated.toLowerCase() !== likely.toLowerCase()),
    decomposition: decomposition.branches,
    decompositionProblems: decomposition.problems,
    rootCause: String(raw.rootCause || '').trim(),
    rootCauseClass,
    rootCauseGuidance: rootCauseClass ? CAUSE_GUIDANCE[rootCauseClass] : null,
    reasoning: String(raw.reasoning || '').trim(),
    // What would confirm or kill the hypothesis. This is not filler — it is usually the work.
    confirmingEvidence: toList(raw.confirmingEvidence),
    killingEvidence: toList(raw.killingEvidence),
  };
}

// Too thin to diagnose? Ask, do not guess. The questions are specific to what is missing.
export function diagnosisGaps(diagnosis = {}) {
  const asks = [];
  if (!diagnosis.statedProblem) asks.push('What is the problem, in your own words?');
  if (!diagnosis.decomposition?.length || diagnosis.decompositionProblems?.length) {
    asks.push('What else could be causing this, besides the most obvious explanation?');
  }
  if (!diagnosis.rootCauseClass) {
    asks.push('Is the process itself wrong for this work, or is the process fine and it is not being followed?');
  }
  if (!diagnosis.confirmingEvidence.length) {
    asks.push('What would you need to see to be convinced of the cause?');
  }
  return asks;
}

// ── Trial design ──────────────────────────────────────────────────────────────────────

export const RUBRIC_LEVELS = [4, 6, 9];

// Inputs a brief is allowed to depend on. Anything else is flagged for redesign rather than
// shipped and then blocked on a legal review that will not happen this month.
export const ALLOWED_INPUT_KINDS = ['public', 'synthetic', 'founder_approved'];

export function checkInputs(inputs = []) {
  const clean = (inputs || []).map(i => ({
    label: String(i?.label || '').trim(),
    kind: String(i?.kind || '').trim(),
  })).filter(i => i.label);
  const blocked = clean.filter(i => !ALLOWED_INPUT_KINDS.includes(i.kind));
  return {
    ok: blocked.length === 0,
    inputs: clean,
    blocked,
    reason: blocked.length
      ? `Needs material we cannot get early: ${blocked.map(b => b.label).join(', ')}. Redesign around public, synthetic, or founder-approved inputs.`
      : null,
  };
}

// A trait the founder named, and the specific part of the task that separates strong from
// weak on it. A trait with no discriminating element must SAY so — claiming a brief tests
// something it does not is the failure this whole field exists to prevent.
export function checkSignals(signals = [], traits = []) {
  const clean = (signals || []).map(s => ({
    trait: String(s?.trait || '').trim(),
    element: String(s?.element || '').trim(),
    weakLooksLike: String(s?.weakLooksLike || '').trim(),
    strongLooksLike: String(s?.strongLooksLike || '').trim(),
    discriminates: s?.discriminates !== false,
  })).filter(s => s.trait);

  const problems = [];
  for (const s of clean) {
    if (!s.discriminates) continue; // Honest declaration; allowed.
    if (!s.element) problems.push(`"${s.trait}" claims to discriminate but names no part of the task that does it.`);
    if (!s.weakLooksLike || !s.strongLooksLike) {
      problems.push(`"${s.trait}" has no weak/strong contrast, so a reviewer cannot apply it.`);
    }
  }
  const covered = new Set(clean.map(s => s.trait.toLowerCase()));
  const uncovered = (traits || [])
    .map(t => String(t || '').trim()).filter(Boolean)
    .filter(t => !covered.has(t.toLowerCase()));

  const discriminating = clean.filter(s => s.discriminates);
  return {
    ok: problems.length === 0 && discriminating.length > 0,
    signals: clean,
    problems,
    uncovered,
    discriminatingCount: discriminating.length,
  };
}

// Anchored at 4 / 6 / 9, reusing the existing anchors so briefs feed the dual-rater flow
// already built rather than inventing a parallel scale.
export function buildRubric(skill, overrides = {}) {
  const base = RUBRIC_ANCHORS[skill] || RUBRIC_ANCHORS.default;
  const rubric = {};
  for (const level of RUBRIC_LEVELS) {
    const custom = String(overrides?.[level] || '').trim();
    rubric[level] = custom || base?.[level] || base?.[String(level)] || '';
  }
  return { skill: skill || 'default', anchors: rubric, complete: RUBRIC_LEVELS.every(l => rubric[l]) };
}

// ── AI resistance ─────────────────────────────────────────────────────────────────────
// LLMs made written applications worthless as signal. A brief is credible only if faking it
// is expensive — and the honest claim is exactly that: this raises the cost of faking, it
// does not make faking impossible.

export const AI_RESISTANCE_NOTE =
  'A recorded walkthrough raises the cost of passing off work you did not do. It does not make it impossible.';

// Generic prompts are what a model answers well. These are built from the brief and the
// candidate's own submission, so the answer cannot be prepared in advance.
export function defenseQuestionsFor({ briefTitle = '', deliverable = '', signals = [] } = {}) {
  const specific = [];
  for (const s of (signals || []).filter(x => x?.discriminates !== false && x?.element)) {
    specific.push(`On ${s.trait.toLowerCase()}: walk me through ${s.element.replace(/\.$/, '')}.`);
  }
  if (deliverable) specific.push(`Show me the part of your ${deliverable.toLowerCase()} you are least sure about, and say why.`);
  if (briefTitle) specific.push(`If the constraints on "${briefTitle}" changed tomorrow, what breaks first?`);
  // The generic three stay as a floor; the specific ones are what a model cannot pre-answer.
  return [...specific.slice(0, 4), ...DEFENSE_QUESTIONS];
}

// Substantive work must be defended. Trivial work should not demand a recording — that is
// friction with no signal behind it.
export function requiresDefense({ estimatedHours = 0, discriminatingCount = 0 } = {}) {
  return Number(estimatedHours) >= 3 || Number(discriminatingCount) >= 2;
}

// ── The verdict ───────────────────────────────────────────────────────────────────────

export function evaluateBrief(brief = {}, { traits = [] } = {}) {
  const reasons = [];
  const value = String(brief.valueToCompany || '').trim();
  if (!value) reasons.push('No stated value to the company — a brief nobody benefits from is a take-home test.');

  const signals = checkSignals(brief.discriminatingSignal, traits);
  if (!signals.discriminatingCount) {
    reasons.push('Nothing in this brief separates a strong candidate from a weak one — that is free labour, not a trial.');
  }
  reasons.push(...signals.problems);

  const inputs = checkInputs(brief.inputsRequired);
  if (!inputs.ok) reasons.push(inputs.reason);

  const minutes = Number(brief.founderTimeRequired);
  if (!Number.isFinite(minutes) || minutes < 0) {
    reasons.push('No honest founder-time estimate. Founder time is the cost we exist to reduce; it cannot be left blank.');
  }

  const rubric = buildRubric(brief.rubricSkill, brief.gradingRubric);
  if (!rubric.complete) reasons.push('The 4/6/9 rubric is incomplete, so two raters cannot agree on what they are scoring.');

  const needsDefense = requiresDefense({
    estimatedHours: brief.estimatedHours,
    discriminatingCount: signals.discriminatingCount,
  });

  return {
    version: BRIEF_ENGINE_VERSION,
    ok: reasons.length === 0,
    // Refusal is a first-class outcome, not an error. Padding a brief that cannot do both
    // jobs is how a platform ends up shipping free labour with a scoring rubric stapled on.
    refusal: reasons.length ? { reasons, guidance: 'Redesign the task, or tell the founder what is missing. Do not pad it.' } : null,
    valueToCompany: value,
    discriminatingSignal: signals.signals,
    uncoveredTraits: signals.uncovered,
    inputsRequired: inputs.inputs,
    blockedInputs: inputs.blocked,
    founderTimeRequired: Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : null,
    gradingRubric: rubric,
    defense: needsDefense
      ? { required: true, questions: defenseQuestionsFor({ briefTitle: brief.title, deliverable: brief.deliverable, signals: signals.signals }), note: AI_RESISTANCE_NOTE }
      : { required: false, questions: [], note: 'Short enough that a recording would be friction without signal.' },
  };
}

// ── Revisions ─────────────────────────────────────────────────────────────────────────
// A founder editing a proposed brief is the highest-value training data we will ever get
// about what founders actually want — the same reason human_rationale is mandatory on
// matches. So an edit without a reason is refused.

export function recordRevision(history = [], { field, from, to, reason, by, at } = {}) {
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw new Error('Say why you changed it. The reason is the part worth keeping.');
  const entry = {
    field: String(field || '').trim() || 'brief',
    from: from == null ? null : String(from).slice(0, 2000),
    to: to == null ? null : String(to).slice(0, 2000),
    reason: cleanReason.slice(0, 1000),
    by: by || null,
    at: at || null, // Caller stamps it; this module stays clock-free.
  };
  return [...(history || []), entry];
}

export function briefVersion(history = []) {
  return 1 + (history || []).length;
}

function toList(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).slice(0, 10);
  return String(value || '').split(/[\n;]/).map(v => v.trim()).filter(Boolean).slice(0, 10);
}
