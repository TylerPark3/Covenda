// Compatibility Engine — Stage 2: deterministic matching + grounded explanation.
// (docs/COMPATIBILITY_ENGINE_MASTER.md — the pilot engine.)
//
// Three layers, in order:
//   1. HARD FILTERS (never averaged away): availability fit, must-have skills at
//      tier >= artifact, referral requirement satisfied.
//   2. Weighted sum over OBSERVABLE inputs only. Weights live in MATCH_WEIGHTS (the config);
//      a per-opportunity override may be passed in, but defaults-only ships. No unmeasurable
//      dimensions (no "agency", no personality) until Stage-4 telemetry grounds them.
//   3. Explanation: EVERY claim line carries the evidence pointer that justifies it —
//      can't cite it, can't claim it. Deterministic (rule-built), so a claim without
//      evidence is impossible by construction.
//
// Output is never a ranked list of 40 — it is up to 3 candidates with evidence-cited
// reasons, or the REFUSAL: "this opportunity is not currently well-suited for emerging
// talent", with reasons. Scores are per-pair, never a global person score. Decision
// support only: the operator/company decides, and every human decision is recorded in
// public.matches with a mandatory rationale (the training labels).
//
// Pure functions, no I/O — the eval harness in tests/model/ runs them against golden cases.
//
// PILOT FRAMING (delta patch): for the pilot, the engine IS a config file of weights + an
// LLM that extracts and explains + a HUMAN making the final call, with human_rationale
// recorded on every decision. That is the CORRECT version for this stage, not a compromise.
// Every hand-match with a rationale is a labeled example; at 50+ outcomes the Stage-5
// regression doesn't replace the human's judgment — it audits which parts of it predicted
// shipped work.

export const MATCH_VERSION = 'match-1.0.0';

// Evidence tiers, weighted by how hard they are to fake: trial > referral > artifact.
// 'claimed' (no evidence pointer) is EXCLUDED from matching by default — weight 0.
export const TIER_WEIGHT = { trial: 1.0, referral: 0.85, artifact: 0.7, claimed: 0 };

// The config weights (sum 100). Observable inputs only.
export const MATCH_WEIGHTS = {
  skills_match: 34,      // required+preferred skills covered by evidence-backed claims
  evidence_depth: 26,    // how hard-to-fake the covering evidence is (tier-weighted)
  project_relevance: 20, // vertical / work-type overlap with the opportunity
  availability_fit: 12,  // candidate hours vs the opportunity's ask
  referral_presence: 8,  // a staked vouch exists (referral- or trial-tier evidence)
};

const norm = s => String(s || '').toLowerCase().trim();
const asList = v => (Array.isArray(v) ? v : String(v || '').split(/[,\n]/)).map(norm).filter(Boolean);

// A claim is usable evidence only when its tier is above 'claimed' AND it carries a pointer.
function usableClaims(candidate) {
  return (candidate?.claims || []).filter(c =>
    c && TIER_WEIGHT[c.verification_tier] > 0 && typeof c.evidence_pointer === 'string' && c.evidence_pointer);
}
function claimFor(candidate, skill) {
  const target = norm(skill);
  let best = null;
  for (const c of usableClaims(candidate)) {
    const s = norm(c.skill);
    if (s === target || s.includes(target) || target.includes(s)) {
      if (!best || TIER_WEIGHT[c.verification_tier] > TIER_WEIGHT[best.verification_tier]) best = c;
    }
  }
  return best;
}
function hasVouch(candidate) {
  if (candidate?.vouched === true) return true;
  return usableClaims(candidate).some(c => c.verification_tier === 'referral' || c.verification_tier === 'trial');
}

// Layer 1 — hard filters. Returns { pass, failures[] }; failures are human-readable.
export function hardFilters(opportunity, candidate) {
  const failures = [];
  const needHours = Number(opportunity?.hours_week);
  const haveHours = Number(candidate?.availability_hours_week);
  if (Number.isFinite(needHours) && needHours > 0 && Number.isFinite(haveHours) && haveHours > 0 && haveHours < needHours) {
    failures.push(`Availability: has ${haveHours} hr/week, opportunity needs ${needHours}`);
  }
  for (const skill of asList(opportunity?.required_skills ?? opportunity?.desired_skills)) {
    if (!claimFor(candidate, skill)) failures.push(`Missing evidence-backed must-have skill: ${skill}`);
  }
  if (opportunity?.referral_requirement === 'required' && !hasVouch(candidate)) {
    failures.push('Referral required — candidate has no staked vouch yet');
  }
  return { pass: failures.length === 0, failures };
}

// Layer 2+3 — observable weighted score + evidence-cited explanation for ONE pair.
export function scoreCandidate(opportunity, candidate, weights = MATCH_WEIGHTS) {
  const filters = hardFilters(opportunity, candidate);
  const required = asList(opportunity?.required_skills ?? opportunity?.desired_skills);
  const preferred = asList(opportunity?.preferred_skills);
  const wanted = [...new Set([...required, ...preferred])];

  const matched = [];
  const gaps = [];
  for (const skill of wanted) {
    const claim = claimFor(candidate, skill);
    if (claim) matched.push({ skill, tier: claim.verification_tier, evidence: claim.evidence_pointer });
    else gaps.push(skill);
  }
  const skillsFrac = wanted.length ? matched.length / wanted.length : 0;
  const depthFrac = matched.length
    ? matched.reduce((s, m) => s + TIER_WEIGHT[m.tier], 0) / matched.length
    : 0;
  const oppTags = new Set([...(opportunity?.verticals || []), ...(opportunity?.work_types || [])].map(norm));
  const candTags = new Set([...(candidate?.verticals || []), ...(candidate?.work_types || [])].map(norm));
  const overlap = [...oppTags].filter(t => candTags.has(t)).length;
  const relevanceFrac = oppTags.size ? overlap / oppTags.size : 0;
  const needHours = Number(opportunity?.hours_week);
  const haveHours = Number(candidate?.availability_hours_week);
  const availFrac = (!Number.isFinite(needHours) || needHours <= 0) ? 0
    : (!Number.isFinite(haveHours) || haveHours <= 0) ? 0
    : Math.min(1, haveHours / needHours);
  const vouched = hasVouch(candidate);

  const components = {
    skills_match: Math.round(weights.skills_match * skillsFrac * 10) / 10,
    evidence_depth: Math.round(weights.evidence_depth * depthFrac * 10) / 10,
    project_relevance: Math.round(weights.project_relevance * relevanceFrac * 10) / 10,
    availability_fit: Math.round(weights.availability_fit * availFrac * 10) / 10,
    referral_presence: vouched ? weights.referral_presence : 0,
  };
  const score = Math.round(Object.values(components).reduce((a, b) => a + b, 0));

  // Layer 3 — grounded explanation. Every strong-fit line cites its evidence pointer;
  // exactly one honest gap is always included when one exists.
  const lines = [];
  for (const m of matched.slice(0, 4)) lines.push(`✓ ${m.skill} — ${m.tier} evidence: ${m.evidence}`);
  if (vouched) lines.push('✓ Staked vouch on record');
  if (relevanceFrac > 0) lines.push(`✓ Working focus overlaps the opportunity (${overlap} shared area${overlap === 1 ? '' : 's'})`);
  const gap = gaps.length ? `△ No evidence yet in ${gaps[0]}`
    : (!vouched ? '△ No staked vouch yet — evidence is artifact-only'
      : (availFrac > 0 && availFrac < 1 ? '△ Fewer available hours than the opportunity asks' : '△ Evidence is thinner than a completed trial — confirm on a bounded Stage 1'));
  lines.push(gap);

  return {
    hard_filter_pass: filters.pass,
    filter_failures: filters.failures,
    score,
    score_components: components,
    explanation: lines.join('\n'),
    scorer_version: MATCH_VERSION,
  };
}

// The pilot engine: score a pool, return up to k evidence-cited candidates — or refuse.
// Refusal floor: a shortlist is never padded with weak fits.
export const MATCH_FLOOR = 35;
export function matchOpportunity(opportunity, candidates, { weights = MATCH_WEIGHTS, k = 3 } = {}) {
  const scored = (candidates || []).map(c => ({ candidate_id: c.id, name: c.name || '', ...scoreCandidate(opportunity, c, weights) }));
  const passing = scored.filter(s => s.hard_filter_pass && s.score >= MATCH_FLOOR)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  if (!passing.length) {
    const reasons = [];
    const failCounts = new Map();
    for (const s of scored) for (const f of s.filter_failures) {
      const key = f.replace(/: .*$/, '');
      failCounts.set(key, (failCounts.get(key) || 0) + 1);
    }
    for (const [key, n] of [...failCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      reasons.push(`${key} (${n} candidate${n === 1 ? '' : 's'})`);
    }
    if (!reasons.length) reasons.push('No candidate clears the evidence floor for this scope yet');
    return {
      refused: true,
      message: 'This opportunity is not currently well-suited for emerging talent.',
      reasons,
      scorer_version: MATCH_VERSION,
    };
  }
  return { refused: false, shortlist: passing, scorer_version: MATCH_VERSION };
}

// ---- Ranking metrics for the eval harness (pure JS, no deps). --------------------------
// ranked: array of ids in engine order; relevant: Set/array of human-selected ids.
export function precisionAtK(ranked, relevant, k) {
  const rel = new Set(relevant);
  const top = (ranked || []).slice(0, k);
  if (!top.length) return 0;
  return top.filter(id => rel.has(id)).length / top.length;
}
// gains: map id -> graded relevance (e.g. selected=2, shortlisted=1, rejected=0).
export function ndcgAtK(ranked, gains, k) {
  const gain = id => Number(gains?.[id]) || 0;
  const dcg = (ids) => ids.slice(0, k).reduce((s, id, i) => s + (Math.pow(2, gain(id)) - 1) / Math.log2(i + 2), 0);
  const ideal = Object.keys(gains || {}).sort((a, b) => gain(b) - gain(a));
  const idcg = dcg(ideal);
  return idcg ? dcg(ranked || []) / idcg : 0;
}

// ---- Four-fifths (0.8) disparate-impact report (audit-ready from Stage 2). --------------
// groups: [{ name, selected, total }] — selection counts per (simulated or real) category.
// Flags any group whose selection rate falls below 0.8x the highest group's rate.
export function fourFifthsReport(groups) {
  const rows = (groups || [])
    .filter(g => g && g.name && Number(g.total) > 0)
    .map(g => ({ name: String(g.name), selected: Number(g.selected) || 0, total: Number(g.total), rate: (Number(g.selected) || 0) / Number(g.total) }));
  const best = rows.reduce((m, r) => Math.max(m, r.rate), 0);
  const report = rows.map(r => ({
    ...r,
    ratio: best ? Math.round((r.rate / best) * 100) / 100 : 1,
    flagged: best > 0 && r.rate / best < 0.8,
  }));
  return { groups: report, anyFlagged: report.some(r => r.flagged), rule: 'four-fifths (0.8)' };
}
