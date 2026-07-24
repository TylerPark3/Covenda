import test from 'node:test';
import assert from 'node:assert/strict';

import {
  presentScore, evidenceTierFromClaims,
  recordRubricScore, adjudicateRubric, adjudicationStatus, interRaterReliability, labeledRows, rubricAnchorsFor,
  normalizeDefense, forensicsAnomaly, DEFENSE_QUESTIONS,
  compositeScore, coldStartPrior, bayesianUpdate, perRaterNormalization,
  difficultyAdjust, contextualPercentile, percentileStatement,
  normalizeAppeal, scorerGate, SCORER_REVIEW_MIN_OUTCOMES,
} from '../../api/hardening.js';
import { matchOpportunity } from '../../api/match.js';

// ---- P1: tiers + bands, never bare numbers ------------------------------------------------

test('P1: every presented score carries value + evidenceTier + band', () => {
  const p = presentScore(72, 'silver');
  assert.deepEqual(Object.keys(p).sort(), ['band', 'evidenceTier', 'value']);
  assert.ok(p.band.low < p.value && p.band.high > p.value);
});

test('P1: the band TIGHTENS as evidence hardens — gold narrowest, self-reported widest', () => {
  const widths = ['self_reported', 'bronze', 'silver', 'gold']
    .map(t => { const p = presentScore(50, t); return p.band.high - p.band.low; });
  for (let i = 1; i < widths.length; i += 1) assert.ok(widths[i] < widths[i - 1], `tier ${i} should be tighter`);
});

test('P1: posterior uncertainty overrides the tier default band width', () => {
  const wide = presentScore(60, 'gold');
  const wider = presentScore(60, 'gold', { uncertainty: 15 });
  assert.ok((wider.band.high - wider.band.low) > (wide.band.high - wide.band.low));
});

test('P1: evidence tier derives from the hardest-to-fake claim', () => {
  assert.equal(evidenceTierFromClaims([{ verification_tier: 'artifact' }, { verification_tier: 'trial' }]), 'gold');
  assert.equal(evidenceTierFromClaims([{ verification_tier: 'referral' }]), 'silver');
  assert.equal(evidenceTierFromClaims([{ verification_tier: 'claimed' }]), 'self_reported');
  assert.equal(evidenceTierFromClaims([]), 'self_reported');
});

test('P1: match shortlist entries ship banded presentations, not bare numbers', () => {
  const opportunity = { id: 'o1', desired_skills: ['Python'], hours_per_week: 10, referral_requirement: 'none' };
  const candidate = { id: 's1', name: 'A', availability_hours: 15, claims: [{ skill: 'Python', skill_canonical: 'Python', verification_tier: 'trial', evidence_pointer: 'https://x/repo' }], completed_projects: 1 };
  const out = matchOpportunity(opportunity, [candidate]);
  assert.equal(out.refused, false);
  const entry = out.shortlist[0];
  assert.ok(entry.presentation && entry.presentation.band, 'presentation with band required');
  assert.equal(entry.presentation.evidenceTier, 'gold');
});

// ---- P2: dual-rater rubrics + IRR ----------------------------------------------------------

test('P2: two raters within 1 point auto-adjudicate to the mean', () => {
  let book = recordRubricScore({}, { rater: 'Ana', skill: 'JavaScript', score: 7 });
  book = recordRubricScore(book, { rater: 'Ben', skill: 'JavaScript', score: 8 });
  assert.equal(book['JavaScript'].adjudicated.score, 7.5);
  assert.equal(book['JavaScript'].adjudicated.method, 'auto-mean');
});

test('P2: disagreement >1 requires a human adjudication; a third rater is rejected', () => {
  let book = recordRubricScore({}, { rater: 'Ana', skill: 'SQL', score: 4 });
  book = recordRubricScore(book, { rater: 'Ben', skill: 'SQL', score: 8 });
  assert.equal(adjudicationStatus(book['SQL']).needsAdjudication, true);
  assert.throws(() => recordRubricScore(book, { rater: 'Cam', skill: 'SQL', score: 6 }), /adjudicate/);
  book = adjudicateRubric(book, { skill: 'SQL', score: 6.5, adjudicator: 'Lead', note: 'edge-case handling was the gap' });
  assert.equal(book['SQL'].adjudicated.method, 'human');
  assert.equal(adjudicationStatus(book['SQL']).needsAdjudication, false);
});

test('P2: adjudicated entries become labeled training rows (the AI target is the label)', () => {
  let book = recordRubricScore({}, { rater: 'Ana', skill: 'Python', score: 6 });
  book = recordRubricScore(book, { rater: 'Ben', skill: 'Python', score: 6 });
  const rows = labeledRows([{ id: 'p1', rubric_scores: book, complexity_rating: 4, ambiguity_rating: 2 }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 6);
  assert.deepEqual(rows[0].rater_scores.sort(), [6, 6]);
  assert.equal(rows[0].complexity, 4);
});

test('P2: rubric validation — integer 0-10, named rater, anchors exist for seeded skills', () => {
  assert.throws(() => recordRubricScore({}, { rater: '', skill: 'X', score: 5 }), /Rater/);
  assert.throws(() => recordRubricScore({}, { rater: 'A', skill: 'X', score: 11 }), /0 to 10/);
  assert.throws(() => recordRubricScore({}, { rater: 'A', skill: 'X', score: 6.5 }), /integer/);
  assert.ok(rubricAnchorsFor('Financial modeling')[9].includes('Audit-ready'));
  assert.ok(rubricAnchorsFor('Underwater basket weaving')[6]); // default anchors always exist
});

test('P2: IRR — perfect agreement gives kappa 1, systematic disagreement gives low kappa', () => {
  const perfect = interRaterReliability([[8, 8], [3, 3], [5, 5], [9, 9]]);
  assert.equal(perfect.kappa, 1);
  assert.equal(perfect.exactAgreement, 1);
  const noisy = interRaterReliability([[8, 2], [3, 9], [5, 9], [2, 7]]);
  assert.ok(noisy.kappa < 0.5, `kappa ${noisy.kappa} should be low`);
  assert.deepEqual(interRaterReliability([]), { n: 0, exactAgreement: null, within1: null, kappa: null });
});

// ---- P3: ownership defense ------------------------------------------------------------------

test('P3: forensics anomalies (one-shot, fork, flags) always route to human review', () => {
  assert.equal(forensicsAnomaly({ oneShot: true }), true);
  assert.equal(forensicsAnomaly({ fork: true }), true);
  assert.equal(forensicsAnomaly({ flags: ['history rewritten'] }), true);
  assert.equal(forensicsAnomaly({}), false);
});

test('P3: defense record validates scores/verdict and carries the canonical questions', () => {
  const d = normalizeDefense({ url: 'https://loom.com/x', communication: 8, depth: 7, verdict: 'verified', notes: 'instant answers' });
  assert.equal(d.questions, DEFENSE_QUESTIONS);
  assert.equal(d.verdict, 'verified');
  assert.throws(() => normalizeDefense({ url: 'http://insecure', communication: 8, depth: 7, verdict: 'verified' }), /https/);
  assert.throws(() => normalizeDefense({ communication: 12, depth: 7, verdict: 'verified' }), /0 to 10/);
  assert.throws(() => normalizeDefense({ communication: 8, depth: 7, verdict: 'maybe' }), /Verdict/);
});

// ---- M1/M2/M4/M5/M6 --------------------------------------------------------------------------

test('M1: composite weights by fakeability — a trial outcome dominates self-report', () => {
  const mixed = compositeScore([{ source: 'trial_outcome', value: 80 }, { source: 'self_report', value: 20 }]);
  assert.ok(mixed.value > 70, `trial should dominate, got ${mixed.value}`);
  assert.equal(mixed.dominantSource, 'trial_outcome');
  assert.throws(() => compositeScore([{ source: 'astrology', value: 90 }]), /Unknown evidence source/);
  assert.equal(compositeScore([]), null);
});

test('M2: Bayesian updating — early outcomes move the score a lot, mature scores are stable', () => {
  const prior = coldStartPrior('bronze');
  const afterOne = bayesianUpdate(prior, [{ value: 90, weight: 1 }]);
  const manyObs = Array.from({ length: 20 }, () => ({ value: 70, weight: 1 }));
  const mature = bayesianUpdate(prior, manyObs);
  const matureShift = bayesianUpdate({ mean: mature.mean, strength: mature.strength }, [{ value: 90, weight: 1 }]);
  assert.ok(Math.abs(afterOne.mean - prior.mean) > Math.abs(matureShift.mean - mature.mean), 'early moves more');
  assert.ok(mature.uncertainty < afterOne.uncertainty, 'uncertainty shrinks with evidence');
});

test('M2: cold-start prior comes from the evidence tier — not zero, not parity', () => {
  assert.ok(coldStartPrior('gold').mean > coldStartPrior('bronze').mean);
  assert.ok(coldStartPrior('bronze').mean > coldStartPrior('self_reported').mean);
  assert.ok(coldStartPrior('self_reported').mean > 0);
});

test('M4: per-rater normalization is diagnostic-only and z-scores each rater separately', () => {
  const out = perRaterNormalization({ harsh: [3, 4, 3, 4], generous: [8, 9, 8, 9] });
  assert.equal(out.diagnostic, true);
  assert.ok(out.raters.harsh.mean < out.raters.generous.mean);
  assert.deepEqual(out.raters.harsh.z, out.raters.generous.z); // same shape once normalized
});

test('M5: difficulty adjustment — a 7 on a hard ambiguous project beats a 9 on a trivial one', () => {
  const hard7 = difficultyAdjust(7, 5, 5);
  const trivial9 = difficultyAdjust(9, 1, 1);
  assert.ok(hard7 > trivial9, `${hard7} should beat ${trivial9}`);
  assert.equal(difficultyAdjust(6, 3, 3), 6); // baseline difficulty is neutral
});

test('M6: percentiles are contextual and refuse tiny cohorts', () => {
  assert.equal(contextualPercentile(80, [10, 20, 30], { minCohort: 5 }), null);
  const r = contextualPercentile(80, [10, 20, 30, 40, 50, 60, 70, 90]);
  assert.ok(r.topPercent <= 15);
  const s = percentileStatement(r, { vertical: 'finance', dimension: 'Financial modeling' });
  assert.ok(s.includes('finance') && s.includes('cohort'));
  assert.equal(percentileStatement(null), '');
});

// ---- M8 + G1 ---------------------------------------------------------------------------------

test('M8: an appeal requires a subject and real evidence', () => {
  const a = normalizeAppeal({ subject: 'Fit score on Churn dashboard', evidence: 'I shipped a follow-up repo with tests: https://github.com/x/y' });
  assert.equal(a.status, 'open');
  assert.throws(() => normalizeAppeal({ subject: '', evidence: 'long enough evidence here' }), /which score/);
  assert.throws(() => normalizeAppeal({ subject: 'x', evidence: 'too short' }), /evidence/);
});

test('G1: score-the-scorer stays GATED below the documented outcome threshold', () => {
  assert.equal(scorerGate(10).ready, false);
  assert.equal(scorerGate(SCORER_REVIEW_MIN_OUTCOMES).ready, true);
  assert.equal(scorerGate(10).needed, 50);
});

// ---- Hardening migration structure ------------------------------------------------------------

test('hardening migration: ownership_defense + audited score_appeals, service-role only', async () => {
  const fs = await import('node:fs');
  const sql = fs.readFileSync('supabase/migrations/20260726360000_hardening.sql', 'utf8');
  assert.match(sql, /ownership_defense jsonb/);
  assert.match(sql, /create table if not exists public\.score_appeals/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.score_appeals/);
  assert.match(sql, /notify pgrst/);
});
