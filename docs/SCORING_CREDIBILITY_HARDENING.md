# Covenda — Scoring Credibility Hardening (patch to the Scoring Engine spec)

**Status:** filed for build; extends/amends the Compatibility & Readiness Scoring Engine spec.
Same global guardrails (classic app.js; idempotent migrations + `notify pgrst`; RLS unchanged;
decision-support; no cybersecurity; dependency-light; `npm run check` green).

**Principle:** the score's credibility IS the product. Every mechanism makes scores harder to
fake, easier to trust, and more predictive.

## THE PILOT THREE — build first (the first ~20 projects need exactly these)

### P1. Confidence / verification tiers (not bare point scores)
Every score = `{value, evidenceTier, band}`. Tiers: **BRONZE** (artifact-only) → **SILVER**
(artifact + referral or professor co-sign) → **GOLD** (trial-verified). Map to the proof
hierarchy L1–L5; the band TIGHTENS as a student climbs. Never display a bare number — always
value + tier/band. Kills fake precision while profiles are thin.

### P2. Dual-rater anchored rubrics + inter-rater reliability
Per skill, anchored exemplars for a 4, 6, and 9 (an anchored DCF, an anchored repo). Two raters
score each artifact INDEPENDENTLY; adjudicate disagreements; the adjudicated score is the label.
Compute IRR (Cohen's κ / Krippendorff's α) — IRR gates when the AI scorer is safe to automate
(its training target IS the adjudicated score). Every rubric-scored artifact → a labeled
training row for the eval harness. A professor co-signs a rubric once; students scored against
it inherit that credibility.

### P3. Ownership-defense layer (anti-gaming backbone)
A short RECORDED walkthrough of the artifact: "walk me through why you structured it this way,
what you'd change, where it broke." Genuine authors answer instantly; outsourced/AI work
collapses under two follow-ups. Pair with commit-timeline forensics (months of history vs one
2 a.m. dump — `api/github.js` oneShot/fork flags already feed this). Route anomalies to HUMAN
review — never auto-score them. Score the interview itself (communication, depth).

## MODEL ARCHITECTURE — build alongside (cheap, foundational)

- **M1. Source-weighted composite with fakeability multipliers.** Trial outcomes > behavioral
  company actions (rehired/referred) > longitudinal GitHub history > professor rubric co-sign >
  one-shot artifact > self-report. PUBLISH the philosophy, never the weights.
- **M2. Bayesian updating, not averaging.** Each outcome updates a PRIOR. Early scores move a
  lot; mature scores are stable. Cold-start prior comes from the evidence tier (P1), not zero
  and not fake parity. Store posterior + uncertainty (uncertainty drives the P1 band).
- **M3. Behavioral agency instrumentation.** From trial telemetry: on-time delivery, revision
  count, time-to-unblock, ship binary. Never self-reported.
- **M4. Per-rater normalization.** Normalize company satisfaction per rater; satisfaction is a
  DIAGNOSTIC; behavioral outcomes (ship/repeat/hire) stay load-bearing.
- **M5. Difficulty-adjusted outcomes.** Tag project COMPLEXITY + AMBIGUITY at scoping; adjust
  strength-of-schedule style. A 7 on a hard ambiguous project beats a 9 on a trivial one.
- **M6. Contextual percentiles, not absolute numbers.** "Top 10% of {vertical} students on
  {dimension} evidence," never a bare 8.2. Per-dimension, per-vertical, contextual to a request,
  evidence-attached — never a public global ranking (no-leaderboard rule holds).
- **M7. Intra-pair peer OBSERVATION.** Only for two students on the SAME project: narrow
  structured questions, cross-checked against the company's view. Peer observation, not
  endorsement; open peer referral stays OUT as a validation signal.
- **M8. Contest / appeal mechanism.** Students challenge a score with new evidence; satisfies
  CONTESTABILITY in AI-employment law. Log everything for adverse-impact/bias audits from day
  one.

## GATED — log now, activate on data

- **G1. Score the scorer.** Flywheel rows store {predicted_score, features, outcome}. QUARTERLY,
  once **≥ ~50 outcomes** exist, measure component predictive power and reweight on evidence.
  Do NOT run early — the threshold is documented, not code that runs.

## Guardrails (reinforced)
- Publish the scoring PHILOSOPHY; never weights/methodology.
- Never a public global leaderboard; percentiles contextual + evidence-attached.
- Decision-support; company decides; scores contestable; fully audit-logged
  (NYC LL144 / Illinois / Colorado AI Act / EU AI Act).

## Acceptance (consolidated)
- Every score carries {value, evidenceTier, band}; no bare numbers anywhere.
- Dual-rater anchored-rubric workflow with IRR; adjudicated scores emitted as labeled rows.
- Ownership-defense interview + commit forensics; anomalies to human review; interview scored.
- Composite uses fakeability-ranked weights; Bayesian posterior + uncertainty replaces
  averaging; cold-start prior from evidence tier.
- Behavioral agency captured from telemetry; per-rater-normalized satisfaction diagnostic only.
- Complexity/ambiguity tagged at scoping; outcomes difficulty-adjusted.
- Contextual percentiles; contest/appeal flow + audit log.
- Score-the-scorer logged; reweighting gated + documented.
- app.js untouched; `npm run check` green.
