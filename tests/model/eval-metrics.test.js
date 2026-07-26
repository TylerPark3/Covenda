import test from 'node:test';
import assert from 'node:assert/strict';

import {
  precisionAtK, recallAtK, reciprocalRank, meanReciprocalRank, averagePrecision, meanAveragePrecision,
  ndcgAtK, spearmanRho, kendallTau, judgeIsTrustworthy, JUDGE_TAU_FLOOR,
  brierScore, expectedCalibrationError, paraphraseStability, ablationReport, fourFifthsReport,
  evaluationReport, MIN_TRUSTWORTHY_SAMPLE,
} from '../../api/eval-metrics.js';
import { matchOpportunity, MATCH_WEIGHTS } from '../../api/match.js';

const claim = (skill, tier, evidence = 'https://github.com/x/proof') => ({ skill, verification_tier: tier, evidence_pointer: evidence });

// ---- Ranking metrics: verified against hand-computed values ---------------------------------

test('precision/recall@k compute the textbook values', () => {
  const ranked = ['a', 'b', 'c', 'd'];
  const relevant = ['b', 'd', 'z'];           // 'z' never ranked
  assert.equal(precisionAtK(ranked, relevant, 2), 0.5);   // {a,b} -> 1 of 2
  assert.equal(precisionAtK(ranked, relevant, 4), 0.5);   // {a,b,c,d} -> 2 of 4
  assert.equal(recallAtK(ranked, relevant, 2), round3(1 / 3));  // 1 of 3 relevant found
  assert.equal(recallAtK(ranked, relevant, 4), round3(2 / 3));
});
function round3(n) { return Math.round(n * 10000) / 10000; }

test('MRR rewards putting a relevant candidate first', () => {
  assert.equal(reciprocalRank(['a', 'b', 'c'], ['a']), 1);
  assert.equal(reciprocalRank(['a', 'b', 'c'], ['b']), 0.5);
  assert.equal(reciprocalRank(['a', 'b', 'c'], ['z']), 0); // no hit at all
  assert.equal(meanReciprocalRank([
    { ranked: ['a', 'b'], relevant: ['a'] },   // 1
    { ranked: ['a', 'b'], relevant: ['b'] },   // 0.5
  ]), 0.75);
});

test('MAP averages precision at each relevant hit', () => {
  // hits at ranks 1 and 3 -> (1/1 + 2/3) / 2
  assert.equal(averagePrecision(['a', 'x', 'b'], ['a', 'b']), round3((1 + 2 / 3) / 2));
  assert.equal(meanAveragePrecision([{ ranked: ['a'], relevant: ['a'] }]), 1);
});

test('NDCG@k is 1 for an ideal ordering and drops when the best is demoted', () => {
  const gains = { a: 2, b: 1, c: 0 };
  assert.equal(ndcgAtK(['a', 'b', 'c'], gains, 3), 1);
  assert.ok(ndcgAtK(['c', 'b', 'a'], gains, 3) < 1);
});

// ---- Rank correlation -------------------------------------------------------------------------

test('Spearman and Kendall are +1 for identical order and -1 for reversed', () => {
  assert.equal(spearmanRho([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearmanRho([1, 2, 3, 4], [40, 30, 20, 10]), -1);
  assert.equal(kendallTau([1, 2, 3], [5, 6, 7]), 1);
  assert.equal(kendallTau([1, 2, 3], [7, 6, 5]), -1);
  assert.equal(spearmanRho([1], [1]), null); // too short to correlate
});

test('an LLM judge is only trusted once it agrees with humans (tau floor)', () => {
  const human = [1, 2, 3, 4, 5];
  const goodJudge = judgeIsTrustworthy(human, [1, 2, 3, 5, 4]);
  const badJudge = judgeIsTrustworthy(human, [5, 1, 4, 2, 3]);
  assert.equal(goodJudge.trustworthy, true);
  assert.ok(goodJudge.tau >= JUDGE_TAU_FLOOR);
  assert.equal(badJudge.trustworthy, false, `tau ${badJudge.tau} should fall below the floor`);
});

// ---- Calibration --------------------------------------------------------------------------------

test('Brier score: confident and correct beats always guessing 0.5', () => {
  const outcomes = [1, 1, 0, 0];
  const sharp = brierScore([0.9, 0.9, 0.1, 0.1], outcomes);
  const coinFlip = brierScore([0.5, 0.5, 0.5, 0.5], outcomes);
  assert.ok(sharp < coinFlip);
  assert.equal(coinFlip, 0.25); // the worthless-baseline value
  assert.equal(brierScore([1, 1, 0, 0], outcomes), 0); // perfect
});

test('ECE is ~0 for a well-calibrated scorer and large for an overconfident one', () => {
  // 10 predictions at 0.9 with 9 successes -> confidence matches reality.
  const calibrated = expectedCalibrationError(Array(10).fill(0.9), [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  // Same confidence, but only half actually succeed -> a 0.4 gap.
  const overconfident = expectedCalibrationError(Array(10).fill(0.9), [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
  assert.ok(calibrated < 0.05, `calibrated ECE ${calibrated}`);
  assert.ok(overconfident > 0.3, `overconfident ECE ${overconfident}`);
});

// ---- Robustness ------------------------------------------------------------------------------------

test('paraphrase stability: rewording an opportunity must not reshuffle the shortlist', () => {
  assert.equal(paraphraseStability([['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c']]), 1);
  assert.ok(paraphraseStability([['a', 'b', 'c'], ['c', 'b', 'a']]) === 0);
});

test('paraphrase stability holds on the real matcher for a reworded opportunity', () => {
  const candidates = [
    { id: 'a', availability_hours_week: 12, claims: [claim('Python', 'trial', 'covenda://p/1')], verticals: ['Software & AI'], work_types: ['Research'] },
    { id: 'b', availability_hours_week: 12, claims: [claim('Python', 'artifact')], verticals: ['Software & AI'], work_types: ['Research'] },
    { id: 'c', availability_hours_week: 12, claims: [claim('Python', 'referral', 'covenda://ref/1')], verticals: ['Software & AI'], work_types: ['Research'] },
  ];
  // Same requirement, three different wordings of the skill field.
  const wordings = ['Python', 'python', 'Python '];
  const rankings = wordings.map(s => matchOpportunity(
    { required_skills: s, verticals: ['Software & AI'], work_types: ['Research'], hours_week: 10 },
    candidates,
  ).shortlist.map(x => x.candidate_id));
  assert.equal(paraphraseStability(rankings), 1, `rankings diverged: ${JSON.stringify(rankings)}`);
});

test('ablation exposes components that do not change the ranking', () => {
  // A scoring function that only ever consults `skills` — every other weight is inert.
  const scoreFn = (w) => (w.skills > 0 ? ['a', 'b', 'c'] : ['c', 'b', 'a']);
  const report = ablationReport({ skills: 34, evidence_depth: 26, availability_fit: 12 }, scoreFn);
  assert.deepEqual(report.baseline, ['a', 'b', 'c']);
  assert.ok(report.inertComponents.includes('evidence_depth'));
  assert.ok(report.inertComponents.includes('availability_fit'));
  assert.ok(!report.inertComponents.includes('skills'));
});

test('ablation over the real MATCH_WEIGHTS reports every component', () => {
  const candidates = [
    { id: 'a', availability_hours_week: 20, claims: [claim('Python', 'trial', 'covenda://p/1')], verticals: ['Software & AI'], work_types: ['Research'], vouched: true },
    { id: 'b', availability_hours_week: 5, claims: [claim('Python', 'artifact')], verticals: [], work_types: [] },
  ];
  const opportunity = { required_skills: 'Python', verticals: ['Software & AI'], work_types: ['Research'], hours_week: 4 };
  const report = ablationReport(MATCH_WEIGHTS, (w) =>
    matchOpportunity(opportunity, candidates, { weights: w }).shortlist.map(x => x.candidate_id));
  assert.equal(report.components.length, Object.keys(MATCH_WEIGHTS).length);
  for (const c of report.components) assert.ok('changedTopK' in c && 'topKOverlap' in c);
});

// ---- Fairness ----------------------------------------------------------------------------------------

test('four-fifths rule flags a group selected below 0.8x the best rate', () => {
  const ok = fourFifthsReport({ x: { selected: 10, total: 20 }, y: { selected: 9, total: 20 } });
  assert.equal(ok.compliant, true);
  assert.deepEqual(ok.flagged, []);
  const bad = fourFifthsReport({ x: { selected: 10, total: 20 }, y: { selected: 3, total: 20 } });
  assert.equal(bad.compliant, false);
  assert.deepEqual(bad.flagged, ['y']);
  const yRow = bad.groups.find(g => g.group === 'y');
  assert.ok(yRow.impactRatio < 0.8);
});

// ---- Reporting ------------------------------------------------------------------------------------------

test('the evaluation report labels an underpowered sample instead of overclaiming', () => {
  const cases = [
    { ranked: ['a', 'b', 'c'], relevant: ['a'], gains: { a: 2, b: 1 } },
    { ranked: ['b', 'a', 'c'], relevant: ['b'], gains: { b: 2, a: 1 } },
  ];
  const report = evaluationReport(cases);
  assert.equal(report.sampleSize, 2);
  assert.equal(report.underpowered, true);
  assert.match(report.note, /NOT validation/);
  assert.equal(report.mrr, 1);        // relevant candidate ranked first in both
  assert.equal(report.ndcgAtK, 1);    // ideal ordering in both
  assert.ok(MIN_TRUSTWORTHY_SAMPLE >= 20);
});

test('a well-powered sample is not labelled underpowered', () => {
  const cases = Array.from({ length: MIN_TRUSTWORTHY_SAMPLE }, () => ({ ranked: ['a', 'b'], relevant: ['a'], gains: { a: 2, b: 1 } }));
  const report = evaluationReport(cases);
  assert.equal(report.underpowered, false);
  assert.match(report.note, new RegExp(`${MIN_TRUSTWORTHY_SAMPLE} cases`));
});
