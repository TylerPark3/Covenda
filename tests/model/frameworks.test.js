import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAMEWORKS, frameworkFor, decompositionGuide, trialEnvelope, checkAgainstEnvelope,
} from '../../api/frameworks.js';

const VERTICALS = Object.keys(FRAMEWORKS);

// Generic decomposition is what produces the consulting parody: three branches that would
// fit any company in any industry.
test('every vertical decomposes along its own dimensions', () => {
  assert.equal(VERTICALS.length, 5);
  const all = VERTICALS.flatMap(v => FRAMEWORKS[v].dimensions.map(d => d.key));
  const perVertical = VERTICALS.map(v => FRAMEWORKS[v].dimensions.map(d => d.key).join(','));
  assert.equal(new Set(perVertical).size, 5, 'no two verticals share a decomposition');
  assert.ok(all.length >= 20);
});

test('each dimension carries the question that separates it from its neighbours', () => {
  for (const v of VERTICALS) {
    for (const d of FRAMEWORKS[v].dimensions) {
      assert.ok(d.probe.endsWith('?'), `${v}/${d.key}`);
      assert.ok(d.probe.length > 20, `${v}/${d.key}`);
    }
  }
});

// The classic failure the brief engine exists to catch, encoded per industry.
test('every framework names the misdiagnosis to check first', () => {
  for (const v of VERTICALS) {
    assert.ok(FRAMEWORKS[v].commonMisdiagnosis.length > 40, v);
  }
  assert.match(FRAMEWORKS['Consumer & retail'].commonMisdiagnosis, /traffic is up and conversion is flat/);
});

test('structural and behavioral have different tells per vertical', () => {
  for (const v of VERTICALS) {
    const f = FRAMEWORKS[v];
    assert.notEqual(f.structuralSignal, f.behavioralSignal, v);
    assert.ok(f.structuralSignal.length > 20 && f.behavioralSignal.length > 20, v);
  }
});

// A framework that diagnoses beautifully and cannot become two weeks of student work is a
// consulting deliverable, not a Covenda brief.
test('every framework states what a bounded trial can and cannot produce', () => {
  for (const v of VERTICALS) {
    const env = trialEnvelope(v);
    assert.ok(env.can.length >= 3, v);
    assert.ok(env.cannot.length > 20, v);
  }
});

// The hard constraints are hard. These are not style preferences.
test('a trial needing patient data, PII, production or spend is refused', () => {
  const cases = [
    ['Healthcare operations', 'Analyse patient records', 'identifiable patient data'],
    ['Consumer & retail', 'Export the customer list', 'customer PII'],
    ['Software & AI', 'Debug it against the production database', 'production access'],
    ['Consumer & retail', 'Run ads with our budget', 'spend authority'],
    ['Professional services', 'Review the client-confidential deck', 'client-confidential material'],
  ];
  for (const [vertical, deliverable, expected] of cases) {
    const r = checkAgainstEnvelope(vertical, { deliverable });
    assert.equal(r.ok, false, deliverable);
    assert.match(r.reason, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(r.reason, /public, synthetic or founder-approved/);
  }
});

test('a clean trial passes and gets examples rather than a refusal', () => {
  const r = checkAgainstEnvelope('Software & AI', {
    deliverable: 'Reproduce the timeout and characterise when it happens',
    inputsRequired: [{ label: 'Public repo', kind: 'public' }],
  });
  assert.equal(r.ok, true);
  assert.ok(r.examples.length > 0);
});

test('the decomposition guide asks for branches to be ruled OUT, not just in', () => {
  const g = decompositionGuide('Accounting & finance');
  assert.match(g.instruction, /ruling one out is a finding/);
  assert.equal(g.dimensions.length, 5);
  assert.ok(g.checkFirst);
});

test('an unknown vertical returns null rather than a generic framework', () => {
  assert.equal(frameworkFor('Astrology'), null);
  assert.equal(decompositionGuide('Astrology'), null);
  assert.equal(checkAgainstEnvelope('Astrology', { deliverable: 'x' }).ok, true, 'and never blocks on one it has no view of');
});
