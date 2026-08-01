# V1 Decision Ledger

CEO review, 2026-08-01. Mode: **SCOPE REDUCTION**. Branch `strategy/alan-zhang-feedback`.

Supersedes nothing. **Extends** the approved log in `docs/v1-planning/02_CEO_REVIEW.md` (D1-D15),
which remains binding.

---

## The correction this review exists for

`docs/strategy/` produced five documents that built a seven-vertical selection matrix and
recommended letting 30 interviews choose the vertical.

**D3 had already decided it: "One vertical: software/AI."**

Those five documents reference D3 zero times. The vertical question was re-opened without
naming the decision being re-opened, which is the failure the decision log exists to prevent.

Consequences, once D3 is honoured:

- **Startup engineering and AI infrastructure already comply.** They were the matrix's top two
  on weighted score (107 and 78). No new decision was ever needed for them.
- **Quant SWE is the only candidate that might require superseding D3.** It is software
  engineering, so it arguably complies; as a *vertical* it is quantitative finance, with
  different access, confidentiality and sales cycles. That ambiguity was the real question.
- **15 interviews were about to be spent re-deciding a settled question.**

## The 30-day decision

| # | Question | Decision |
|---|---|---|
| 1 | Primary vertical | **Software/AI. D3 stands.** Startup engineering and AI infrastructure |
| 2 | Exact role | **Early-career software engineer at a sub-50-person company**, the role the paying customer already bought |
| 3 | First company-side user | **The CTO or founding engineer.** At this size they are user, buyer, champion and evaluator at once |
| 4 | Economic buyer | **Same person.** No recruiter to route around, no compliance gate |
| 5 | Problem solved first | **Defining the work.** Turning a vague ask into a scoped, defensible brief |
| 6 | Components that stay relevant | `brief-engine.js`, `project-intake.js`, `evidence.js`, `placement_outcomes` |
| 7 | Not built before discovery | Anything vertical-specific, new scenarios, onboarding, automation of any step |
| 8 | Must be learned from managers | Whether their screening misses people, and whether they can define a work product |
| 9 | Abandon signal | Fewer than 3 of 30 confirm all five conditions |
| 10 | Smallest pilot | One manager defines one work product; 10-20 students attempt it; manager judges 3-5 |

## New decisions

| # | Decision | Status |
|---|---|---|
| **D16** | D3 stands. Software/AI is the vertical; the office-hours matrix does not reopen it | Decision |
| **D17** | Quant SWE is tested by a **bounded probe of 5 outreach messages**, measured on response rate only. Beating the software/AI rate is grounds to open a D3 supersession; anything else closes it on evidence | Decision |
| **D18** | Validation threshold has three branches, not two. **5+ confirmations → build. 3-4 → extend by 15 interviews, do not build. 0-2 → abandon and re-segment** | Decision |
| **D19** | **The P1 fallback is written before the first interview, not after.** If the paying customer says scoping was easy, the alternative hypothesis is that sourcing was the expensive step and the wedge is the shortlist, not the brief | Decision |
| **D20** | The pilot is **free**, per D5. `CONCIERGE_PILOT_OPTIONS.md` Option 3 (selling a scoped brief) contradicts D5 and is **withdrawn from V1** | Decision |

### On D19

A fallback written after an inconvenient answer is a rationalisation. Written before, it is a
hypothesis. The distinction is the whole value, and this project has already spent a planning
cycle on findings that survived because nobody wrote down in advance what would kill them.

If scoping was easy for the one customer who paid, then P1 is wrong, the office-hours session
that produced it was wrong, and this review is wrong. The response is not to patch the plan.
It is to run the 30 interviews against the *sourcing* hypothesis instead, using the same script.

### On D20

`CONCIERGE_PILOT_OPTIONS.md` proposed selling a scoped brief as a standalone product. D5 says
the pilot is free and the price is a written commitment plus a 5-day SLA. Charging contradicts
an approved decision, and the strategy document did not notice. Withdrawn.

The idea is not dead; it is out of V1. It is recorded in `docs/V1_PILOT.md` as a post-pilot
question.

## What Alan changed, and what he did not

**Adopted:** hiring managers over recruiters; overlooked-talent discovery over cost reduction;
difficult role-specific evidence; prestige halo over early network effects.

**Not adopted:** quant SWE as the vertical, pending D17's probe.

**Worth stating:** Alan advised without knowing Covenda had a paying customer, that the deal
closed outside the product, or that a simulation engine with 374 scenarios already existed. His
method survives all three. His vertical choice was made without any of them.

## Non-goals for 30 days

- No vertical-specific product.
- No new scenario authoring. 374 unvalidated ones exist.
- No onboarding product before one completed placement.
- No charging for the pilot (D5, D20).
- No code. Every assumption below requires discovery first.

## Assumptions requiring discovery before any implementation is approved

Per the CEO prompt, implementation is **not approved** until these are tested with real managers:

| # | Assumption | Tested by |
|---|---|---|
| A1 | Managers experience a gap between who they surface and who could succeed | Interview Q7-Q10 |
| A2 | They can define a nontrivial work product | Q11-Q14 |
| A3 | They will review results without being chased | Pilot behaviour, not stated intent |
| A4 | Scoping is expensive for them, not just for Covenda | Q9-addendum |
| A5 | Confidentiality does not block every realistic exercise | Q12, Q23 |
| A6 | The role recurs often enough to justify a reusable system | Q21 |

**None of these has been tested once.** The product has 83 endpoints built against zero of them.
