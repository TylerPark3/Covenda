import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkDecomposition, normaliseDiagnosis, diagnosisGaps, checkInputs, checkSignals,
  buildRubric, evaluateBrief, defenseQuestionsFor, requiresDefense, recordRevision,
  briefVersion, CAUSE_CLASSES, RUBRIC_LEVELS,
} from '../../api/brief-engine.js';

const SIGNAL = {
  trait: 'Structured thinking', element: 'how you bound the problem before touching data',
  weakLooksLike: 'Starts computing immediately', strongLooksLike: 'States assumptions and scope first',
};
const OK_BRIEF = {
  title: 'Churn cohort read', deliverable: 'memo', valueToCompany: 'A cohort read they do not have',
  discriminatingSignal: [SIGNAL],
  inputsRequired: [{ label: 'Public pricing page', kind: 'public' }],
  founderTimeRequired: 45, rubricSkill: 'default', estimatedHours: 6,
};

// ── The two jobs. A brief that cannot do both is refused, never padded. ───────────────
test('a brief with no discriminating signal is refused as free labour', () => {
  const r = evaluateBrief({ ...OK_BRIEF, discriminatingSignal: [] });
  assert.equal(r.ok, false);
  assert.match(r.refusal.reasons.join(' '), /free labour/i);
});

test('a brief with no value to the company is refused as a take-home', () => {
  const r = evaluateBrief({ ...OK_BRIEF, valueToCompany: '' });
  assert.equal(r.ok, false);
  assert.match(r.refusal.reasons.join(' '), /take-home/i);
});

test('a brief doing both jobs passes and carries every required field', () => {
  const r = evaluateBrief(OK_BRIEF, { traits: ['Structured thinking'] });
  assert.equal(r.ok, true);
  assert.equal(r.refusal, null);
  assert.ok(r.valueToCompany);
  assert.equal(r.discriminatingSignal.length, 1);
  assert.equal(r.founderTimeRequired, 45);
  assert.ok(r.gradingRubric.complete);
  RUBRIC_LEVELS.forEach(l => assert.ok(r.gradingRubric.anchors[l], `anchor ${l}`));
});

test('refusal guidance says redesign, never pad', () => {
  const r = evaluateBrief({ ...OK_BRIEF, valueToCompany: '' });
  assert.match(r.refusal.guidance, /[Dd]o not pad/);
});

// ── NDA constraint ────────────────────────────────────────────────────────────────────
test('a brief needing internal data is blocked with the reason', () => {
  const r = evaluateBrief({ ...OK_BRIEF, inputsRequired: [{ label: 'Last year revenue export', kind: 'internal' }] });
  assert.equal(r.ok, false);
  assert.match(r.refusal.reasons.join(' '), /Redesign around public, synthetic, or founder-approved/);
  assert.equal(r.blockedInputs.length, 1);
});

test('public, synthetic and founder-approved inputs all pass', () => {
  for (const kind of ['public', 'synthetic', 'founder_approved']) {
    assert.equal(checkInputs([{ label: 'x', kind }]).ok, true, kind);
  }
});

// ── Honesty about what a brief tests ──────────────────────────────────────────────────
test('a trait that does not discriminate must say so rather than be faked', () => {
  const honest = checkSignals([SIGNAL, { trait: 'Culture fit', discriminates: false }], []);
  assert.equal(honest.ok, true, 'an honest declaration is allowed');
  const dishonest = checkSignals([{ trait: 'Culture fit', discriminates: true }], []);
  assert.equal(dishonest.ok, false);
  assert.match(dishonest.problems.join(' '), /names no part of the task/);
});

test('a signal with no weak/strong contrast is rejected as unusable by a rater', () => {
  const r = checkSignals([{ ...SIGNAL, weakLooksLike: '', strongLooksLike: '' }], []);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /weak\/strong contrast/);
});

test('traits the founder named but the brief does not cover are surfaced', () => {
  const r = evaluateBrief(OK_BRIEF, { traits: ['Structured thinking', 'Writing'] });
  assert.deepEqual(r.uncoveredTraits, ['Writing']);
});

// ── Diagnosis ─────────────────────────────────────────────────────────────────────────
test('one branch is not a decomposition', () => {
  assert.equal(checkDecomposition([{ label: 'marketing' }]).ok, false);
  assert.equal(checkDecomposition([{ label: 'marketing' }, { label: 'pricing' }]).ok, true);
});

test('duplicate branches break mutual exclusivity', () => {
  const r = checkDecomposition([{ label: 'Pricing' }, { label: 'pricing!' }]);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /mutually exclusive/);
});

// The classic failure this exists to catch: the founder blames marketing, the evidence says
// otherwise, and the brief gets scoped against the wrong branch.
test('stated and likely problems are both kept when they diverge', () => {
  const d = normaliseDiagnosis({ statedProblem: 'Marketing is failing', likelyProblem: 'Channel conflict' });
  assert.equal(d.diverges, true);
  assert.equal(d.statedProblem, 'Marketing is failing');
  assert.equal(d.likelyProblem, 'Channel conflict');
});

test('a root cause must be labelled structural or behavioral, since they scope differently', () => {
  assert.equal(normaliseDiagnosis({ rootCauseClass: 'vibes' }).rootCauseClass, null);
  for (const c of CAUSE_CLASSES) {
    const d = normaliseDiagnosis({ rootCauseClass: c });
    assert.equal(d.rootCauseClass, c);
    assert.ok(d.rootCauseGuidance, `${c} needs guidance`);
  }
});

test('thin input returns specific questions instead of a guess', () => {
  const asks = diagnosisGaps(normaliseDiagnosis({}));
  assert.ok(asks.length >= 3);
  assert.ok(asks.every(a => a.endsWith('?')));
});

// ── AI resistance ─────────────────────────────────────────────────────────────────────
test('defense questions are built from the brief, not generic', () => {
  const qs = defenseQuestionsFor({ briefTitle: 'Churn cohort read', deliverable: 'memo', signals: [SIGNAL] });
  assert.ok(qs.some(q => /bound the problem/.test(q)), 'ties to this brief’s own signal');
  assert.ok(qs.some(q => /Churn cohort read/.test(q)));
});

test('substantive work needs a defense; trivial work does not', () => {
  assert.equal(requiresDefense({ estimatedHours: 6, discriminatingCount: 1 }), true);
  assert.equal(requiresDefense({ estimatedHours: 1, discriminatingCount: 1 }), false);
});

// The claim has to stay honest — this raises the cost of faking, it does not prevent it.
test('the AI-resistance note never claims faking is impossible', () => {
  const r = evaluateBrief(OK_BRIEF);
  assert.match(r.defense.note, /does not make it impossible/i);
  assert.doesNotMatch(r.defense.note, /cannot be faked|impossible to fake/i);
});

// ── Revisions ─────────────────────────────────────────────────────────────────────────
// Founder edits are the best training data we will get about what founders want, which is
// why an edit without a reason is refused — same rule as human_rationale on matches.
test('a revision without a reason is refused', () => {
  assert.throws(() => recordRevision([], { field: 'scope', to: 'x' }), /Say why you changed it/);
});

test('revisions accumulate and drive the version', () => {
  let h = recordRevision([], { field: 'scope', from: 'a', to: 'b', reason: 'too broad' });
  h = recordRevision(h, { field: 'deliverable', from: 'x', to: 'y', reason: 'wrong artifact' });
  assert.equal(h.length, 2);
  assert.equal(h[0].reason, 'too broad');
  assert.equal(briefVersion(h), 3);
  assert.equal(briefVersion([]), 1);
});

test('the rubric reuses the existing anchors rather than inventing a scale', () => {
  const r = buildRubric('Financial modeling');
  assert.ok(r.anchors[4] && r.anchors[6] && r.anchors[9]);
  assert.match(r.anchors[9], /\w/);
  assert.equal(buildRubric('Financial modeling', { 9: 'custom top' }).anchors[9], 'custom top');
});
