# Concierge Pilot Options

Section G of `02_OFFICE_HOURS_PROMPT.md`. The smallest thing that produces a real outcome.

Labels: **[ADVISOR]** **[EVIDENCE]** **[INFERENCE]** **[UNKNOWN]**

**Nothing here starts until the validation threshold is met.** Five managers, five conditions,
independently. Building a pilot before that is the mistake this whole pack exists to prevent.

---

## What a pilot has to produce

Not a demo. One row in `placement_outcomes` — a real student, a real work product, a real
manager's judgment, recorded. **[EVIDENCE]** That table has existed since 2026-07-27 and has
never been written to. Every strategy document in this repository is downstream of a dataset
with zero rows.

---

## Option 1 — Manager-Designed Work Product *(recommended)*

One manager defines one difficult, safe, role-relevant task. 10-20 strong students attempt it
with explicit AI-use rules. Covenda verifies the work. The manager reviews the strongest 3-5
against a rubric they wrote, and answers one question: *would you request this student again?*

| | |
|---|---|
| Effort | human ~3 weeks / CC ~4 hours |
| Risk | Medium |
| Uses | `brief-engine.js` to define, simulation engine to run, `evidence.js` to grade, `placement_outcomes` to record |
| Produces | 10-20 evidence records, one manager rubric, 3-5 judged submissions, **the first real label** |

**Why this one. [EVIDENCE]** It writes the label the compatibility engine was designed around —
*"the deliverable was accepted AND the employer said they would request that student again"* —
and that label is the gating constraint named in Covenda's own engine documentation. **[INFERENCE]**
It also uses four systems that already exist and have never run together, which is the cheapest
possible test of whether they actually connect.

**Risks.** The manager writes a rubric they will not honour. Students self-select and the sample
says nothing about discovery. Confidentiality forces a task so generic it proves nothing. All
three are visible during the pilot, which is the point.

## Option 2 — Shadow Shortlist

Manager runs their normal hiring. In parallel, Covenda produces a shortlist by its own method.
Afterwards, compare: did Covenda surface anyone they missed, and would they have interviewed them?

| | |
|---|---|
| Effort | human ~2 weeks / CC ~2 hours |
| Risk | Low |
| Produces | A direct answer to "does your pipeline miss people", the exact claim Alan says to sell |

**[INFERENCE]** This is the purest test of the overlooked-talent thesis and the weakest test of
the product, because it needs no simulation, no rubric and no student work. It answers whether
the *problem* is real without demonstrating that Covenda can *solve* it. Strong first pilot for a
sceptical manager; poor evidence for the engine.

## Option 3 — Scoping-Only Engagement

Sell the brief alone. A manager pays for one scoped, defensible work definition. No students.

| | |
|---|---|
| Effort | human ~1 week / CC near zero |
| Risk | Medium |
| Produces | A priced answer to whether the expensive step is independently valuable |

**[EVIDENCE]** This is the same Approach C from the 2026-07-31 design doc, which found that
scoping was the founder's expensive step. **[INFERENCE]** If a manager pays for a brief and then
asks "can you staff this?", the wedge is validated and inbound is created in one move. Risk: it
repositions Covenda as a consultancy, and consultancies do not compound.

## Option 4 — Full Loop

Brief → shortlist → introduction → paid trial → outcome, end to end, in-product.

| | |
|---|---|
| Effort | human ~6 weeks / CC ~1 day |
| Risk | **High** |
| Produces | Everything, if it works |

**[EVIDENCE]** Nothing in the product has ever run authenticated end-to-end. **[INFERENCE]**
Attempting the full loop as a first pilot means debugging software in front of the first hiring
manager who ever agreed to try it. Correct as pilot #3, not pilot #1.

---

## Recommendation

**Option 1**, with Option 2 as the opener for a manager who will not commit to defining a task.

**[INFERENCE]** They compose: run the shadow shortlist first, and the same manager who sees
Covenda surface someone they missed is far more likely to spend an hour defining a work product.
Option 2 buys the credibility that Option 1 requires.

## The ask

From `04_HIRING_MANAGER_OUTREACH_STRATEGY.md`, unchanged because it is correctly scoped:

> Help us define one difficult, safe, role-relevant work product. We will recruit a small group
> of strong students, administer it, verify the work, and return a structured set of results.
> You agree only to review the strongest submissions and provide feedback. No hiring commitment
> is required.

**[INFERENCE]** The last sentence is what makes it answerable. A pilot that requires a hiring
commitment is a hiring decision, and no manager makes one on behalf of an unproven vendor.

## Success criteria

| | Bar |
|---|---|
| Primary | ≥1 row in `placement_outcomes` with a real `result` and a real `introduction_id` |
| Manager | Reviews the submissions and answers the request-again question **without being chased** |
| Discovery | ≥1 student the manager says they would have interviewed and would not have found |
| Product | The scoping conversation runs through `project-intake.js`, and every gap is logged |
| **Falsifying** | Manager cannot define a task, or defines one so generic it proves nothing |

## What does not count

- A manager saying it was interesting.
- Students completing work nobody reviewed.
- A shortlist nobody acted on.
- Anything that does not end in a recorded outcome.

**[EVIDENCE]** The approved success metric is unchanged and is the only one that matters:
**≥3 of 5 companies request a second shortlist.** One pilot cannot satisfy it. It can produce the
first of the five.
