# Office Hours — Covenda V1

Output of `01_OFFICE_HOURS.md`. Read against `docs/COVENDA_MASTER_SPEC.md`, `docs/COVENDA_GSTACK_CONTEXT.md`, the repository, and the live product at covenda.app.

---

## The finding that governs everything else

| Built | Transacted |
|---|---|
| 83 API endpoints | 0 completed trials |
| 63 migrations | 0 students who finished work |
| 1,323 tests | 0 companies who accepted a deliverable |
| 6,504-line portal | 0 non-illustrative examples on the site |

The spec is unusually clear about sequencing. Chapter 34 defines Phase 0 (foundation), then Phase 1 as *25–50 students, 5–10 companies, manual Company DNA, manual shortlists, manual evidence review*. Phase 5 is the Software and AI batch. Phase 6 is additional verticals.

The product has built into Phase 5 and 6 — 25 specialisations, batch admission scoring, simulations, an ontology — while **Phase 1's exit gate has never been attempted**. That gate reads:

> at least several completed evaluations; companies rate shortlists as relevant; at least two companies request additional help; students find the profile independently useful.

None of those four has a single data point. This is not a criticism of the code, which is careful and well-tested. It is the observation that every feature built since Phase 1 was designed to improve outcomes that have never occurred, so none of it has been corrected by contact with a real transaction.

Chapter 1.5 instruction 15 says it directly: *build the smallest workflow that creates verified outcomes, then expand.* The build ran ahead of that instruction.

**The constraint is not engineering capacity. It is that nothing has been falsified yet.**

---

## Problem

Early-career hiring is an information problem, not a volume problem (Ch. 2.1). Students compress rich, distributed work into a one-page résumé; companies receive high application volume with low usable signal, increasingly AI-polished. Four defects: compression, fragmentation, asymmetry, decay.

The version of this Covenda can actually attack in 90 days is narrower:

> A technical founder at a 5–75 person startup has real near-term work, no recruiting infrastructure, and no reliable way to tell which of 200 applicants can actually do the work. They fall back on referrals, because a referral is the only signal they trust.

Covenda's wedge is producing a signal a founder trusts **more than a referral**, for candidates they would never have met.

---

## First user

**Not students. The founder.**

This is the sharpest disagreement with the current build, which is student-surface-heavy: onboarding flow, batch applications, coursework ontology, evidence ladders, readiness scoring.

The reasoning:

- Students are abundant and, per Ch. 29.6, reachable through the founder's Columbia network at near-zero cost. Supply is not the constraint.
- Companies are the scarce side. A student with no company demand receives nothing of value, and the profile becomes homework.
- The founder is the only actor who can *pay* and who generates the outcome data every downstream system needs.

Concretely: **an engineering-led startup of 5–75 people in NYC, with one open early-career role or one bounded piece of real work, and no dedicated recruiter.**

The first *student* is the high-agency Columbia builder with public work — GitHub, a lab, a hackathon record — who is currently invisible because their strongest work is not résumé-shaped.

---

## Wedge

**Explainable shortlisting. One wedge, not a combination.**

Prompt 01 asks which of discovery, evidence verification, shortlisting, Company DNA, paid trials, or a combination. The answer is shortlisting, because it is the only one that:

- delivers value to the scarce side (the company) on day one;
- can be delivered **entirely manually** by the founder (Ch. 29.3 concierge);
- produces the outcome data every other layer needs;
- is falsifiable inside 90 days.

The others are consequences, not the wedge:

- **Discovery** is what the shortlist does, from the company's side.
- **Evidence verification** is the *input* to a credible shortlist, not a product a company buys.
- **Company DNA** is the founder interview that produces the shortlist. It is an internal artifact in V1, not a feature.
- **Paid trials** are optional (spec non-negotiable) and belong to Phase 3.

---

## Core transaction

Straight from Ch. 3.3, unchanged:

```
A verified company defines a real talent need
  -> Covenda identifies a small set of students with traceable evidence
  -> the company requests an introduction
  -> the student approves or declines
  -> evaluation occurs through interview, existing assessment, or paid trial
  -> the outcome becomes structured evidence and hiring memory
```

In V1 the middle step is **a human doing the work**, not the compatibility engine. The engine is measured against the human, not trusted ahead of it.

---

## Status quo

What a founder does today instead:

| Channel | Why they use it | Where it fails |
|---|---|---|
| Referrals | Trusted signal | Doesn't scale, narrow network, homogeneous |
| LinkedIn | Reach | No evidence of ability; keyword theatre |
| Wellfound | Startup-intent candidates | Volume without signal |
| Handshake | Campus reach | Optimised for large-employer campus recruiting |
| Direct outreach | Precision | Enormous founder time per candidate |

**Referrals are the real competitor.** Not a job board. A founder uses a referral because someone they trust vouched with context. Covenda wins only if an evidence-linked shortlist feels *as trustworthy as* a referral while surfacing people outside the network.

That framing has a consequence the current build contradicts: a founder does not want 40 batch-admitted candidates. They want **five**, with the reasoning attached.

---

## Why now

- AI-generated applications have collapsed the signal value of résumés and cover letters — the compression defect is getting worse fast (Ch. 2.1).
- Students now genuinely can use frontier tools (Ch. 1.5 instruction 6), so *demonstrated ownership and judgment* is the only durable differentiator, and nobody is capturing it.
- Small technical startups have real work and no recruiting infrastructure — the exact gap where a concierge service can outperform tooling.

---

## 90-day pilot

Explicitly Ch. 34.3 Phase 1, run manually.

**Days 1–30 — demand first**
- 8 founder-led company conversations; **5 signed** to a written Talent Brief
- Each Talent Brief produced by a 45-minute founder interview (manual Company DNA)
- Success: 5 companies with a real, near-term, named need

**Days 31–60 — supply against real demand**
- Recruit **30 students** from Columbia clubs, labs, hackathons — *matched to the 5 briefs*, not in general
- Manually verify at least one evidence item per student
- Deliver **5 shortlists of 5**, each candidate carrying written reasoning tied to evidence
- Success: ≥3 companies say the shortlist was relevant; ≥1 requests a second

**Days 61–90 — outcomes**
- Support introductions, capture every outcome
- Success: **≥10 introductions accepted, ≥5 evaluations completed, ≥1 hire, project, or paid trial**

The founder does all of it by hand. The product's only V1 job is to hold the evidence and the record.

---

## Explicit cuts

Cut for the 90 days. Not deleted — dormant, and honestly labelled.

| Cut | Why |
|---|---|
| 25 specialisations | Ch. 34.8 is Phase 6. Pick **one**: software/AI. |
| Batch admission scoring | Optimises a funnel with no demand behind it |
| Simulations & assessments | Phase 4. No shortlist has been validated to feed them. |
| Coursework ontology | A course is a question generator, not evidence (per repo's own note) |
| Open roles / Greenhouse sync | Aggregating other people's jobs is not the wedge |
| Super-intern, ATS push, Stripe Connect | Phase 3+ infrastructure |
| Credits / escrow / payouts | Paid trials are optional; defer with them |
| Public batch catalogue | Publishes a bar nobody has cleared |
| `api/evidence.js` vs `studentEvidenceTier` | Two evidence ladders. Collapse to one **before** more evidence UI. |

Unwired-but-built modules (`batch-churn`, `ml-data`, `analyze-model`, `proof-methods`) stay unwired. They are not debt while dormant; they become debt the moment they are wired to serve outcomes that do not exist.

**The site must stop showing illustrative examples as though they were real.** Every example is currently labelled illustrative because it is. Five real, consented, evidence-linked profiles beat fifty synthetic ones, and the first real shortlist makes them real.

---

## Falsifiable assumptions

| # | Assumption | Falsified if |
|---|---|---|
| A1 | Founders will pay attention to an evidence-linked shortlist | <3 of 5 rate it relevant |
| A2 | Evidence changes decisions | Founders shortlist the same people from résumés alone |
| A3 | Strong students will build a profile before liquidity | <30 complete without founder chasing |
| A4 | Manual verification is affordable | >45 min per student |
| A5 | This beats referrals | Founders fill the role by referral during the pilot |
| A6 | Companies return | Zero second requests |

A5 is the one to watch. It is the assumption the whole company rests on and the one most likely to be false.

---

## Success and kill criteria

**Success (day 90) — all four:**
1. ≥3 of 5 companies request a second shortlist
2. ≥5 completed evaluations
3. ≥1 hire, project, or paid trial
4. ≥1 company states the shortlist changed who they talked to

**Kill / rethink (Ch. 29.10):**
- No company requests a second shortlist
- Students do not approve introductions
- Evidence does not change decisions
- Verification cost exceeds value
- Strong students prefer ordinary networking

**The honest kill signal:** if 5 founders each get 5 evidence-backed candidates and still hire through referrals, the wedge is wrong — and no amount of the remaining blueprint fixes it.

---

## What the founder should hear

Three things, plainly.

**1. You have built a Phase 5 product and never cleared Phase 1.** Your own spec told you not to. The fix is not more building; it is 5 companies and 30 students.

**2. Your competitor is the referral, not the job board.** Every design decision should be judged against "is this as trustworthy as a friend vouching?" — which argues for five candidates with reasoning, not a ranked pool.

**3. Nothing in the product has been corrected by reality yet.** 1,323 tests prove the code does what it was told. None prove it was told the right thing. The first real shortlist will invalidate assumptions that are currently invisible, and that is worth more than the next month of features.

---

## Recommended next command

`/plan-ceo-review` with `docs/gstack-prompts/02_CEO_REVIEW.md`.

Carry forward for scope-reduction review: **founder-first**, **shortlisting wedge**, **one vertical**, **manual operations**, and the cut list above.
