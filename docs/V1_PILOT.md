# V1 Pilot

CEO review, 2026-08-01. Mode: SCOPE REDUCTION.

**Does not start until D18's threshold is met.** Building before that is the mistake this entire
review exists to prevent.

---

## Shape

One manager defines one difficult, safe, role-relevant work product. 10-20 strong students
attempt it under explicit AI-use rules. Covenda verifies the work. The manager reviews the
strongest 3-5 against a rubric they wrote and answers one question: **would you request this
student again?**

**Free** (D5, D20). The price is a written commitment and a 5-day SLA.

## The ask

> Help us define one difficult, safe, role-relevant work product. We will recruit a small group
> of strong students, administer it, verify the work, and return a structured set of results. You
> agree only to review the strongest submissions and provide feedback. No hiring commitment is
> required.

The last sentence is what makes it answerable. A pilot requiring a hiring commitment is a hiring
decision, and nobody makes one for an unproven vendor.

## Opening move for a sceptical manager

Run a **shadow shortlist** first: they hire normally, Covenda produces a shortlist in parallel,
and afterwards you compare — did Covenda surface anyone they missed, and would they have
interviewed them?

It needs no simulation, no rubric and no student work. It is the purest test of the
overlooked-talent claim and the weakest test of the product. A manager who watches Covenda
surface someone they missed is far more likely to spend an hour defining a work product.

## What it uses

Everything already exists and has never run together:

```
 manager ──▶ brief-engine.js ──▶ scoped brief ──▶ students ──▶ evidence.js ──▶ placement_outcomes
             (diagnosisGaps,                                                     (result +
              evaluateBrief,                                                   introduction_id)
              buildRubric)
```

**Zero new endpoints.** The 2026-08-01 work already made outcome recording idempotent and added
the audit taxonomy. Nothing further is approved until discovery validates A1-A6.

## Instrument

`docs/pilot/BRIEF_GAP_LOG.md`. Every question the founder asks that `diagnosisGaps` did not is
logged. That list is the engine's next question set, or the evidence that scoping is judgment
rather than a question set.

## Success

| | Bar |
|---|---|
| **Primary** | ≥1 row in `placement_outcomes` with a real `result` and `introduction_id` |
| Manager | Reviews submissions and answers the request-again question **without being chased** |
| Discovery | ≥1 student the manager would have interviewed and would not have found |
| Product | The scoping conversation runs through `project-intake.js`; every gap logged |
| **Falsifying** | Manager cannot define a task, or defines one so generic it proves nothing |

The label the compatibility engine was designed around is *"the deliverable was accepted AND the
employer said they would request that student again."* The pilot's job is to write that label
once, for real.

## What does not count

- A manager saying it was interesting.
- Students completing work nobody reviewed.
- A shortlist nobody acted on.
- Anything not ending in a recorded outcome.

## Risks

| Risk | Mitigation |
|---|---|
| Manager writes a rubric they will not honour | Visible during the pilot. That is the point |
| Students self-select, so the sample says nothing about discovery | Compare against their own pipeline (shadow shortlist) |
| Confidentiality forces a task so generic it proves nothing | Named as a falsifying outcome, not a setback |
| **The founder is the single point of failure** | Accepted for a concierge pilot. Revisit at month 2 |

## Deferred to after the pilot

- **Selling a scoped brief standalone.** Withdrawn from V1 by D20 because it contradicts D5.
  Reconsider once one pilot has run: if a manager pays for a brief and then asks "can you staff
  this?", the wedge is validated and inbound is created in one move.
- **Onboarding.** Requires knowing what a role demands, which is discovery's output. Promote only
  if 5+ managers name a specific costed onboarding delay unprompted and at least one says it
  hurts more than mis-hiring.
- **Full loop in-product.** Nothing has ever run authenticated end to end. Correct as pilot #3,
  not pilot #1: attempting it first means debugging software in front of the first manager who
  ever agreed to try it.
