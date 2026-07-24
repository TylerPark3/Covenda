# Covenda Compatibility Engine — Master Build Prompt (staged; do not skip ahead)

**Status:** the governing roadmap for matching. Where earlier docs overlap
(COVENDA_REALIGNMENT_PROMPT, SKILL_INFERENCE_PROFILE, SCORING_CREDIBILITY_HARDENING, the
scoring-engine spec), THIS stage order wins: no machine-learned ranking before the outcome
dataset exists. Physics: signal-per-unit-of-founder-attention; output is 3 candidates with
evidence-cited reasons, never a ranked list of 40.

## Stage 0 — Schema first (before any AI)
- student_profile: id, school, majors, availability_hours_week, availability_window; skills as
  `skill_claim` rows (skill, level, verification_tier ENUM[claimed, artifact, referral, trial],
  evidence_pointer). A skill without evidence exists only as tier=claimed and is EXCLUDED from
  matching by default. Profiles are link trees to raw proof — no PDF resume field.
- opportunity: id, company_id, type ENUM[PROJECT, PART_TIME, INTERNSHIP, RESEARCH,
  APPRENTICESHIP, TALENT_PIPELINE, FULL_TIME], title, objective, deliverables[],
  required_skills[], preferred_skills[], duration_weeks, hours_week, complexity_rating 1-5,
  ambiguity_rating 1-5, founder_time_budget_min_week, compensation, talent_source_prefs,
  referral_requirement ENUM[required, preferred, none].
- match: opportunity_id, student_id, hard_filter_pass bool, score numeric, score_components
  jsonb, explanation text, human_decision ENUM[proposed, selected, rejected], human_rationale
  text (REQUIRED on every human decision — training labels).
- outcome: match_id, milestones jsonb[{title, due_at, submitted_at, on_time, reassigned}],
  shipped bool, rubric_scores jsonb (dual-rater + adjudicated), founder_eval jsonb,
  founder_time_actual_min_week, repeat_project bool, interviewed bool, hired bool. Designed now,
  empty for weeks.

## Stage 1 — LLM extraction (the only AI in the MVP)
Two extractors, versioned JSON against fixed schemas, evidence pointers per claim:
1. Brief extractor (Project Engineer): founder free-text (optional repo/Figma reverse-audit,
   opt-in) → structured opportunity incl. complexity, ambiguity, founder time estimate.
   Follow-ups are extractive (mine the founder's backlog), never advisory.
2. Profile extractor: student link tree → skill claims with tiers. GitHub: languages/frameworks,
   active weeks, commit cadence, originality-vs-boilerplate, burst-pattern flags → single-dump
   repos to human review, not auto-credited. (api/github.js already implements much of this.)
Prompts live in the repo, versioned; extractors re-runnable over stored raw inputs.

## Stage 2 — Deterministic matching + grounded explanation (the pilot engine)
1. HARD FILTERS (never averaged away): availability fit, must-have skills at tier >= artifact,
   referral requirement satisfied.
2. Weighted sum over OBSERVABLE inputs only: skills_match, evidence_depth (trial > referral >
   artifact > claimed), project_relevance, availability_fit, referral_presence. Weights in a
   config file; per-company overrides allowed; NO unmeasurable dimensions (no agency/ambiguity
   tolerance/personality) until Stage 4 telemetry grounds them.
3. Explanation generator: LLM constrained to cite ONLY evidence pointers in score_components.
   Strong-fit bullets with refs, one honest gap, relevant-experience line. No citation → no claim.
REFUSAL PATH: if nobody passes hard filters at depth, say "this opportunity is not currently
well-suited for emerging talent" with reasons — never pad a weak shortlist.

## Stage 3 — Embedding recall (GATED: student pool > 100)
pgvector; cosine retrieves top ~20 as RECALL ONLY feeding Stage 2. Similarity never final-ranks
and never appears in explanations.

## Stage 4 — Telemetry (from project #1; doubles as flake defense)
Sequential milestone unlocks; milestone 1 due in 24–72h; missed-without-notice → auto-notify +
reassign to pre-selected backup; all milestone events, revisions, structured founder evals,
dual-rater rubric scores, founder_time_actual, repeat/interview/hire → outcome. Estimated-vs-
actual founder time is first-class.

## Stage 5 — Learned re-ranking (GATED: >= 50 completed outcomes)
Logistic regression predicting shipped/successful from Stage 2 features. Readable coefficients
(they ARE the score-the-scorer audit; update config weights toward them quarterly); calibration
before any displayed probability; explanation layer stays mandatory; decision logging sufficient
for an LL144-style adverse-impact audit. No deep nets until outcomes number in the hundreds.

## Eval harness (from Stage 2 onward)
Golden set >= 20 hand-matched (opportunity, student, decision, rationale) pairs; every prompt or
weight change runs against it; agreement with the human matcher is the acceptance metric; human
decisions + rationales append as new golden cases.

## Guardrails (every stage)
- Per-skill / per-pair scores; never a global person score or cross-student leaderboard.
- Every displayed number is evidence-cited or labeled illustrative.
- The AI observes human matching before automating it: human_rationale mandatory; the system
  drafts while a human decides throughout the pilot.
- Anti-gaming: longitudinal/hard-to-fake signals outweigh one-shot artifacts; anomalies → human.
- 30-day pilot rule: ONE domain, 10 founders × 10 students hand-matched through the admin UI,
  deliverables in <= 72h, success = founder says it saved real hours. Fix the human match before
  scaling it with AI.

## Stack
Postgres + pgvector; one LLM API for extraction/explanations (prompts versioned in repo);
admin UI where the operator is the matcher and the system drafts; Stripe milestone-release
payments. No fine-tuning, no vector DB service, no ML infra until Stage 5's gate is met.
