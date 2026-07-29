import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIMENSIONS, DIMENSION_IDS, AGENCY_BANDS, AGENCY_DISQUALIFIERS, AI_BANDS,
  DEEP_DIVE, DEEP_DIVE_TOPICS, FIGURE_IT_OUT_STEPS, OUTCOME_MEASURES,
  assessmentPlan, deepDiveFor, blockerPrompt, figureItOut, calibrationStatus, agencyBand, aiBand,
} from '../../api/super-intern.js';
import { batchesByVertical } from '../../api/batches.js';

// Dimensions trade off against each other. A company hiring for autonomy wants a different
// profile from one hiring for depth, and averaging them destroys exactly the information that
// makes the match work.
test('nothing here collapses into a single readiness number', () => {
  const plan = assessmentPlan({});
  for (const banned of ['score', 'rating', 'readiness', 'total', 'grade', 'rank']) {
    assert.ok(!(banned in plan), `assessmentPlan returns a ${banned}`);
  }
  assert.ok(Array.isArray(plan.focus), 'dimensions must stay separate');
});

// The reframe the module exists for: the constraint is senior time, not the wage.
test('every dimension names what a company pays when it is weak', () => {
  for (const [id, d] of Object.entries(DIMENSIONS)) {
    assert.equal(d.id, id);
    assert.ok(d.reads, `${id} does not say what it reads`);
    assert.ok(d.costsSeniorTime, `${id} does not say what it costs in senior time`);
  }
  assert.equal(DIMENSION_IDS.length, 8);
});

test('scarce senior time makes self-direction a requirement, not a preference', () => {
  const scarce = assessmentPlan({ autonomy: 'guided', seniorHoursPerWeek: 2 });
  assert.ok(scarce.focus.includes('agency'), 'a team with no supervision budget still got a guided profile');
  assert.ok(scarce.focus.includes('resourcefulness'));
  assert.ok(scarce.because.some(b => /self-direction is a requirement/.test(b)));

  const plenty = assessmentPlan({ autonomy: 'guided', seniorHoursPerWeek: 12 });
  assert.ok(!plenty.focus.includes('agency'), 'a team with real capacity should not be forced into an autonomy profile');
});

test('the plan says which of the company constraints shaped it', () => {
  const plan = assessmentPlan({ autonomy: 'autonomous', seniorHoursPerWeek: 6, domainKnowledge: true, onboardingBurden: ['the codebase'] });
  assert.ok(plan.because.length >= 3, 'a plan nobody can interrogate is a black box');
  assert.ok(plan.because.some(b => /codebase/.test(b)));
  assert.ok(plan.because.some(b => /learning velocity/i.test(b)));
});

test('a defence is always the last component and never optional', () => {
  for (const autonomy of ['guided', 'semi_autonomous', 'autonomous', 'high_agency']) {
    const components = assessmentPlan({ autonomy }).components;
    assert.equal(components[components.length - 1].id, 'defense', `${autonomy} does not end in a defence`);
    assert.ok(components.some(c => c.id === 'deep_dive'), `${autonomy} skips the Deep Dive`);
  }
});

// ── Agency ────────────────────────────────────────────────────────────────────────────
// "High agency" is unusable as a trait and checkable as a behaviour.
test('agency is described as behaviour, in bands, not as a score', () => {
  assert.equal(AGENCY_BANDS.length, 3);
  for (const band of AGENCY_BANDS) {
    assert.ok(band.looksLike, `${band.id} has no observable behaviour`);
    assert.ok(band.reads, `${band.id} does not say what it means`);
    assert.ok(band.probe.trim().endsWith('?'), `${band.id} has no probe`);
    assert.ok(!('score' in band) && !('points' in band), 'a band must not carry a number');
  }
  assert.equal(agencyBand('routed').id, 'routed');
  assert.equal(agencyBand('nonsense'), null);
});

// The failure mode the whole framework has to avoid.
test('going around a person is never counted as agency', () => {
  assert.ok(AGENCY_DISQUALIFIERS.length >= 3);
  const text = AGENCY_DISQUALIFIERS.join(' ').toLowerCase();
  assert.ok(/said no/.test(text), 'overriding a refusal must be disqualifying');
  assert.ok(/control|permission/.test(text), 'bypassing a control must be disqualifying');
  assert.ok(/hid/.test(text), 'concealing a workaround must be disqualifying');
});

test('the waited band is treated as correct behaviour, not as failure', () => {
  assert.match(agencyBand('waited').reads, /Correct behaviour/);
});

test('the blocker prompt carries its standard so two reviewers apply one bar', () => {
  const prompt = blockerPrompt('a data pipeline');
  assert.equal(prompt.dimension, 'agency');
  assert.match(prompt.ask, /data pipeline/);
  assert.equal(prompt.lookFor.length, AGENCY_BANDS.length);
  assert.ok(prompt.disqualifiers.length);
  assert.ok(prompt.followUp.trim().endsWith('?'));
});

// ── Deep Dive ─────────────────────────────────────────────────────────────────────────
test('every vertical has Deep Dive topics, and the batch catalogue agrees', () => {
  const verticals = batchesByVertical().map(v => v.verticalSlug);
  for (const slug of verticals) {
    assert.ok(DEEP_DIVE_TOPICS[slug], `${slug} has no Deep Dive topics`);
    assert.ok(DEEP_DIVE_TOPICS[slug].length >= 4, `${slug} has too few topics to rotate`);
    assert.ok(deepDiveFor(slug), `deepDiveFor(${slug}) returned nothing`);
  }
  assert.equal(deepDiveFor('not-a-vertical'), null);
});

// A student picking their own topic tests what they already know, which is what a résumé
// already claims.
test('the topic is assigned rather than chosen, and rotates', () => {
  assert.match(DEEP_DIVE.stages[0].detail, /Chosen by Covenda .*not by the student/);
  const topics = new Set([0, 1, 2, 3].map(i => deepDiveFor('software-ai', i).topic));
  assert.ok(topics.size >= 3, 'the topic barely rotates, so a batch shares one answer');
  assert.equal(deepDiveFor('software-ai', 0).topic, deepDiveFor('software-ai', 0).topic, 'must be reproducible');
});

test('the Deep Dive reads for understanding rather than vocabulary', () => {
  const text = JSON.stringify(DEEP_DIVE).toLowerCase();
  assert.ok(/jargon/.test(text), 'jargon is the tell and should be named');
  assert.ok(DEEP_DIVE.fails.length >= 3, 'what a weak answer looks like must be written down');
  assert.ok(DEEP_DIVE.reads.some(r => /do not know/i.test(r.signal)), 'saying "I do not know" cleanly is a signal, not a gap');
  assert.deepEqual(deepDiveFor('software-ai').dimensions, ['learningVelocity', 'communication', 'discernment']);
});

// ── Figure It Out ─────────────────────────────────────────────────────────────────────
test('the process is what is read, in named steps', () => {
  assert.equal(FIGURE_IT_OUT_STEPS.length, 8);
  for (const step of FIGURE_IT_OUT_STEPS) assert.ok(step.asks.trim().endsWith('?'), `${step.id} has no question`);
  const ids = FIGURE_IT_OUT_STEPS.map(s => s.id);
  assert.ok(ids.indexOf('verify') < ids.indexOf('defend'), 'verification must come before defence');
});

// A student who thinks the tools are banned hides the process being assessed.
test('using AI is explicitly permitted in the framing', () => {
  const out = figureItOut({ vertical: 'infrastructure' });
  assert.match(out.framing, /including AI/i);
  assert.match(out.framing, /not whether you already knew/i);
  assert.ok(out.dimensions.includes('resourcefulness'));
});

// ── AI ────────────────────────────────────────────────────────────────────────────────
test('AI is banded by whether the student can stand behind the output', () => {
  assert.deepEqual(AI_BANDS.map(b => b.id), ['dependent', 'assisted', 'leveraged']);
  for (const band of AI_BANDS) {
    assert.ok(band.looksLike && band.reads, `${band.id} is underdescribed`);
    assert.ok(!('score' in band));
  }
  assert.match(aiBand('dependent').reads, /senior review/i, 'the cost of dependence is senior time');
  assert.equal(aiBand('made-up'), null);
});

// ── The outcome loop ──────────────────────────────────────────────────────────────────
test('the framework refuses to claim predictive power it has not earned', () => {
  const empty = calibrationStatus([]);
  assert.equal(empty.ready, false);
  assert.match(empty.claim, /cannot yet claim/i);

  const thin = calibrationStatus(Array.from({ length: 5 }, () => ({ days_to_contribution: 4 })));
  assert.equal(thin.ready, false, 'five placements is noise presented as insight');

  const enough = calibrationStatus(Array.from({ length: 20 }, () => ({ days_to_contribution: 4 })));
  assert.equal(enough.ready, true);
});

test('the outcome measures are the ones the thesis rests on', () => {
  const ids = OUTCOME_MEASURES.map(m => m.id);
  assert.ok(ids.includes('senior_hours'), 'senior time is the constraint and must be measured');
  assert.ok(ids.includes('days_to_contribution'));
  assert.ok(ids.includes('independent_resolution'));
  for (const m of OUTCOME_MEASURES) assert.ok(m.unit, `${m.id} has no unit`);
});
