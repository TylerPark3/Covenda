import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_CATALOG, BATCH_ADMISSION_VERSION, VETTING_RAILS,
  batchBySlug, batchBrief, evaluateBatchAdmission, tierAtLeast,
} from '../../api/batches.js';

const software = batchBySlug('ai-ml'); // a specialisation, not the vertical

test('every vertical has a batch with a named technical vetting rail', () => {
  assert.ok(BATCH_CATALOG.length >= 20, 'each vertical splits into five sector-level batches');
  for (const batch of BATCH_CATALOG) {
    assert.ok(batch.slug && batch.name && batch.discipline, `${batch.slug} is missing identity`);
    const rails = batch.vetting?.rails || [];
    assert.ok(rails.length > 0, `${batch.slug} names no vetting rail`);
    for (const rail of rails) assert.ok(VETTING_RAILS[rail], `${batch.slug} references unknown rail ${rail}`);
    assert.ok((batch.requirements || []).length >= 3, `${batch.slug} has too thin a bar`);
    assert.ok((batch.companyWorkflow || []).length >= 5, `${batch.slug} has no company walkthrough`);
  }
});

// The honesty rule from docs/PROOF_CONNECTORS.md: never imply an API forensic where none
// exists. Batches with no live connector must be labelled human-rail, not API-verified.
test('batches without a connector are labelled human-rail, never API-verified', () => {
  for (const batch of BATCH_CATALOG) {
    const brief = batchBrief(batch);
    if (!(batch.vetting.connectors || []).length) {
      assert.equal(brief.vetting.humanRailOnly, true, `${batch.slug} claims API verification with no connector`);
      assert.equal(brief.vetting.apiVerified, false, `${batch.slug} overclaims`);
    }
  }
});

test('a brief publishes the bar and the company walkthrough but never the applicant or weights', () => {
  const brief = batchBrief(software);
  assert.equal(brief.slug, 'ai-ml');
  assert.ok(brief.requirements.every(r => r.label));
  assert.ok(brief.companyWorkflow.every(s => s.step && s.title && s.detail));
  assert.equal(brief.admissionVersion, BATCH_ADMISSION_VERSION);
  const serialized = JSON.stringify(brief);
  assert.doesNotMatch(serialized, /weight/i);
  assert.doesNotMatch(serialized, /scopes/i);
});

test('tier ordering treats trial as the strongest and claimed as the weakest', () => {
  assert.equal(tierAtLeast('trial', 'artifact'), true);
  assert.equal(tierAtLeast('claimed', 'artifact'), false);
  assert.equal(tierAtLeast('artifact', 'artifact'), true);
  assert.equal(tierAtLeast('nonsense', 'artifact'), false);
});

test('an empty profile gets a constructive gap list, never a bare rejection', () => {
  const result = evaluateBatchAdmission(software, {});
  assert.equal(result.meetsThreshold, false);
  assert.equal(result.recommendation, 'not_yet');
  assert.equal(result.gaps.length, result.total);
  for (const gap of result.gaps) assert.ok(gap.gap, `gap ${gap.key} has no actionable text`);
  assert.match(result.decisionMakerNote, /operator decides/i);
});

test('a fully evidenced applicant is recommended for admission but never auto-admitted', () => {
  const result = evaluateBatchAdmission(software, {
    skillClaims: [
      { skill: 'Python', verification_tier: 'artifact', evidence_pointer: 'https://github.com/x/a', evidence_meta: { ownership_verified: true, history_span_days: 210 } },
      { skill: 'API design', verification_tier: 'trial', evidence_pointer: 'https://github.com/x/b', evidence_meta: { ownership_verified: true, history_span_days: 150 } },
    ],
    defenses: [{ kind: 'walkthrough' }],
    availabilityHoursPerWeek: 10,
  });
  assert.equal(result.meetsThreshold, true);
  assert.equal(result.recommendation, 'admit_recommended');
  // "Recommended" is a draft: the status is not an acceptance, and a human still signs it.
  assert.notEqual(result.recommendation, 'accepted');
  assert.match(result.decisionMakerNote, /rationale/i);
});

test('a claimed-only skill never clears an artifact-tier requirement', () => {
  const result = evaluateBatchAdmission(software, {
    skillClaims: [
      { skill: 'Python', verification_tier: 'claimed', evidence_pointer: null },
      { skill: 'Go', verification_tier: 'claimed', evidence_pointer: null },
    ],
    defenses: [{ kind: 'walkthrough' }],
    availabilityHoursPerWeek: 10,
  });
  const skills = result.checks.find(c => c.key === 'skills');
  assert.equal(skills.met, false, 'self-claimed skills must not clear an evidence bar');
});

// No pointer, no claim — a green check with nothing to cite must be flagged for review
// rather than shown to an operator as verified.
test('a requirement met without any evidence pointer is flagged unverified', () => {
  const result = evaluateBatchAdmission(software, {
    skillClaims: [
      { skill: 'Python', verification_tier: 'artifact', evidence_pointer: 'https://github.com/x/a', evidence_meta: { ownership_verified: true, history_span_days: 210 } },
      { skill: 'API design', verification_tier: 'artifact', evidence_pointer: 'https://github.com/x/b', evidence_meta: { ownership_verified: true, history_span_days: 100 } },
    ],
    defenses: [{}], // recorded, but nothing identifying it
    availabilityHoursPerWeek: 10,
  });
  const defense = result.checks.find(c => c.key === 'defense');
  assert.equal(defense.met, true);
  assert.equal(defense.unverified, true);
  assert.equal(result.recommendation, 'review', 'unverified evidence must route to human review');
});

test('evidence pointers ride along with every satisfied requirement', () => {
  const result = evaluateBatchAdmission(software, {
    skillClaims: [
      { skill: 'Python', verification_tier: 'artifact', evidence_pointer: 'https://github.com/x/a', evidence_meta: { ownership_verified: true, history_span_days: 210 } },
      { skill: 'API design', verification_tier: 'artifact', evidence_pointer: 'https://github.com/x/b', evidence_meta: { ownership_verified: true, history_span_days: 120 } },
    ],
    defenses: [{ kind: 'walkthrough' }],
    availabilityHoursPerWeek: 10,
  });
  const skills = result.checks.find(c => c.key === 'skills');
  assert.deepEqual(skills.evidence, ['https://github.com/x/a', 'https://github.com/x/b']);
});

// Fairness invariance: the admission bar reads evidence, never who the student is.
test('school prestige and name do not move an admission verdict', () => {
  const evidence = {
    skillClaims: [
      { skill: 'Python', verification_tier: 'artifact', evidence_pointer: 'https://github.com/x/a', evidence_meta: { ownership_verified: true, history_span_days: 210 } },
      { skill: 'API design', verification_tier: 'artifact', evidence_pointer: 'https://github.com/x/b', evidence_meta: { ownership_verified: true, history_span_days: 120 } },
    ],
    defenses: [{ kind: 'walkthrough' }],
    availabilityHoursPerWeek: 10,
  };
  const a = evaluateBatchAdmission(software, { ...evidence, school: 'Harvard', displayName: 'Alexander Whitmore III' });
  const b = evaluateBatchAdmission(software, { ...evidence, school: 'Community college', displayName: 'Jamal Okonkwo' });
  assert.deepEqual(a.checks, b.checks);
  assert.equal(a.recommendation, b.recommendation);
});

test('no batch emits a single overall person score', () => {
  const result = evaluateBatchAdmission(software, {});
  assert.equal(result.score, undefined);
  assert.equal(result.overallScore, undefined);
  assert.equal(result.rank, undefined);
});

// Branches are SECTOR level, not skill level: a fund recruits for private equity, not for
// "financial modelling".
//
// This used to require exactly five per vertical, and the reason given was that it kept the
// board an even grid. The board is accordions now: each vertical collapses independently and its
// row wraps, so an uneven group costs nothing. The floor is the part that was always load
// bearing, since a vertical with two batches is not a vertical.
test('every vertical carries at least five sector-level batches', async () => {
  const { batchesByVertical } = await import('../../api/batches.js');
  for (const group of batchesByVertical()) {
    assert.ok(group.batches.length >= 5, `${group.vertical} has ${group.batches.length}, expected at least 5`);
  }
});

test('every batch publishes the questions its field actually asks', async () => {
  const { BATCH_CATALOG: cat, questionsFor } = await import('../../api/batches.js');
  for (const batch of cat) {
    const qs = questionsFor(batch.slug);
    assert.ok(qs.length >= 2, `${batch.slug} has ${qs.length} questions`);
    for (const q of qs) assert.ok(['technical', 'judgement'].includes(q.kind), `${batch.slug}: bad kind ${q.kind}`);
  }
});
