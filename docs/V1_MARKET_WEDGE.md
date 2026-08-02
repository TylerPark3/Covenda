# V1 Market Wedge

CEO review, 2026-08-01. Mode: SCOPE REDUCTION. **Revision 2** — corrections from the adversarial
second pass are marked ⚠.

---

## One sentence

> Covenda turns a vague hiring need into one difficult, role-relevant work product, runs a small
> group of strong students through it, and returns **a short, explained shortlist of the strongest
> — each with linked evidence and a written reason they fit this role.**

⚠ Revision 1's version ended at "evidence of how they actually handled it" and contained no
shortlist. D2 is binding — *"the wedge is explainable shortlisting"* — and D11's success metric is
*"≥3 of 5 companies request a second shortlist."* A pilot that produces no shortlist cannot
produce the first of those five. The shortlist is not an addition to the wedge; it **is** the
wedge. What changed is where it is sourced from: work product rather than résumés (D24).

This claims only what can be delivered on day one. The broader claim Alan proposed — *"discover
exceptional talent that resume-based pipelines miss"* — asserts a discovery capability that
requires a placement record Covenda does not have. It becomes true after the pilot, not before.

## The wedge

| | |
|---|---|
| **Vertical** | Software/AI (D3) |
| **Scoped by** | ⚠ **The §2 product contract: 5-75 people, engineering-led, no recruiter.** This, not D3, is what excludes large quant firms (D16) |
| **Segment** | Startup and AI-infrastructure engineering, sub-50 people |
| **Role** | Early-career software engineer, the role already sold once |
| **First user** | CTO or founding engineer |
| **Economic buyer** | The same person |
| **Champion** | The same person |
| **Blocker** | Nobody. That is the entire reason for this segment |
| **Student segment** | ⚠ Students who can complete a difficult, role-relevant work product — **recruited against a real open role, never in general** (D23) |

## Why this segment and not the highest-value one

⚠ **The published matrix scores were wrong and are corrected.**
`docs/strategy/VERTICAL_SELECTION_MATRIX.md` now reads **startup engineering 93, AI infrastructure
68, robotics 61, quant SWE 55** — recomputed as score × weight, summed. Revision 1 cited "107 and
78" and "107 vs 63"; those figures matched no stated method. The winner is unchanged. The
correction flips ranks 3 and 4: **robotics now outranks quant SWE.**

The five criteria that decide whether anything happens at all — accessibility, willingness to
share requirements, sales cycle, pilot probability, founder access — score **5** for startups and
**2 or worse** for quant.

⚠ **But those five cells are one anecdote counted five times.** Revision 1 said "every one of the
startup cells is observed: Covenda has closed a paid deal in this segment." The deal closed over
DMs and email, entirely outside the product. That is evidence about **the founder's personal
network**, not about the segment's structural accessibility, and a single relationship-mediated
sale cannot observe sales-cycle length or pilot probability as *segment properties*. Those five
cells carry weights 3×, 2×, 1×, 3× and 1× — most of the gap the plan calls decisive traces to
n=1, at the heaviest weights.

**What survives that discount:** a market you cannot enter has no economics, and the founder can
demonstrably reach this one. That is a weaker claim than revision 1 made and it still points the
same way. **What is genuinely conceded:** quant's economics are probably better, and this plan is
giving them up. The exclusion rests on the product contract — firm size and recruiter presence —
not on a score.

D17's probe (20 messages, cold-tier on both arms) samples whether *sub-75-person quant firms
without recruiters* are reachable. It is a segment question inside the contract, and it cannot
reopen the vertical.

## The problem, stated as the buyer experiences it

Not "we cannot find good candidates." The founder's own evidence says the expensive step was
**getting the company to define what they wanted**, and Alan's independent argument is that
hiring managers are the only people who know what actually predicts success on their team.

Those are the same claim. A CTO who cannot write down what the work is cannot evaluate anyone
against it, and that is the gap.

⚠ **This rests on one engagement, and the plan now tests it properly.** P1's real falsifier is the
4× rule in `docs/pilot/BRIEF_GAP_LOG.md`, not the founder's recollection (D19).

## Company promise

> Tell us what is hard about the work. We will turn it into one difficult, safe exercise, run a
> small group of strong students through it, and give you **a short, explained shortlist with
> linked evidence** instead of a resume pile. You agree only to review the strongest submissions.
> **No hiring commitment. Free** (D5).

## Student promise

> Do one difficult, real piece of work **against a role that is genuinely open**, with explicit
> rules about AI use, and get a verified record of how you handled it. **The manager has committed
> to review your work, not to hire you.** You are never given a universal score, and nothing here
> follows you to another role (D10). For **this** role the manager picks the submissions they want
> to see more of — and **you decide whether your work is shown to them at all** (D9).

⚠ Two sentences are new. "Against a role that is genuinely open" is the honest form of the ask
(D23); the consent clause is D9, a **permanent** requirement that appeared in none of these
documents. And "nobody is ranked" was removed because the pilot selects the strongest 3-5 from
twenty — D10 forbids a *universal* score, which this respects, but the old sentence was simply not
true. Revision 1 paired "no hiring
commitment" with a request that strong students do difficult unpaid work during term — while the
binding log's mitigation for exactly this risk reads *"recruit against live briefs only, never in
general."* Attaching the brief to a real open role, as Gate 1 already requires, satisfies the
mitigation without promising a job.

## What stays, what is frozen

**Stays:** `brief-engine.js` (`diagnosisGaps`, `evaluateBrief`, `buildRubric`) — the scoping
machine, wired and never used. `evidence.js`, `placement_outcomes`, `project-intake.js`.

**Frozen, not deleted:** compatibility engine (gated on Gate 3 outcomes that do not exist), the
374 simulation scenarios (authored with no manager input), batch admission, batch scoring, the
coursework ontology, 25 specialisations.

⚠ **The pilot may not route through the simulation engine** (D25). Doing so would violate D14 and
§7, both out of scope for 90 days. The pilot is concierge: one task, administered and graded by
hand.

## Kill criteria

| Signal | Meaning | Action |
|---|---|---|
| **Fewer than 5 signed Talent Briefs by day 30** | ⚠ **Gate 1 fails.** The wedge or the segment is wrong | **Stop and re-segment before recruiting a single student** (D21) |
| **⅗+ of managers say their last two hires both came by referral** | ⚠ **Existential (restored), now with a threshold.** The real competitor wins on speed and trust, and no evidence product beats it. Revision 2 restored the risk without a trigger, which makes it a note rather than a criterion | Stop. The wedge is wrong, not the segment (D22, A7) |
| **The pilot role fills by referral before the exercise ends** | Same risk, observed directly rather than reported | Record it as the primary finding of the pilot |
| 0-2 of 20 confirm all five conditions | The gap is not real, or not in this segment | Abandon, re-segment (D18) |
| Managers describe the gap but cannot define a work product | **Most dangerous outcome.** Pain is real, Covenda cannot serve it. Looks like encouragement until the pilot fails | Stop. Reconsider the product, not the segment |
| **Minutes-to-scoped-brief drops >4× between deal 000 and deal 005** | ⚠ **P1 is wrong.** Scoping was a learning tax, not a structural bottleneck | Switch to the sourcing hypothesis (D19) |
| **Fewer than 10 students complete the work product** | ⚠ Supply is the constraint. The pilot proves nothing about discovery | Fix recruitment or shrink the exercise (D23) |
| Confidentiality blocks every realistic exercise | Only toy problems are shareable | Product cannot exist in this form |
| Would use it, would not pay | Interns are cheap, a bad one is survivable | Wedge is a feature, not a company |

## Pricing

⚠ **Absent from revision 1 entirely.** D5 defers pricing to "cohort two," and nothing in this plan
schedules cohort two — so as written the plan reaches day 90 with zero pricing information.

That is accepted for V1. What is **not** acceptable is that these documents argued from the paying
customer without ever stating what they paid.

**Before interview one, record (D26):** the amount, what it bought, how the number was arrived at,
and whether they would pay it again. It is the only pricing datum Covenda owns.

## Success

Unchanged: **D11 — ≥3 of 5 companies request a second shortlist.** One pilot cannot satisfy it.
It can produce the first of the five — and only if the pilot actually produces a shortlist, which
is why D24 restored it to the wedge sentence.
