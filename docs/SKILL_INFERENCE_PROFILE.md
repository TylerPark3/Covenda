# Covenda — Skill-Inference Profile System (Feature Spec + Build Prompt)

**Status:** later-down-the-line feature, spec'd now per Tyler. Not yet built. This document
is the source of truth to hand a future build session.

**How it fits the strategy:** this operationalizes two pillars of
[`COVENDA_REALIGNMENT_PROMPT.md`](COVENDA_REALIGNMENT_PROMPT.md) — the **verified record within a
vertical** (the tree's canopy) and **proof-of-work foregrounded** (GitHub/portfolio, firm-driven
search). It's the concrete mechanism behind "judged on proof of work," and it must obey the same
guardrail: **scores come only from real artifacts, referrals, and trial outcomes — never
fabricated, and every score ships with its evidence.**

---

## Part 1 — Feature Spec

### What it is
Covenda profiles are **living, evidence-based skill records** — flexible, changeable, variable,
and buildable. Instead of a static résumé, a student's profile is assembled from three signal
layers, each machine- and human-verifiable:

1. **Referrals** — professor referrals and company referrals (post-trial). High-trust adult
   endorsements, each tied to the referrer's identity and track record. *(This is the staked
   referral already live on the site — the profile is where its weight surfaces.)*
2. **Analyzed artifacts** — the student uploads or links real work; Covenda's AI analyzes it,
   deduces the skillsets it demonstrates, and assigns numerical skill scores:
   - **GitHub repositories** → infer languages, frameworks, architecture quality, testing habits,
     commit consistency over time, originality vs boilerplate. Output: per-skill scores (e.g.,
     Python 8.1, API design 7.4) with a one-paragraph evidence rationale.
   - **Stock pitch presentations** → assess thesis quality, valuation rigor, use of comps/DCF,
     risk treatment, clarity. Output: per-skill scores (e.g., DCF modeling 7.8, equity research
     7.2) with rationale.
   - Extensible to other artifact types later (research papers, design portfolios, case decks,
     data projects).
3. **Verified trial outcomes** — completed Covenda work-trials feed scores and company ratings
   back into the profile, compounding over time. *(Ties to the Stage 1 → Stage 2 work-trial
   ladder now live in the portal.)*

### Skill tagging
Skills are **inferred from the work itself, not self-declared.** If the pitch contains a DCF,
"DCF" is added as a scored skill. Self-added skills are allowed but **visually distinguished as
unverified** until backed by an artifact, referral, or trial.

### Scoring rules
- **Per-skill, never per-person.** No single "candidate score." (Defensibility + fairness + it's
  more useful to founders anyway.)
- **Every score ships with its evidence:** what in the artifact justified it.
- **Living scores:** re-run on new uploads, updated by trial outcomes, decay-flagged if stale.
- **Anti-gaming weighting:** signals that are hard to fake in an afternoon (commit history over
  months, trial performance, staked referrals) outweigh signals AI can generate (a polished
  one-shot repo or deck). **The artifact layer alone is never treated as proof — trials and
  referrals anchor it.**

### Profile properties
- **Flexible / changeable / variable / buildable:** students add, remove, and reorder sections;
  upload new artifacts anytime; choose vertical presentation (a startup-facing view can foreground
  GitHub + trials; a research-facing view can foreground papers).
- **Discovery-first:** profiles are designed to be **browsed and pulled by founders** (firm-driven
  search), not just attached to applications. Filters: skill + score threshold + vertical +
  availability + referral source.

### Why this differentiates
- Handshake structurally **cannot** score or rank students (universities are its customer).
- Parker Dewey has no skill inference and no compounding record.
- Litmus-style assessments are **synthetic tests**; Covenda scores **real work already done** plus
  real trial outcomes.
- Mercor validates AI vetting at scale but serves AI labs; nobody has built the artifact-grounded
  version for **undergrads → startups.**

---

## Part 2 — Ready-to-Use Build Prompt

> Copy-paste this when ready to prototype.

Build a prototype of Covenda's skill-inference profile system. Covenda is a platform connecting
vetted undergraduates with early-stage startups through referrals, analyzed work artifacts, and
paid work-trials. Core feature: a student profile that is flexible, changeable, and buildable,
composed of verified signal blocks.

1. **GitHub analysis module.** Given a linked GitHub repository (or several), analyze the code and
   repo metadata to deduce the student's skillsets. Identify languages, frameworks, and domains;
   evaluate code structure, documentation, testing, and commit history over time; distinguish
   original work from tutorial/boilerplate code. Output a set of per-skill numerical scores (0–10,
   one decimal) each with a short evidence rationale citing specific files or patterns.
2. **Artifact assessment module.** Given an uploaded presentation or document (e.g., a stock pitch
   deck), assess the skill level demonstrated. For a stock pitch: evaluate thesis clarity,
   valuation methodology (flag and score specific techniques used, e.g., DCF, comps,
   sum-of-the-parts), quality of assumptions, risk analysis, and communication. Output per-skill
   numerical scores with rationale, and automatically add the demonstrated skills (e.g., "DCF
   modeling") as scored tags on the profile.
3. **Referral blocks.** Profiles display professor referrals and company referrals as distinct
   verified endorsements, each showing referrer role and relationship. Peer/self-added skills
   appear as unverified until corroborated.
4. **Trial history.** Completed Covenda work-trials appear as verified entries with company rating
   and skill tags, and they update the relevant skill scores.
5. **Profile builder UX.** Students can add/remove/reorder blocks, upload new artifacts anytime,
   and toggle vertical-specific views of their profile. Founders browse profiles with filters:
   skill, minimum score, vertical, availability, referral source.

**Rules:** Never compute or display a single overall person-score — scores are per-skill only.
Every score must show its evidence. Weight hard-to-fake signals (longitudinal commit history,
trial outcomes, referrals) above one-shot artifacts, and **flag artifacts with signs of being
substantially AI-generated for human review rather than auto-scoring them.**

---

## Build notes for the future session (Claude additions — not part of Tyler's spec)
- **Honesty guardrail is load-bearing here.** A score with no traceable evidence must not render.
  If the model can't cite what justified a score, it doesn't ship. No demo/placeholder scores on
  live profiles.
- **Privacy:** GitHub/artifact analysis runs on student-submitted links only; never scrape or
  compile from sources the student didn't provide. Public cohort/discovery views stay PII-free
  (consistent with the existing cohort page).
- **Sequencing:** the referral layer (1) and trial layer (3) already exist as data in the portal
  (endorsements, completed reviewed projects). The net-new build is the **artifact analysis
  modules (2)** + the **profile builder/discovery UX (5)**. Start with the GitHub module against
  real repos before the generative-artifact (deck) module, since commit history is the hardest-to-
  fake signal and anchors the anti-gaming design.
- **Data model:** per-skill score rows keyed by (student, skill, source_type, evidence_ref,
  scored_at, confidence, stale_flag) — so scores are living and auditable. No overall score column
  by construction.
