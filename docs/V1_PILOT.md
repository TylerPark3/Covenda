# V1 Pilot

CEO review, 2026-08-01. Mode: SCOPE REDUCTION. **Revision 2** — corrections from the adversarial
second pass are marked ⚠.

**Three things gate this pilot. All three must hold before it starts.**

1. **D18's threshold** — 5+ confirmations of all five conditions.
2. ⚠ **Gate 1** — five signed Talent Briefs, each with a real role, named evaluator and 5-day SLA,
   decided on day 30 (D21, D27). Revision 1 gated the pilot on D18 alone and never named Gate 1.
3. ⚠⚠ **D15 and Gate 0** — the accessibility path for the required walkthrough must exist *before*
   the pilot (D15 is a binding Requirement), and Gate 0 is currently marked **failing on two
   counts** in `02_CEO_REVIEW.md`. Neither appeared anywhere in revision 2 of this document (D30).

Building before all three is the mistake this entire review exists to prevent.

---

## Shape

One manager defines one difficult, safe, role-relevant work product. 10-20 strong students attempt
it under explicit AI-use rules. Covenda verifies the work, **selects the strongest 3-5 and returns
them as an explained shortlist** — each with linked evidence and a written reason they fit this
role, judged against a rubric the manager wrote. The manager answers one question: **would you
request this student again?**

⚠ The shortlist framing is not decoration. D2 is binding (*"the wedge is explainable
shortlisting"*) and D11 measures second-shortlist requests. Revision 1 described the pilot as
returning "a structured set of results" and demoted shortlisting to an optional warm-up — which
made D11 unmeasurable by the pilot meant to produce its first data point (D24).

**Free** (D5, D20). The price is a written commitment and a 5-day SLA.

## ⚠⚠ Student consent gates the shortlist (D9, D29)

D9 is a **permanent requirement** — student consent on every introduction — and §2 restates it:
*"the student approves every introduction before contact."* The word "consent" appeared nowhere in
revision 2 of these documents, while this pilot has Covenda select 3-5 students and hand their work
to a manager.

**No student's work, name or evidence reaches the manager without that student's explicit approval
of that specific introduction.** Consent is per-introduction, not a blanket agreement collected at
recruitment. A student may decline and stay in the exercise.

⚠ **And the student promise must stop saying something this pilot makes false.** "Nobody is ranked"
sits opposite a pilot that selects "the strongest 3-5" from twenty against a manager's rubric.
Fifteen of twenty are cut by a ranking. D10 forbids a **universal** score — a per-role selection is
compliant with D10 — but the sentence as written is not true and students would be right to say so.
The honest version:

> You are never given a universal score, and nothing here follows you to another role. For **this**
> role, the manager picks the submissions they want to see more of — and you decide whether your
> work is shown to them at all.

## ⚠ Concierge only — this may not touch the simulation engine

D14 cut simulations and assessments to Phase 4; §7 puts everything in it out of scope for 90 days.
This pilot administers a difficult work product and verifies it, which **is** an assessment, and
`CONCIERGE_PILOT_OPTIONS.md:31` proposed running it through the simulation engine.

The distinction D14 cut is *the productised engine* — 374 authored scenarios, batch scoring, the
taxonomy. **One manager-authored task, administered and graded by hand, is concierge work and is in
scope. Routing it through the engine, or authoring a scenario for it, is not** (D25). If the pilot
cannot run without the engine, it is out of scope and gets redesigned.

⚠ **This narrowing needs an authority it does not have, and a tripwire it did not have.** D14 cut
"simulations **and assessments**"; reading it as cutting only *the productised engine* is exactly
the interpretive move this review condemned when it was applied to D3. It is recorded as an
interpretation, not a fact — **if the founder disagrees, D25 is wrong and the pilot is out of scope
until D14 is formally superseded.**

Enforcement, since a solo founder self-certifying against 374 existing scenarios is precisely the
**High**-severity "sunk-cost pull toward built features" named in `02_CEO_REVIEW.md:161`:

- **No new scenario file.** If the pilot adds one, it has become the engine.
- **No batch scoring, no admission logic, no compatibility call** anywhere in the pilot path.
- `buildRubric` may **draft** a rubric; **the manager rewrites it in their own words** and that
  version is what judges the work. A machine-generated rubric the manager merely approves is the
  engine wearing a concierge label.
- The pilot's artifacts are a document and a spreadsheet. If it needs a deploy, stop.

## The ask

> Help us define one difficult, safe, role-relevant work product **for a role you actually have
> open**. We will recruit a small group of strong students, administer it, verify the work, and
> return a short explained shortlist of the strongest. You agree only to review those submissions
> and provide feedback. No hiring commitment is required.

⚠ "For a role you actually have open" is new and load-bearing — see student supply below. The last
sentence is what makes the ask answerable: a pilot requiring a hiring commitment is a hiring
decision, and nobody makes one for an unproven vendor.

## ⚠ Student supply — the side revision 1 did not plan

Revision 1 required "10-20 strong students" and said nothing about where they come from, what
fraction complete, or what happens if fewer than 10 finish. There was no student-side kill
criterion. It also silently inverted a binding mitigation. `02_CEO_REVIEW.md:158`:

> Students won't build without liquidity → **recruit against live briefs only, never in general.**

A brief with no hiring commitment is not a live brief. As written, the plan asked strong students
to do difficult unpaid work, during term, for an unproven company, with an explicit guarantee that
no job was attached.

**Resolution — Gate 1 already fixes it.** Gate 1 requires a real role with a named evaluator, so
the brief attaches to a genuinely open role and students hear the truth: *this role is real and
open; the manager has committed to review your work, not to hire you.* Live brief, no false
promise.

| | Bar |
|---|---|
| Recruit | Against **this specific open role**, never in general (D23) |
| Target | 10-20 attempts, ≥10 completions |
| Measure | Attempts, completions, completion rate, median hours spent |
| **Kill** | **Fewer than 10 completions** — the pilot says nothing about discovery regardless of what the manager concludes |
| If completion <50% | The exercise is mis-scoped. The next one shrinks |

Timing is a real risk and is not solved: term begins inside the pilot window, and the students most
able to do difficult work are the ones with the least free time in September.

## What it uses

Everything already exists and has never run together:

```
 manager ──▶ brief-engine.js ──▶ scoped brief ──▶ students ──▶ evidence.js ──▶ placement_outcomes
             (diagnosisGaps,                                                     (result +
              evaluateBrief,                                                   introduction_id)
              buildRubric)
```

**Zero new endpoints.** The 2026-08-01 work already made outcome recording idempotent and added the
audit taxonomy. Nothing further is approved until discovery validates A1-A8.

## Instrument

`docs/pilot/BRIEF_GAP_LOG.md`. Every question the founder asks that `diagnosisGaps` did not is
logged. That list is the engine's next question set, or the evidence that scoping is judgment
rather than a question set.

⚠ **Run Deal 000 before the pilot, before discovery, before anything.** The log's first section
designs a one-hour retrospective run of the already-closed deal through `project-intake.js`. It is
currently blank. It needs nobody's calendar.

⚠ **The 4× rule is the pre-registered falsifier of P1**, imported here from the same file: if
minutes-to-scoped-brief drops more than 4× between deal 000 and deal 005, scoping was a learning
tax rather than a structural bottleneck, and this pilot's premise collapses. Track the table.
Revision 1 replaced this with "ask the customer whether it was easy," which is one subjective
recollection from the person the founder personally scoped for.

## Success

| | Bar |
|---|---|
| **Primary** | ≥1 row in `placement_outcomes` with a real `result` and `introduction_id` |
| Manager | Reviews the shortlist and answers the request-again question **without being chased** |
| Discovery | ≥1 student the manager would have interviewed and would not have found |
| Product | The scoping conversation runs through `project-intake.js`; every gap logged |
| Students | ⚠ ≥10 completions |
| **Falsifying** | Manager cannot define a task, or defines one so generic it proves nothing |

The label the compatibility engine was designed around is *"the deliverable was accepted AND the
employer said they would request that student again."* The pilot's job is to write that label once,
for real.

⚠ **D11 is measurable at n=1 and still unreachable at n=5.** D11 requires ≥3 of **5** companies to
request a second shortlist. Five shortlists means five bespoke tasks and 50-100 hand-graded student
submissions, run by one undergraduate. D24 made D11 *measurable* by the pilot; it did not make it
*reachable*. One pilot produces the first of five, and the remaining four are not scheduled,
staffed or costed anywhere. **That is the honest position — D11 stands as the bar and V1 does not
reach it.**

## What does not count

- A manager saying it was interesting.
- Students completing work nobody reviewed.
- A shortlist nobody acted on.
- Anything not ending in a recorded outcome.

## Risks

| Risk | Mitigation |
|---|---|
| **⚠ Referrals win — the role fills before the pilot ends** | **Existential** in the binding log and dropped from every V1 document. Ask every manager how their last two hires arrived; if pilot roles fill by referral, the wedge is wrong (D22, A7) |
| Manager writes a rubric they will not honour | Visible during the pilot. That is the point |
| **⚠ Fewer than 10 students complete** | Recruit against the real open role; measure completion; shrink the exercise if under 50% (D23) |
| Students self-select, so the sample says nothing about discovery | Compare against their own pipeline (shadow shortlist) |
| Confidentiality forces a task so generic it proves nothing | Named as a falsifying outcome, not a setback |
| **The founder is the single point of failure** | ⚠ Revision 1 mitigated this with "Accepted. Revisit at month 2," which is not a mitigation. The pre-committed slip branches are in `V1_DISCOVERY_PLAN.md` § Capacity. **The underlying constraint is real and unresolved** |

## Opening move for a sceptical manager

Run a **shadow shortlist** first: they hire normally, Covenda produces a shortlist in parallel, and
afterwards you compare — did Covenda surface anyone they missed, and would they have interviewed
them?

It needs no work product and no student recruitment, which makes it the cheapest test of the
overlooked-talent claim and a weak test of the full loop. A manager who watches Covenda surface
someone they missed is far more likely to spend an hour defining a work product.

⚠ It also **doubles as the referral instrument**: running alongside a real hire tells you directly
whether the role fills by referral first (A7).

## ⚠⚠ Unresolved: unpaid student work on a real open role

Two adversarial rounds and seven documents contain nothing on this, and D23's fix — attaching the
exercise to a **genuinely open role** — *increases* the exposure rather than reducing it, because
"unpaid work for a real vacancy at a for-profit company" is the fact pattern these rules exist for.

Open questions, none of which this document is competent to answer:

- Whether an unpaid, term-time exercise tied to an open role sits the right side of the
  primary-beneficiary test for unpaid interns.
- **Who owns the work product.** The student made it; the manager defined it; Covenda holds it.
  Nothing says.
- **Confidentiality in the other direction** — the pilot discloses a real internal problem to
  10-20 students, and nothing governs what they may do with it.

**Get a lawyer's read before the first student is recruited**, and write the IP and confidentiality
terms into the student-facing brief. This is cheap now and expensive later. It is listed as a
blocker on recruitment, not on discovery — nothing in the 30-day plan touches it.

## Deferred to after the pilot

- **Selling a scoped brief standalone.** Withdrawn from V1 by D20 because it contradicts D5.
  Reconsider once one pilot has run: if a manager pays for a brief and then asks "can you staff
  this?", the wedge is validated and inbound is created in one move.
- **Pricing.** ⚠ D5 defers it to "cohort two" and nothing schedules cohort two, so this plan ends
  at day 90 with no pricing information. Accepted for V1 — but **what the one existing customer
  paid is recorded before interview one** (D26). It is the only pricing datum Covenda owns and it
  appeared in none of these documents.
- **Onboarding.** Requires knowing what a role demands, which is discovery's output. Promote only
  if 5+ managers name a specific costed onboarding delay unprompted and at least one says it hurts
  more than mis-hiring.
- **Full loop in-product.** Nothing has ever run authenticated end to end. Correct as pilot #3, not
  pilot #1: attempting it first means debugging software in front of the first manager who ever
  agreed to try it.
