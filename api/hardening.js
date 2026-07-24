// Scoring Credibility Hardening — the Pilot Three + model-architecture helpers
// (docs/SCORING_CREDIBILITY_HARDENING.md). One implementation, used by match/portal/admin.
//
// Philosophy (PUBLISHED; the weights themselves are internal and never leave the API):
// evidence is ranked by how hard it is to fake — a completed paid trial outranks a company's
// behavior (rehire/refer), which outranks months of commit history, which outranks a professor
// co-sign, which outranks a one-shot artifact, which outranks self-report. Scores are
// decision-support for a human decision, never the decision; every score is contestable (M8)
// and every display carries its evidence tier and an uncertainty band (P1) — no bare numbers.

export const HARDENING_VERSION = 'hardening-1.0.0';

// ---------------------------------------------------------------------------
// P1 — confidence/verification tiers. Band TIGHTENS as evidence hardens.
// ---------------------------------------------------------------------------

export const EVIDENCE_TIERS = ['self_reported', 'bronze', 'silver', 'gold'];

// Half-width of the uncertainty band on a 0–100 scale, per tier. self_reported is wide on
// purpose: with no verified evidence the number is a hypothesis, and the band says so.
const BAND_HALF_WIDTH = { self_reported: 18, bronze: 12, silver: 8, gold: 5 };

const TIER_FROM_CLAIM = { trial: 'gold', referral: 'silver', artifact: 'bronze' };

// Best evidence tier across a student's skill claims (claimed-only rows stay self_reported).
export function evidenceTierFromClaims(claims) {
  let best = 'self_reported';
  for (const c of claims || []) {
    const tier = TIER_FROM_CLAIM[c && c.verification_tier];
    if (tier && EVIDENCE_TIERS.indexOf(tier) > EVIDENCE_TIERS.indexOf(best)) best = tier;
  }
  return best;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Every displayed score = {value, evidenceTier, band}. `uncertainty` (from a Bayesian
// posterior, M2) overrides the tier default when present — evidence accumulation, not tier
// promotion alone, is what narrows a mature band.
export function presentScore(value, evidenceTier, options = {}) {
  const tier = EVIDENCE_TIERS.includes(evidenceTier) ? evidenceTier : 'self_reported';
  const v = clamp(Math.round(Number(value) || 0), 0, 100);
  const half = Number.isFinite(options.uncertainty)
    ? clamp(options.uncertainty, 2, BAND_HALF_WIDTH.self_reported)
    : BAND_HALF_WIDTH[tier];
  const low = clamp(Math.round(v - half), 0, 100);
  const high = clamp(Math.round(v + half), 0, 100);
  const label = v >= 70 ? 'strong signal' : v >= 40 ? 'promising' : 'early signal';
  return { value: v, evidenceTier: tier, band: { low, high, label } };
}

// ---------------------------------------------------------------------------
// P2 — dual-rater anchored rubrics + inter-rater reliability.
// ---------------------------------------------------------------------------

// Anchored exemplars at 4 / 6 / 9 per skill (seed set for the pilot verticals; a professor
// co-signing a rubric once lends that credibility to every student scored against it).
export const RUBRIC_ANCHORS = {
  'Financial modeling': {
    4: 'Mechanically correct 3-statement model; hardcoded drivers; no sensitivity analysis.',
    6: 'Linked DCF with defensible WACC and terminal value; basic scenario toggle; assumptions documented.',
    9: 'Audit-ready model: driver tree, sensitivity tables, footnoted sources, handles edge cases (negative FCF, mid-year convention) without breaking.',
  },
  'JavaScript': {
    4: 'Working single-file script; no tests; unclear naming; copy-paste duplication.',
    6: 'Modular code with a test for the core path, README, and consistent error handling.',
    9: 'Sustained repo: layered design, meaningful test suite, CI green, commit history shows iteration and review responses.',
  },
  default: {
    4: 'Complete but shallow: meets the letter of the brief, breaks on the first edge case.',
    6: 'Solid: correct on the main path, documented, one deliberate trade-off explained.',
    9: 'Exceptional: anticipates failure modes, evidence of iteration, a reviewer learns something from it.',
  },
};

export function rubricAnchorsFor(skill) {
  return RUBRIC_ANCHORS[skill] || RUBRIC_ANCHORS.default;
}

const cleanRater = r => String(r || '').trim().slice(0, 60);

// Merge one rater's independent score into a project's rubric_scores jsonb.
// Shape: { [skill]: { raters: { [rater]: {score, notes, at} }, adjudicated? } }
// Raters never see each other's numbers in the UI until both are in (enforced client-side);
// here we enforce the structural rules: 0–10 integers, max two raters before adjudication.
export function recordRubricScore(existing, { rater, skill, score, notes } = {}) {
  const who = cleanRater(rater);
  const what = String(skill || '').trim();
  const s = Number(score);
  if (!who) throw new Error('Rater name is required.');
  if (!what) throw new Error('Skill is required.');
  if (!Number.isInteger(s) || s < 0 || s > 10) throw new Error('Score must be an integer from 0 to 10.');
  const book = existing && typeof existing === 'object' ? { ...existing } : {};
  const entry = book[what] ? { ...book[what], raters: { ...(book[what].raters || {}) } } : { raters: {} };
  const existingRaters = Object.keys(entry.raters);
  if (!existingRaters.includes(who) && existingRaters.length >= 2) {
    throw new Error('Two raters already scored this skill — adjudicate instead of adding a third.');
  }
  entry.raters[who] = { score: s, notes: String(notes || '').trim().slice(0, 600), at: new Date().toISOString() };
  // Auto-adjudicate agreement: two independent raters within 1 point -> mean is the label.
  const values = Object.values(entry.raters).map(r => r.score);
  if (values.length === 2 && Math.abs(values[0] - values[1]) <= 1 && !entry.adjudicated) {
    entry.adjudicated = { score: Math.round(((values[0] + values[1]) / 2) * 10) / 10, method: 'auto-mean', at: new Date().toISOString() };
  }
  book[what] = entry;
  return book;
}

export function adjudicationStatus(entry) {
  const scores = Object.values((entry && entry.raters) || {}).map(r => r.score);
  const delta = scores.length === 2 ? Math.abs(scores[0] - scores[1]) : null;
  return {
    raters: scores.length,
    delta,
    needsAdjudication: scores.length === 2 && delta > 1 && !(entry && entry.adjudicated),
    adjudicated: (entry && entry.adjudicated) || null,
  };
}

// A human adjudicator resolves a disagreement; the adjudicated score IS the training label.
export function adjudicateRubric(existing, { skill, score, adjudicator, note } = {}) {
  const what = String(skill || '').trim();
  const s = Number(score);
  const who = cleanRater(adjudicator);
  if (!what || !existing || !existing[what]) throw new Error('No rubric entry to adjudicate for that skill.');
  if (!who) throw new Error('Adjudicator name is required.');
  if (!Number.isFinite(s) || s < 0 || s > 10) throw new Error('Adjudicated score must be 0 to 10.');
  if (Object.keys(existing[what].raters || {}).length < 2) throw new Error('Adjudication needs two independent rater scores first.');
  const book = { ...existing };
  book[what] = { ...book[what], adjudicated: { score: Math.round(s * 10) / 10, method: 'human', by: who, note: String(note || '').trim().slice(0, 400), at: new Date().toISOString() } };
  return book;
}

// Every adjudicated rubric entry -> one labeled training row for the eval harness (the AI
// scorer's training target is the ADJUDICATED score, never a single rater's).
export function labeledRows(projects) {
  const rows = [];
  for (const p of projects || []) {
    const book = p && p.rubric_scores;
    if (!book || typeof book !== 'object') continue;
    for (const [skill, entry] of Object.entries(book)) {
      if (!entry || !entry.adjudicated) continue;
      rows.push({
        project_id: p.id,
        skill,
        label: entry.adjudicated.score,
        method: entry.adjudicated.method,
        rater_scores: Object.values(entry.raters || {}).map(r => r.score),
        complexity: p.complexity_rating ?? null,
        ambiguity: p.ambiguity_rating ?? null,
      });
    }
  }
  return rows;
}

// Inter-rater reliability over rater pairs. Cohen's kappa on three ordinal bands
// (0–3 / 4–6 / 7–10) plus the plain agreement rates operators actually read.
// IRR is the gate for automating the AI scorer: low kappa means the rubric anchors are
// ambiguous and NO model should be trained on those labels yet.
export function interRaterReliability(pairs) {
  const usable = (pairs || []).filter(p => Array.isArray(p) && p.length === 2 && p.every(v => Number.isFinite(v)));
  if (!usable.length) return { n: 0, exactAgreement: null, within1: null, kappa: null };
  const bandOf = v => (v <= 3 ? 0 : v <= 6 ? 1 : 2);
  let exact = 0, close = 0;
  const K = 3;
  const confusion = Array.from({ length: K }, () => Array(K).fill(0));
  for (const [a, b] of usable) {
    if (a === b) exact += 1;
    if (Math.abs(a - b) <= 1) close += 1;
    confusion[bandOf(a)][bandOf(b)] += 1;
  }
  const n = usable.length;
  let po = 0, pe = 0;
  for (let i = 0; i < K; i += 1) {
    po += confusion[i][i] / n;
    const rowSum = confusion[i].reduce((s, v) => s + v, 0);
    const colSum = confusion.reduce((s, row) => s + row[i], 0);
    pe += (rowSum / n) * (colSum / n);
  }
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { n, exactAgreement: exact / n, within1: close / n, kappa: Math.round(kappa * 1000) / 1000 };
}

// ---------------------------------------------------------------------------
// P3 — ownership defense + commit forensics routing.
// ---------------------------------------------------------------------------

export const DEFENSE_QUESTIONS = [
  'Walk me through why you structured it this way.',
  'What would you change if you rebuilt it tomorrow?',
  'Where did it break while you were building it, and how did you find out?',
];

// Commit-timeline anomalies (api/github.js oneShot/fork/needsReview flags) route to HUMAN
// review — an anomaly is NEVER auto-scored, in either direction.
export function forensicsAnomaly(signals = {}) {
  return signals.oneShot === true || signals.fork === true || signals.needsReview === true
    || (Array.isArray(signals.flags) && signals.flags.length > 0);
}

// Validate/normalize a recorded defense interview. The interview itself is scored
// (communication, depth) — those become evidence rows too.
export function normalizeDefense(input = {}) {
  const url = String(input.url || '').trim();
  if (url && !/^https:\/\//.test(url)) throw new Error('Defense recording link must be an https URL.');
  const scoreOf = (v, name) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 10) throw new Error(`${name} score must be an integer from 0 to 10.`);
    return n;
  };
  const verdict = String(input.verdict || '').trim();
  if (!['verified', 'inconclusive', 'flagged'].includes(verdict)) throw new Error('Verdict must be verified, inconclusive, or flagged.');
  return {
    url,
    questions: DEFENSE_QUESTIONS,
    communication: scoreOf(input.communication, 'Communication'),
    depth: scoreOf(input.depth, 'Depth'),
    verdict,
    notes: String(input.notes || '').trim().slice(0, 800),
    reviewed_by: cleanRater(input.reviewedBy) || 'operator',
    at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// M1 — source-weighted composite (fakeability multipliers). Weights internal.
// ---------------------------------------------------------------------------

const SOURCE_WEIGHT = {
  trial_outcome: 1.0,        // paid trial, verified delivery — hardest to fake
  company_behavior: 0.85,    // rehired / extended / referred — revealed preference
  longitudinal_history: 0.7, // months of commit/delivery history
  professor_cosign: 0.6,     // staked institutional credibility
  rubric_artifact: 0.5,      // dual-rater adjudicated artifact
  one_shot_artifact: 0.3,    // single uploaded artifact, no history
  self_report: 0.1,          // asserted, unverified
};

export function compositeScore(evidenceItems) {
  let weighted = 0, total = 0, dominant = null;
  for (const item of evidenceItems || []) {
    const w = SOURCE_WEIGHT[item && item.source];
    if (w === undefined) throw new Error(`Unknown evidence source: ${item && item.source}`);
    const v = clamp(Number(item.value) || 0, 0, 100);
    weighted += v * w;
    total += w;
    if (!dominant || w > SOURCE_WEIGHT[dominant]) dominant = item.source;
  }
  if (!total) return null;
  return { value: Math.round(weighted / total), dominantSource: dominant, sources: (evidenceItems || []).length };
}

// ---------------------------------------------------------------------------
// M2 — Bayesian updating, not averaging.
// ---------------------------------------------------------------------------

// Cold-start prior comes from the P1 evidence tier — not zero, not fake parity.
const PRIOR_MEAN = { gold: 65, silver: 58, bronze: 52, self_reported: 45 };
const PRIOR_STRENGTH = 4; // pseudo-observations; early real outcomes move the score a lot

export function coldStartPrior(evidenceTier) {
  return { mean: PRIOR_MEAN[evidenceTier] ?? PRIOR_MEAN.self_reported, strength: PRIOR_STRENGTH };
}

// Each outcome updates the prior; the posterior uncertainty (which drives the P1 band)
// SHRINKS as weighted evidence accumulates. observations: [{value 0-100, weight 0-1}].
export function bayesianUpdate(prior, observations) {
  const p = prior && Number.isFinite(prior.mean) ? prior : coldStartPrior('self_reported');
  let evidenceWeight = 0, evidenceSum = 0;
  for (const o of observations || []) {
    const w = clamp(Number(o.weight ?? 1), 0, 1);
    evidenceWeight += w;
    evidenceSum += clamp(Number(o.value) || 0, 0, 100) * w;
  }
  const strength = p.strength + evidenceWeight;
  const mean = (p.mean * p.strength + evidenceSum) / strength;
  const uncertainty = BAND_HALF_WIDTH.self_reported / Math.sqrt(strength / PRIOR_STRENGTH);
  return { mean: Math.round(mean * 10) / 10, uncertainty: Math.round(uncertainty * 10) / 10, strength: Math.round(strength * 100) / 100 };
}

// ---------------------------------------------------------------------------
// M4 — per-rater normalization (diagnostic only, never load-bearing).
// ---------------------------------------------------------------------------

export function perRaterNormalization(scoresByRater) {
  const out = { diagnostic: true, raters: {} };
  for (const [rater, scores] of Object.entries(scoresByRater || {})) {
    const xs = (scores || []).map(Number).filter(Number.isFinite);
    if (!xs.length) continue;
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length) || 1;
    out.raters[rater] = { mean: Math.round(mean * 100) / 100, sd: Math.round(sd * 100) / 100, n: xs.length, z: xs.map(v => Math.round(((v - mean) / sd) * 100) / 100) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// M5 — difficulty-adjusted outcomes (strength of schedule).
// ---------------------------------------------------------------------------

// complexity/ambiguity are 1–5 tagged at scoping; 3 is baseline. ±10% per point of average
// difficulty above/below baseline: a 7 on a hard ambiguous project beats a 9 on a trivial one.
export function difficultyAdjust(score, complexity, ambiguity, { scale = 10 } = {}) {
  const c = clamp(Number(complexity) || 3, 1, 5);
  const a = clamp(Number(ambiguity) || 3, 1, 5);
  const factor = 1 + 0.1 * ((c + a) / 2 - 3);
  return Math.round(clamp(Number(score) * factor, 0, scale) * 10) / 10;
}

// ---------------------------------------------------------------------------
// M6 — contextual percentiles, never absolute public rankings.
// ---------------------------------------------------------------------------

// Returns null under a minimum cohort — a percentile over 3 people is noise dressed up as
// precision. Output is a statement scoped to vertical+dimension, never a global rank.
export function contextualPercentile(value, cohortValues, { minCohort = 5 } = {}) {
  const cohort = (cohortValues || []).map(Number).filter(Number.isFinite);
  if (cohort.length < minCohort) return null;
  const below = cohort.filter(v => v < value).length;
  const pct = Math.round((below / cohort.length) * 100);
  return { percentile: pct, topPercent: Math.max(1, 100 - pct), cohortSize: cohort.length };
}

export function percentileStatement(result, { vertical, dimension } = {}) {
  if (!result) return '';
  return `Top ${result.topPercent}% of ${vertical || 'Covenda'} students on ${dimension || 'this'} evidence (${result.cohortSize} in cohort)`;
}

// ---------------------------------------------------------------------------
// M8 — contest / appeal (contestability; NYC LL144 / CO / EU AI Act posture).
// ---------------------------------------------------------------------------

export function normalizeAppeal(input = {}) {
  const subject = String(input.subject || '').trim().slice(0, 160);
  const evidence = String(input.evidence || '').trim();
  if (!subject) throw new Error('Tell us which score you are contesting.');
  if (evidence.length < 20) throw new Error('An appeal needs new evidence — describe it in at least a sentence.');
  return { subject, evidence: evidence.slice(0, 2000), status: 'open' };
}

// ---------------------------------------------------------------------------
// G1 — score the scorer (GATED: documented threshold, refuses to run early).
// ---------------------------------------------------------------------------

export const SCORER_REVIEW_MIN_OUTCOMES = 50;

// Quarterly, once >= 50 outcomes exist, component predictive power is measured and weights
// re-derived from evidence. Until then this returns the gate status and nothing else —
// reweighting on a handful of outcomes would just be overfitting with extra steps.
export function scorerGate(outcomeCount) {
  const have = Math.max(0, Number(outcomeCount) || 0);
  return { ready: have >= SCORER_REVIEW_MIN_OUTCOMES, have, needed: SCORER_REVIEW_MIN_OUTCOMES, cadence: 'quarterly' };
}
