# Covenda Scoring & Matching — Model Card

**Versions covered:** `fit-2.0.0` (computeFitScore), `readiness-1.0.0` (computeReadinessScore),
`match-1.0.0` (api/match.js), GitHub skill analyzer (api/github.js). All rule-based; no
learned/predictive model exists (Stage-5 gate: ≥50 completed outcomes).

## Intended use
AI-assisted **decision support** for matching vetted students to scoped opportunities.
The company/operator always decides; every human decision is recorded with a mandatory
rationale. Never an automated hiring decision; never a global person score or leaderboard.

## Inputs (observable only)
Skill claims with evidence tiers (trial > referral > artifact; claimed excluded), vertical/
work-type overlap, availability, staked-vouch presence, work-style ↔ environment fit, the
student's own completed-project record. **Excluded by design:** school prestige, name,
gender, age, race, and any protected attribute or proxy — enforced by fairness-invariance
tests that fail the build if a proxy moves a score.

## Metrics (tests/model/, runs in npm run check)
Golden-set agreement with the human matcher (seed 6/6; set grows with operator decisions),
hard-cap (≤3) + refusal-path behavior, evidence-citation invariants (no pointer → no claim),
fairness invariance, tier ordering, and the four-fifths (0.8) disparate-impact report.

**Evaluation harness** — `api/eval-metrics.js` (pure JS, no dependencies; deliberately separate
from `api/match.js` so evaluating the engine can never change how it scores):

| Family | Measures |
|---|---|
| Ranking | precision@k, recall@k, MRR, MAP, NDCG@k |
| Rank correlation | Spearman ρ, Kendall τ-b (τ ≥ 0.7 gates trusting an LLM judge) |
| Calibration | Brier score, expected calibration error (ECE) |
| Robustness | paraphrase stability, component ablation |
| Fairness | four-fifths impact-ratio report |

`evaluationReport()` reports `sampleSize` and sets `underpowered: true` below 20 cases, with a
note saying the result is directional and **not** validation — so a 6-case number can never be
quoted as if the engine were validated.

### Ablation finding (honest, and a caveat on the weights)
Running `ablationReport` over the live `MATCH_WEIGHTS`: on a pool where several candidates clear
the hard filters, `skills_match` (34), `evidence_depth` (26) and `project_relevance` (20) each
change the top-3 when zeroed — they earn their weight. `availability_fit` (12) and
`referral_presence` (8) did **not** change the ranking on that pool, because availability is
already enforced as a hard filter and referral presence only matters when a vouched candidate is
otherwise borderline. This is expected given the architecture (hard filters do the heavy lifting;
the weighted sum breaks ties among survivors) but it means those two weights are currently
**unvalidated** — do not cite them as evidence the model "considers availability and referrals"
until real outcome data shows them moving decisions.

### Calibration status
Brier/ECE are **implemented and tested**, but have no real predictions to score yet: calibration
is only meaningful against realized outcomes, and the flywheel (`public.matches` decisions +
conversion outcomes) is still filling. Reweighting stays gated at ≥50 outcomes (G1).

### Extraction (AI intake) eval
`tests/model/extraction-eval.test.js` is the hallucination check for `api/project-intake.js`:
generated briefs are asserted to introduce no unsourced money amounts or durations, to drop
off-taxonomy verticals/work-types rather than pass them through, to null out out-of-range
ratings instead of emitting a confident fabrication, and to degrade to empty strings (never
placeholder prose like "TBD — 4 weeks", which a company could read as a quote). Fixtures are
model-shaped and run without an API key; a live-model eval belongs in a separate key-gated
harness, since a suite that silently passes when the key is absent is worse than no suite.

## Limitations
Rule-based heuristics tuned on a hand-built golden set; skill matching is string-level until
taxonomy normalization (Lightcast/O*NET) lands; no outcome-grounded weights yet; explanation
text is deterministic (template) rather than LLM-written — by construction it cannot cite
evidence that doesn't exist, but it is terse.

## Non-use
Not for automated rejection; not for ranking students globally; not for employment decisions
outside Covenda's scoped work-trials; not for use on populations other than consenting
Covenda members. Publish the philosophy, never the weights.
