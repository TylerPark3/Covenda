# Covenda Compatibility Engine — Master Build Prompt (enhanced, repo-grounded)

You are building the matching/compatibility technology for Covenda. Build it in the
exact stage order below. Do not skip ahead: no machine-learned ranking may exist before
the outcome dataset exists. This is NOT greenfield — reuse what exists (next section).

## STACK RECONCILIATION — read first
Covenda already exists; reuse, don't rebuild:
- Frontend: static `index.html` + `app.js` (CLASSIC script — no import/export, no
  top-level await; a test runs `new Function(script)`), `portal.html`/`portal.js`,
  `admin.html`/`admin.js`. NOT Next.js. The "operator-as-matcher admin UI" = extend
  `admin.html`/`admin.js` + `api/admin.js`.
- Backend: Vercel serverless ESM in `api/*.js` (`"type":"module"`). Matching lives in
  `api/portal.js`.
- DB: Supabase Postgres (RLS + service-role; the API is the sole gatekeeper). Migrations
  in `supabase/migrations/`, idempotent, ending with `notify pgrst, 'reload schema';`.
- Reuse: `member_profiles` (→ student_profile), `member_projects` (→ opportunity; has
  `conversion_outcome`, `completed_at`, review fields, `env_*`), `computeFitScore` /
  `FIT_WEIGHTS` / `rankOpportunities` / `logMatchEvent` (→ Stage 2 scorer + match log),
  `api/project-intake.js` on Structured Outputs (→ Brief extractor), `api/github.js`
  GitHub skill inference (→ Profile extractor), credits / `credit_ledger` /
  `release_project_escrow` (→ milestone-release payments).
- Payments: milestone-release uses the EXISTING escrow/credits release. Stripe is
  already integrated for credit top-ups + identity — direct Stripe milestone payouts
  are LATER.
- Tests: `npm run check` = `node --check` on all `api/*.js` + `node --test tests/*.test.js`.
  The eval harness = `tests/*.test.js`.

## The physics
Rate-limiter = signal-per-unit-of-founder-attention. Résumés are lossy and LLM-poisoned;
the system moves high-density, evidence-grounded signal to a founder in <60s of reading.
Output of matching is never a ranked list of 40 — it is 3 candidates with evidence-cited
reasons.

## Stage 0 — Schema (build first, before any AI) — mapped onto Supabase
- **skill_claim** (NEW table): student_id → member_profiles, skill (NORMALIZED to a
  canonical taxonomy — Lightcast Open Skills / O*NET), level,
  verification_tier ENUM[claimed, artifact, referral, trial], evidence_pointer (URL/ref).
  A skill without an evidence_pointer may exist only as tier=claimed and is EXCLUDED
  from matching by default. Profiles are link trees to raw proof (repos, artifacts, Loom
  walkthroughs) — no PDF résumé field.
- **opportunity** = `member_projects` + add: type ENUM[PROJECT, PART_TIME, INTERNSHIP,
  RESEARCH, APPRENTICESHIP, TALENT_PIPELINE, FULL_TIME], complexity_rating 1-5,
  ambiguity_rating 1-5, founder_time_budget_min_week, talent_source_prefs,
  referral_requirement ENUM[required, preferred, none]. (required_skills/preferred_skills
  reuse existing fields.)
- **match** (formalize the match-event log): opportunity_id, student_id,
  hard_filter_pass bool, score numeric, score_components jsonb, explanation text,
  human_decision ENUM[proposed, selected, rejected], human_rationale text
  **(REQUIRED on every human decision — these are training labels)**.
- **outcome** = extend `member_projects` (shipped, completed_at, conversion_outcome) +
  NEW: milestones jsonb[{title, due_at, submitted_at, on_time, reassigned}],
  rubric_scores jsonb (dual-rater + adjudicated), founder_eval jsonb (structured),
  founder_time_actual_min_week, repeat_project/interviewed/hired (reuse
  conversion_outcome). Designed now even though it stays empty for weeks.

## Stage 1 — LLM extraction (the only AI in the MVP)
Two extractors, versioned JSON against fixed schemas, evidence pointers per claim:
1. **Brief extractor (Project Engineer)** = extend `api/project-intake.js` (Structured
   Outputs, model `claude-opus-4-8`, `max_tokens ≥ 4000`): founder free-text (+ optional
   repo/Figma link, reverse-audit, opt-in only) → structured opportunity. Follow-ups are
   EXTRACTIVE (mine the founder's backlog), never advisory.
2. **Profile extractor** = extend `api/github.js`: languages/frameworks, active weeks,
   commit cadence, originality-vs-boilerplate heuristics, burst-pattern flags
   (single-dump repos → human review, NOT auto-credited). Normalize skills to the
   canonical taxonomy from Stage 0.
Prompts live in the repo, versioned; extractors re-runnable over stored raw inputs.

## Stage 2 — Deterministic matching + grounded explanation (the pilot engine)
Extend `computeFitScore`. Three layers, in order:
1. **Hard filters (never averaged away):** availability fit, must-have skills at
   tier ≥ artifact, referral requirement satisfied.
2. **Weighted sum over OBSERVABLE inputs only:** skills_match, evidence_depth
   (tier-weighted: trial > referral > artifact > claimed), project_relevance,
   availability_fit, referral_presence. Weights in a config file; per-company overrides
   allowed; NO unmeasurable dimensions (no agency, ambiguity tolerance, personality)
   until Stage 4 telemetry grounds them.
3. **Explanation generator:** LLM writes the fit explanation constrained to cite ONLY
   the evidence pointers in score_components (strong-fit bullets w/ evidence refs, one
   honest gap, relevant-experience line). Can't cite it → can't claim it.
- **Refusal path:** if no candidate passes hard filters at adequate depth, output "this
  opportunity is not currently well-suited for emerging talent" with reasons — never pad
  a weak shortlist.
- ADD — cold-start prior: a thin profile gets a WIDER confidence band from its
  evidence tier, not fake parity; every score displays with its band, never bare.
- ADD — ownership-defense (anti-gaming): a short recorded artifact walkthrough + commit-
  timeline forensics; anomalies route to human review; the interview itself is scored.
- ADD — **audit-ready FROM STAGE 2** (not Stage 5): decision log
  {scorer_version, features, output}; a four-fifths (0.8) disparate-impact report; a
  fairness-invariance test (perturb school prestige / gender-coded name → score
  unchanged) in `tests/model/`; a committed model card + datasheet. Assume NYC LL144 /
  Illinois / Colorado AI Act / EU AI Act scrutiny.

## Stage 3 — Embedding recall (GATE: student pool > 100)
Enable Supabase pgvector (`vector` extension). Embed profiles and briefs. Cosine
similarity retrieves top ~20 candidates ONLY as a recall step feeding Stage 2's scorer.
Similarity never produces final ranking and never appears in explanations.

## Stage 4 — Telemetry (from project #1; doubles as flake defense)
Sequential milestone unlocks on `member_projects`: milestone 1 due 24–72h;
missed-without-notice → auto-notify + reassign to a pre-selected backup; reassignment
recorded. Write milestone events, revisions, structured founder evaluations, dual-rater
rubric scores, founder_time_actual, and downstream events (repeat/interview/hire via
conversion_outcome) to outcome. Estimated-vs-actual founder time is a first-class metric.
- ADD — dual-rater rubrics with anchored exemplars + adjudication; **inter-rater
  reliability (Cohen's κ / Krippendorff's α) is the gate that says when automation is
  safe** (the adjudicated score is the training label).
- ADD — per-rater normalization of founder_eval (a founder who gives everyone 9s tells
  you less).
- ADD — difficulty-adjusted outcomes: use opportunity.complexity_rating /
  ambiguity_rating to adjust outcome scores strength-of-schedule style (a 7 on a hard,
  ambiguous project beats a 9 on a trivial one).
- ADD — behavioral agency instrumented (on-time, revision count, time-to-unblock, ship),
  never self-reported.
- ADD — intra-pair peer OBSERVATION (same-project pairs only; narrow, cross-checked
  questions) as a distinct evidence class.
- ADD — contest/appeal: a student can challenge a score with new evidence (regulatory
  contestability; generates more data).

## Stage 5 — Learned re-ranking (GATE: ≥ 50 completed outcomes)
Logistic regression predicting shipped/successful from Stage 2 features. Requirements:
readable coefficients (they ARE the score-the-scorer audit — nudge config weights toward
them quarterly); calibration before any probability is displayed; the explanation layer
stays mandatory; full decision logging sufficient for an adverse-impact/bias audit
(already built at Stage 2). No deep nets until outcomes number in the hundreds.

## Eval harness (exists from Stage 2 onward) — `node --test tests/model/*.test.js`
Golden set of ≥ 20 hand-matched (opportunity, student, decision, rationale) pairs. Every
prompt or weight change runs against it; agreement with the human matcher's decisions is
the acceptance metric. Human matching decisions + rationales are continuously appended
as new golden cases. ADD ranking metrics (NDCG@k / MRR / precision@k), an LLM-judge
validated against the gold ordering by Kendall's tau, and IRR reporting.

## Guardrails (apply at every stage)
- Scores are per-skill / per-pair, NEVER a global person score or cross-student
  leaderboard.
- Every displayed number is either evidence-cited or labeled illustrative.
- The AI observes human matching before it automates it: human_rationale is mandatory,
  and the system DRAFTS while a human DECIDES throughout the pilot.
- Anti-gaming: hard-to-fake signals (longitudinal commit history, trials, verified
  referrals) outweigh one-shot artifacts; anomalies route to human review.
- Decision-support only; the company decides. Publish the scoring PHILOSOPHY, never the
  weights. No cybersecurity content (different company shares the name).
- `app.js` stays classic; migrations idempotent + `notify pgrst`; RLS/grants unchanged;
  `npm run check` green.

## 30-day rule (the pilot)
One domain (e.g., full-stack TypeScript/Next.js for seed-stage AI startups), 10 founders
× 10 students hand-matched through the admin UI (`admin.html`/`admin.js`), deliverables
forced through in ≤ 72h, success = the founder says the work saved them real hours. Fix
the human match before scaling it with AI.

## Stack (reconciled)
Supabase Postgres (+ pgvector at Stage 3); one LLM API (Claude, prompts versioned in
repo) for extraction/explanations; VANILLA `admin.html`/`admin.js` as the operator-matcher
UI (NOT Next.js); milestone-release via the existing credits/escrow
(`release_project_escrow`); Stripe already integrated for top-ups/identity (direct Stripe
milestone payouts later). No fine-tuning, no external vector DB service, no ML infra until
Stage 5's gate is met.

---

# Delta Patch (additive — stage order, schema, gates, guardrails UNCHANGED)

1. **Reverse-audit intake mode (opt-in, never default):** founder pastes their OWN public
   repo/Figma link → the Brief extractor proposes THREE scoped draft opportunities
   (deliverable, boundary, acceptance criteria, hour estimate, founder-time line). Strictly
   opt-in; drafts the founder edits and confirms; reuses the Structured Outputs intake.
2. **Micro-bounty rung:** smallest engagement unit — bounded ~5-hour task (~$100–200 anchor,
   priced through the existing credits flow). Ladder: 5-hour task → 2-week project → 6-week
   project → part-time → internship → full-time. `engagement_rung` (nullable, CHECK'd) on the
   opportunity; micro-bounties are the de-risked first bet, NOT the price ceiling; rung
   progression respects the stage1→stage2 access gate + conversion-fee hooks.
3. **Three-candidate shortlist as a HARD UI constraint:** company-facing match surface shows
   AT MOST 3 evidence-cited candidates (strong-fit bullets + one honest gap), no "see all N";
   fewer than 3 pass → show what passed or the refusal path; NEVER pad. (Engine already
   enforces k=3 + refusal in api/match.js.)

**Pilot framing (committed as the top-of-file note in api/match.js):** for the pilot the
engine IS a config of weights + an LLM that extracts/explains + a human making the final
call with mandatory rationale. Correct for this stage, not a compromise; at 50+ outcomes the
regression audits the human's judgment rather than replacing it.

**Delta status:** ALL THREE SHIPPED — #1 reverse-audit (opt-in, web_fetch-grounded, <=3 labeled drafts, pause_turn-safe), #2 micro-bounty engagement_rung (migration 20260726340000 + intake preset), #3 k=3 cap + refusal in match-1.0.0.
