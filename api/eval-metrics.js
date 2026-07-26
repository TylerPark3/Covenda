// Evaluation harness for the Compatibility Engine (Scoring spec Part B).
//
// Pure functions, no dependencies. These are the measurements that tell us whether the matcher
// is actually any good — and, just as importantly, whether it is FAIR and CALIBRATED. They are
// deliberately separated from api/match.js so evaluating the engine can never accidentally
// change how it scores.
//
// Honesty note: every metric here is only as meaningful as the labels behind it. Until real
// operator decisions accumulate in public.matches, these run against the hand-built golden set
// (tests/fixtures/DATASHEET.md), which is small. Small-sample numbers are reported, never
// dressed up as validation.

export const EVAL_VERSION = 'eval-1.0.0';

const asArray = x => (Array.isArray(x) ? x : [...(x || [])]);
const round = (n, places = 4) => Math.round(n * 10 ** places) / 10 ** places;

// ---- Ranking quality ------------------------------------------------------------------------

// Fraction of the top-k that are relevant.
export function precisionAtK(ranked, relevant, k) {
  const set = relevant instanceof Set ? relevant : new Set(asArray(relevant));
  const top = asArray(ranked).slice(0, k);
  if (!top.length) return 0;
  return round(top.filter(id => set.has(id)).length / top.length);
}

// Fraction of all relevant items that made the top-k.
export function recallAtK(ranked, relevant, k) {
  const set = relevant instanceof Set ? relevant : new Set(asArray(relevant));
  if (!set.size) return 0;
  const top = asArray(ranked).slice(0, k);
  return round(top.filter(id => set.has(id)).length / set.size);
}

// Reciprocal rank of the FIRST relevant hit — "how far down did the operator have to read?".
export function reciprocalRank(ranked, relevant) {
  const set = relevant instanceof Set ? relevant : new Set(asArray(relevant));
  const list = asArray(ranked);
  for (let i = 0; i < list.length; i += 1) if (set.has(list[i])) return round(1 / (i + 1));
  return 0;
}

export function meanReciprocalRank(cases) {
  const rows = asArray(cases);
  if (!rows.length) return 0;
  return round(rows.reduce((s, c) => s + reciprocalRank(c.ranked, c.relevant), 0) / rows.length);
}

// Average precision for one ranking (precision measured at each relevant hit).
export function averagePrecision(ranked, relevant) {
  const set = relevant instanceof Set ? relevant : new Set(asArray(relevant));
  if (!set.size) return 0;
  const list = asArray(ranked);
  let hits = 0, sum = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (set.has(list[i])) { hits += 1; sum += hits / (i + 1); }
  }
  return round(sum / set.size);
}

export function meanAveragePrecision(cases) {
  const rows = asArray(cases);
  if (!rows.length) return 0;
  return round(rows.reduce((s, c) => s + averagePrecision(c.ranked, c.relevant), 0) / rows.length);
}

// Normalized discounted cumulative gain — graded relevance (selected=2, shortlisted=1, ...).
export function ndcgAtK(ranked, gains, k) {
  const gainOf = id => Number((gains instanceof Map ? gains.get(id) : gains?.[id]) || 0);
  const list = asArray(ranked).slice(0, k);
  const dcg = list.reduce((s, id, i) => s + gainOf(id) / Math.log2(i + 2), 0);
  const ideal = [...(gains instanceof Map ? gains.values() : Object.values(gains || {}))]
    .map(Number).sort((a, b) => b - a).slice(0, k)
    .reduce((s, g, i) => s + g / Math.log2(i + 2), 0);
  return ideal ? round(dcg / ideal) : 0;
}

// ---- Rank correlation (engine order vs human order) -----------------------------------------

// Spearman's rho over two equal-length score vectors (ties get averaged ranks).
export function spearmanRho(a, b) {
  const xs = asArray(a).map(Number);
  const ys = asArray(b).map(Number);
  if (xs.length !== ys.length || xs.length < 2) return null;
  const rank = (v) => {
    const idx = v.map((val, i) => [val, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
      const avg = (i + j) / 2 + 1; // average rank for the tied group
      for (let t = i; t <= j; t += 1) r[idx[t][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const n = xs.length;
  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? round(num / Math.sqrt(dx * dy)) : null;
}

// Kendall's tau-b — the agreement measure used to validate an LLM judge against human ranking.
// Tau is preferred over Spearman for short lists (a shortlist is 3 items) and handles ties.
export function kendallTau(a, b) {
  const xs = asArray(a).map(Number);
  const ys = asArray(b).map(Number);
  if (xs.length !== ys.length || xs.length < 2) return null;
  let concordant = 0, discordant = 0, tiedX = 0, tiedY = 0;
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      const dx = Math.sign(xs[i] - xs[j]);
      const dy = Math.sign(ys[i] - ys[j]);
      if (dx === 0 && dy === 0) { tiedX += 1; tiedY += 1; continue; }
      if (dx === 0) { tiedX += 1; continue; }
      if (dy === 0) { tiedY += 1; continue; }
      if (dx === dy) concordant += 1; else discordant += 1;
    }
  }
  const n0 = (xs.length * (xs.length - 1)) / 2;
  const denom = Math.sqrt((n0 - tiedX) * (n0 - tiedY));
  return denom ? round((concordant - discordant) / denom) : null;
}

// An LLM judge is only trustworthy once it agrees with humans. Gate it behind a tau floor,
// and say so out loud rather than quietly trusting it.
export const JUDGE_TAU_FLOOR = 0.7;
export function judgeIsTrustworthy(humanRanks, judgeRanks, { floor = JUDGE_TAU_FLOOR } = {}) {
  const tau = kendallTau(humanRanks, judgeRanks);
  return { tau, trustworthy: tau !== null && tau >= floor, floor };
}

// ---- Calibration ----------------------------------------------------------------------------

// Brier score: mean squared error of probabilistic predictions. Lower is better; 0.25 is the
// score of always guessing 0.5, so anything at or above that is worthless.
export function brierScore(predictions, outcomes) {
  const p = asArray(predictions).map(Number);
  const o = asArray(outcomes).map(v => (v ? 1 : 0));
  if (!p.length || p.length !== o.length) return null;
  return round(p.reduce((s, v, i) => s + (v - o[i]) ** 2, 0) / p.length);
}

// Expected calibration error: bucket predictions, compare predicted confidence to observed rate.
// A score that says "80" should be right about 80% of the time; ECE measures that gap.
export function expectedCalibrationError(predictions, outcomes, { bins = 10 } = {}) {
  const p = asArray(predictions).map(Number);
  const o = asArray(outcomes).map(v => (v ? 1 : 0));
  if (!p.length || p.length !== o.length) return null;
  const buckets = Array.from({ length: bins }, () => ({ n: 0, conf: 0, hits: 0 }));
  for (let i = 0; i < p.length; i += 1) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(p[i] * bins)));
    buckets[idx].n += 1;
    buckets[idx].conf += p[i];
    buckets[idx].hits += o[i];
  }
  let ece = 0;
  for (const b of buckets) {
    if (!b.n) continue;
    ece += (b.n / p.length) * Math.abs(b.hits / b.n - b.conf / b.n);
  }
  return round(ece);
}

// ---- Robustness ------------------------------------------------------------------------------

// Paraphrase stability: the same opportunity worded differently must not reshuffle the
// shortlist. Returns the fraction of pairs whose top-k ordering is identical.
export function paraphraseStability(rankings, k = 3) {
  const rows = asArray(rankings).map(r => asArray(r).slice(0, k).join('|'));
  if (rows.length < 2) return null;
  let same = 0, pairs = 0;
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) { pairs += 1; if (rows[i] === rows[j]) same += 1; }
  }
  return pairs ? round(same / pairs) : null;
}

// Ablation: how much does each scoring component actually contribute? Re-runs a scoring function
// with one weight zeroed at a time and reports the ranking change. A component that changes
// nothing is dead weight and should be cut, not left in to look sophisticated.
export function ablationReport(weights, scoreFn, { k = 3 } = {}) {
  const baseline = asArray(scoreFn(weights)).slice(0, k);
  const rows = [];
  for (const key of Object.keys(weights)) {
    const ablated = { ...weights, [key]: 0 };
    const ranked = asArray(scoreFn(ablated)).slice(0, k);
    const changed = ranked.join('|') !== baseline.join('|');
    const overlap = ranked.filter(id => baseline.includes(id)).length;
    rows.push({ component: key, weight: weights[key], changedTopK: changed, topKOverlap: overlap });
  }
  return { baseline, components: rows, inertComponents: rows.filter(r => !r.changedTopK).map(r => r.component) };
}

// ---- Fairness ---------------------------------------------------------------------------------

// Four-fifths (80%) rule: the selection rate of any group must be >= 0.8x the best group's rate.
// Required by NYC LL144-style bias audits; a flag here is a STOP, not a warning to file away.
export function fourFifthsReport(groups) {
  const rows = Object.entries(groups || {}).map(([group, v]) => {
    const selected = Number(v.selected) || 0;
    const total = Number(v.total) || 0;
    return { group, selected, total, rate: total ? selected / total : 0 };
  });
  if (!rows.length) return { groups: [], best: null, flagged: [], compliant: true };
  const best = rows.reduce((m, r) => (r.rate > m.rate ? r : m), rows[0]);
  const scored = rows.map(r => {
    const ratio = best.rate ? round(r.rate / best.rate) : 1;
    return { ...r, rate: round(r.rate), impactRatio: ratio, flagged: ratio < 0.8 };
  });
  const flagged = scored.filter(r => r.flagged);
  return { groups: scored, best: best.group, flagged: flagged.map(r => r.group), compliant: flagged.length === 0 };
}

// ---- Reporting ---------------------------------------------------------------------------------

// One call that produces the full evaluation record for an audit log. `sampleSize` is surfaced
// prominently and a small sample is labelled as such — the point is to prevent a 6-case result
// from ever being quoted as if it were validation.
export const MIN_TRUSTWORTHY_SAMPLE = 20;
export function evaluationReport(cases, { k = 3 } = {}) {
  const rows = asArray(cases);
  const n = rows.length;
  const report = {
    evalVersion: EVAL_VERSION,
    sampleSize: n,
    underpowered: n < MIN_TRUSTWORTHY_SAMPLE,
    precisionAtK: n ? round(rows.reduce((s, c) => s + precisionAtK(c.ranked, c.relevant, k), 0) / n) : 0,
    recallAtK: n ? round(rows.reduce((s, c) => s + recallAtK(c.ranked, c.relevant, k), 0) / n) : 0,
    mrr: meanReciprocalRank(rows),
    map: meanAveragePrecision(rows),
    ndcgAtK: n ? round(rows.reduce((s, c) => s + ndcgAtK(c.ranked, c.gains || {}, k), 0) / n) : 0,
    k,
  };
  report.note = report.underpowered
    ? `Sample of ${n} is below the ${MIN_TRUSTWORTHY_SAMPLE}-case floor — directional only, NOT validation.`
    : `Sample of ${n} cases.`;
  return report;
}
