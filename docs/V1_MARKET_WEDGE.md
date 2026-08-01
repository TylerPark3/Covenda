# V1 Market Wedge

CEO review, 2026-08-01. Mode: SCOPE REDUCTION.

---

## One sentence

> Covenda turns a vague hiring need into one difficult, role-relevant work product, runs a small
> group of strong students through it, and returns evidence of how they actually handled it.

This claims only what can be delivered on day one. The broader claim Alan proposed — *"discover
exceptional talent that resume-based pipelines miss"* — asserts a discovery capability that
requires a placement record Covenda does not have. It becomes true after the pilot, not before.

## The wedge

| | |
|---|---|
| **Vertical** | Software/AI. **D3, unchanged** |
| **Segment** | Startup and AI-infrastructure engineering, sub-50 people |
| **Role** | Early-career software engineer, the role already sold once |
| **First user** | CTO or founding engineer |
| **Economic buyer** | The same person |
| **Champion** | The same person |
| **Blocker** | Nobody. That is the entire reason for this segment |
| **Student segment** | Students who can complete a difficult, role-relevant work product |

## Why this segment and not the highest-value one

The weighted matrix in `docs/strategy/VERTICAL_SELECTION_MATRIX.md` scored startup engineering
**107** and quant SWE **63**. Quant wins on economics and loses on entry.

The five criteria that decide whether anything happens at all — accessibility, willingness to
share requirements, sales cycle, pilot probability, founder access — score **5** for startups and
**2 or worse** for quant. Every one of those quant cells is a guess. Every one of the startup
cells is observed: Covenda has closed a paid deal in this segment.

**A market you cannot enter has no economics.** D17 buys the missing number for the price of five
messages rather than fifteen interviews.

## The problem, stated as the buyer experiences it

Not "we cannot find good candidates." The founder's own evidence says the expensive step was
**getting the company to define what they wanted**, and Alan's independent argument is that
hiring managers are the only people who know what actually predicts success on their team.

Those are the same claim. A CTO who cannot write down what the work is cannot evaluate anyone
against it, and that is the gap.

## Company promise

> Tell us what is hard about the work. We will turn it into one difficult, safe exercise, run a
> small group of strong students through it, and give you evidence-linked results instead of a
> resume pile. You agree only to review the strongest submissions. **No hiring commitment. Free**
> (D5).

## Student promise

> Do one difficult, real piece of work, with explicit rules about AI use, and get a verified
> record of how you handled it. Nobody is ranked. **You are never scored** (D10).

## What stays, what is frozen

**Stays:** `brief-engine.js` (`diagnosisGaps`, `evaluateBrief`, `buildRubric`) — the scoping
machine, wired and never used. `evidence.js`, `placement_outcomes`, `project-intake.js`.

**Frozen, not deleted:** compatibility engine (gated on Gate 3 outcomes that do not exist), the
374 simulation scenarios (authored with no manager input), batch admission, batch scoring, the
coursework ontology, 25 specialisations.

## Kill criteria

| Signal | Meaning | Action |
|---|---|---|
| 0-2 of 30 confirm all five conditions | The gap is not real, or not in this segment | Abandon, re-segment (D18) |
| Managers describe the gap but cannot define a work product | **Most dangerous outcome.** Pain is real, Covenda cannot serve it. Looks like encouragement until the pilot fails | Stop. Reconsider the product, not the segment |
| Existing customer says scoping was easy | **P1 is wrong** | Switch to the sourcing hypothesis (D19) |
| Confidentiality blocks every realistic exercise | Only toy problems are shareable | Product cannot exist in this form |
| Would use it, would not pay | Interns are cheap, a bad one is survivable | Wedge is a feature, not a company |

## Success

Unchanged: **D11 — ≥3 of 5 companies request a second shortlist.** One pilot cannot satisfy it.
It can produce the first of the five.
