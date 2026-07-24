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
fairness invariance, tier ordering, precision@k / NDCG@k utilities, four-fifths (0.8)
disparate-impact report generator. Calibration (ECE/Brier) is stubbed until real outcomes
exist.

## Limitations
Rule-based heuristics tuned on a hand-built golden set; skill matching is string-level until
taxonomy normalization (Lightcast/O*NET) lands; no outcome-grounded weights yet; explanation
text is deterministic (template) rather than LLM-written — by construction it cannot cite
evidence that doesn't exist, but it is terse.

## Non-use
Not for automated rejection; not for ranking students globally; not for employment decisions
outside Covenda's scoped work-trials; not for use on populations other than consenting
Covenda members. Publish the philosophy, never the weights.
