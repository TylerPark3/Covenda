// Compatibility Engine eval harness (Stage 2). Runs the pure matcher against a hand-matched
// GOLDEN SET: each case is (opportunity, candidates, human decision, rationale). Agreement with
// the human matcher is the acceptance metric. APPEND new golden cases as real operator
// decisions (with rationales) accumulate in public.matches — target >= 20.
import test from 'node:test';
import assert from 'node:assert/strict';

import { hardFilters, scoreCandidate, matchOpportunity, precisionAtK, ndcgAtK, MATCH_WEIGHTS, MATCH_VERSION, TIER_WEIGHT } from '../../api/match.js';

const claim = (skill, tier, evidence = 'https://github.com/x/proof') => ({ skill, verification_tier: tier, evidence_pointer: evidence });

// ---- Golden set (seed 6 cases; grow with real operator decisions + rationales) -----------
const GOLDEN = [
  {
    name: 'robotics: trial-proven beats artifact-only',
    opportunity: { required_skills: 'ROS, C++', verticals: ['Software & AI'], work_types: ['Research'], hours_week: 10, referral_requirement: 'preferred' },
    candidates: [
      { id: 'a', availability_hours_week: 12, verticals: ['Software & AI'], work_types: ['Research'], claims: [claim('ROS', 'trial', 'covenda://project/123'), claim('C++', 'artifact')], vouched: true },
      { id: 'b', availability_hours_week: 12, verticals: ['Software & AI'], work_types: ['Research'], claims: [claim('ROS', 'artifact'), claim('C++', 'artifact')] },
    ],
    humanSelected: 'a',
    rationale: 'Both cover the skills; A has a completed trial + a staked vouch — harder to fake.',
  },
  {
    name: 'must-have skill missing knocks out the higher-relevance candidate',
    opportunity: { required_skills: 'Python', verticals: ['Software & AI'], work_types: [] },
    candidates: [
      { id: 'a', verticals: ['Software & AI'], work_types: ['Research'], claims: [claim('Excel', 'trial')] },
      { id: 'b', verticals: [], work_types: [], claims: [claim('Python', 'artifact')] },
    ],
    humanSelected: 'b',
    rationale: 'A has no evidence in the must-have; B proves Python at artifact tier.',
  },
  {
    name: 'claimed-tier skills are excluded from matching by default',
    opportunity: { required_skills: 'SQL', verticals: [], work_types: [] },
    candidates: [
      { id: 'a', claims: [{ skill: 'SQL', verification_tier: 'claimed', evidence_pointer: null }] },
      { id: 'b', claims: [claim('SQL', 'artifact')] },
    ],
    humanSelected: 'b',
    rationale: 'A self-reported SQL with no evidence pointer — excluded; B has artifact evidence.',
  },
  {
    name: 'referral_required filters the unvouched',
    opportunity: { required_skills: 'Research', referral_requirement: 'required', verticals: [], work_types: [] },
    candidates: [
      { id: 'a', claims: [claim('Research', 'artifact')] },
      { id: 'b', claims: [claim('Research', 'referral', 'covenda://vouch/prof-chen')], vouched: true },
    ],
    humanSelected: 'b',
    rationale: 'The opportunity requires a staked referral; only B has one.',
  },
  {
    name: 'availability hard filter',
    opportunity: { required_skills: 'Writing', hours_week: 15, verticals: [], work_types: [] },
    candidates: [
      { id: 'a', availability_hours_week: 5, claims: [claim('Writing', 'trial')] },
      { id: 'b', availability_hours_week: 20, claims: [claim('Writing', 'artifact')] },
    ],
    humanSelected: 'b',
    rationale: 'A cannot cover the hours; B can and has evidence.',
  },
  {
    name: 'depth over breadth at equal coverage',
    opportunity: { required_skills: 'Data analysis', preferred_skills: 'Spreadsheets', verticals: ['Accounting & finance'], work_types: [] },
    candidates: [
      { id: 'a', verticals: ['Accounting & finance'], claims: [claim('Data analysis', 'referral'), claim('Spreadsheets', 'trial', 'covenda://project/9')], vouched: true },
      { id: 'b', verticals: ['Accounting & finance'], claims: [claim('Data analysis', 'artifact'), claim('Spreadsheets', 'artifact')] },
    ],
    humanSelected: 'a',
    rationale: 'Same coverage; A\'s evidence is referral+trial tier — deeper.',
  },
];

test('GOLDEN SET: engine top-1 agrees with the human matcher on every seeded case', () => {
  let agree = 0;
  for (const g of GOLDEN) {
    const out = matchOpportunity(g.opportunity, g.candidates);
    assert.equal(out.refused, false, `${g.name}: engine refused a matchable pool`);
    const top = out.shortlist[0].candidate_id;
    if (top === g.humanSelected) agree++;
    else assert.fail(`${g.name}: engine picked ${top}, human picked ${g.humanSelected} (${g.rationale})`);
  }
  assert.equal(agree, GOLDEN.length); // acceptance metric: full agreement on the curated set
});

test('shortlist is HARD-CAPPED at 3 and never padded below the floor', () => {
  const opp = { required_skills: 'Python', verticals: [], work_types: [] };
  const many = Array.from({ length: 8 }, (_, i) => ({
    id: `s${i}`, claims: [claim('Python', 'trial', `covenda://p/${i}`)], vouched: true,
    verticals: [], work_types: [],
  }));
  const out = matchOpportunity(opp, many);
  assert.equal(out.shortlist.length, 3); // never a ranked list of 40
});

test('REFUSAL PATH: no padding — a weak pool gets an honest refusal with reasons', () => {
  const opp = { required_skills: 'Rust', referral_requirement: 'required', verticals: [], work_types: [] };
  const out = matchOpportunity(opp, [
    { id: 'a', claims: [claim('Python', 'artifact')] },
    { id: 'b', claims: [{ skill: 'Rust', verification_tier: 'claimed', evidence_pointer: null }] },
  ]);
  assert.equal(out.refused, true);
  assert.match(out.message, /not currently well-suited for emerging talent/);
  assert.ok(out.reasons.length >= 1);
});

test('experience_requirement=relevant_project filters ONLY on observable evidence', () => {
  const opp = { experience_requirement: 'relevant_project', verticals: [], work_types: [] };
  const noEvidence = { id: 'a', claims: [], completed_projects: 0 };
  const hasClaim = { id: 'b', claims: [claim('Python', 'artifact')], completed_projects: 0 };
  const hasProject = { id: 'c', claims: [], completed_projects: 1 };
  assert.equal(hardFilters(opp, noEvidence).pass, false);
  assert.ok(hardFilters(opp, noEvidence).failures.some(f => /Experience/.test(f)));
  assert.equal(hardFilters(opp, hasClaim).pass, true);   // evidence-backed skill satisfies it
  assert.equal(hardFilters(opp, hasProject).pass, true); // a completed project satisfies it
  // prior_internship/professional are NOT hard-failed — no reliable signal, excluding is unfair.
  assert.equal(hardFilters({ ...opp, experience_requirement: 'professional' }, noEvidence).pass, true);
});

test('every explanation line with a claim carries its evidence pointer + one honest gap', () => {
  const opp = { required_skills: 'Python, Rust', verticals: [], work_types: [] };
  const cand = { id: 'a', claims: [claim('Python', 'artifact', 'https://github.com/a/repo')] };
  const s = scoreCandidate(opp, cand);
  assert.match(s.explanation, /✓ python — artifact evidence: https:\/\/github\.com\/a\/repo/i);
  assert.match(s.explanation, /△ No evidence yet in rust/i); // exactly one honest gap named
  assert.equal(s.scorer_version, MATCH_VERSION);
});

test('FAIRNESS: protected proxies (school, name) cannot move a match score', () => {
  const opp = { required_skills: 'Python', verticals: ['Software & AI'], work_types: [] };
  const base = { availability_hours_week: 10, verticals: ['Software & AI'], work_types: [], claims: [claim('Python', 'artifact')] };
  const a = scoreCandidate(opp, { ...base, id: 'x', name: 'Emily', school_name: 'Harvard University' });
  const b = scoreCandidate(opp, { ...base, id: 'y', name: 'Jamal', school_name: 'Community College' });
  assert.equal(a.score, b.score);
  assert.deepEqual(a.score_components, b.score_components);
});

test('evidence tiers weight trial > referral > artifact; claimed = 0', () => {
  assert.ok(TIER_WEIGHT.trial > TIER_WEIGHT.referral && TIER_WEIGHT.referral > TIER_WEIGHT.artifact && TIER_WEIGHT.artifact > 0);
  assert.equal(TIER_WEIGHT.claimed, 0);
  const weights = Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(weights, 100); // config weights cap at 100
});

test('ranking metrics: precision@k and NDCG@k behave on known orderings', () => {
  assert.equal(precisionAtK(['a', 'b', 'c'], ['a', 'c'], 2), 0.5);
  assert.equal(precisionAtK(['a', 'b'], [], 2), 0);
  const gains = { a: 2, b: 1, c: 0 };
  assert.equal(Math.round(ndcgAtK(['a', 'b', 'c'], gains, 3) * 100) / 100, 1); // ideal order
  assert.ok(ndcgAtK(['c', 'b', 'a'], gains, 3) < 1); // worst order scores lower
});

test('four-fifths report flags a group selected below 0.8x the top rate', async () => {
  const { fourFifthsReport } = await import('../../api/match.js');
  const out = fourFifthsReport([
    { name: 'group-a', selected: 10, total: 20 }, // 0.50 (top)
    { name: 'group-b', selected: 9, total: 20 },  // 0.45 -> ratio 0.9, ok
    { name: 'group-c', selected: 7, total: 20 },  // 0.35 -> ratio 0.7, flagged
  ]);
  assert.equal(out.anyFlagged, true);
  assert.equal(out.groups.find(g => g.name === 'group-c').flagged, true);
  assert.equal(out.groups.find(g => g.name === 'group-b').flagged, false);
  assert.deepEqual(fourFifthsReport([]).groups, []);
});

test('TAXONOMY: synonyms unify — an opportunity wanting JavaScript matches a "JS" claim', async () => {
  const { canonicalizeSkill } = await import('../../api/skills-taxonomy.js');
  assert.equal(canonicalizeSkill('JS').canonical, 'JavaScript');
  assert.equal(canonicalizeSkill('ms excel').canonical, 'Spreadsheets');
  assert.equal(canonicalizeSkill('dcf modeling').canonical, 'Financial modeling');
  assert.equal(canonicalizeSkill('ros2').canonical, 'Robotics (ROS)');
  // Unmatched skills pass through unchanged — normalization never drops a skill.
  const odd = canonicalizeSkill('Underwater basket weaving');
  assert.equal(odd.matched, false);
  assert.equal(odd.canonical, 'Underwater basket weaving');
  // End-to-end through the matcher:
  const out = matchOpportunity(
    { required_skills: 'JavaScript', verticals: [], work_types: [] },
    [{ id: 'a', claims: [claim('JS', 'artifact', 'https://github.com/a/app')] }],
  );
  assert.equal(out.refused, false);
  assert.equal(out.shortlist[0].candidate_id, 'a');
});
