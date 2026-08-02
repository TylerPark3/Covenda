# V1 Decision Ledger

CEO review, 2026-08-01. Mode: **SCOPE REDUCTION**. Branch `strategy/alan-zhang-feedback`.

**Extends** the approved log in `docs/v1-planning/02_CEO_REVIEW.md` (D1-D15), which remains
binding. Supersedes nothing in it. Where this document conflicted with it, the conflict is now
named and resolved rather than left implicit — see D21-D25.

**Revision 2, 2026-08-01.** Revision 1 survived an adversarial second pass with a 5/10. This
revision fixes what that pass found. The corrections are marked ⚠ and are not cosmetic: the
central argument was re-grounded, the quant probe was restored to a sample size that can
distinguish anything, and two binding commitments this document had silently deleted were put
back. What that review found is recorded in full at the end.

---

## The correction this review exists for

`docs/strategy/` produced five documents that built a seven-vertical selection matrix and
recommended letting 30 interviews choose the vertical. The vertical was already decided, and the
matrix did not say by what.

⚠ **Revision 1 justified this with the wrong authority.** It cited D3 — "One vertical:
software/AI" — as settling the question. It does not. D3's provenance is the *cut list*
(`02_CEO_REVIEW.md:111`, `01_OFFICE_HOURS.md:152`): "25 specialisations | Ch. 34.8 = Phase 6. Pick
one: software/AI." That is a decision about which **role family** the specialisation taxonomy
serves in V1. It is not a decision about which **industry** buys. Under a role reading, quant SWE
*is* software engineering and complies. There is no consistent reading of those eight words under
which startup engineering complies and quant SWE does not.

**The decisive exclusion was already approved, three paragraphs above D3, and revision 1 never
cited it.** `02_CEO_REVIEW.md` §2, the product contract:

> For a **5–75 person technical startup with one open early-career role and no recruiter**,
> Covenda replaces the pile of low-signal applications with a small, explained shortlist.

Echoed in `01_OFFICE_HOURS.md:54`: "an engineering-led startup of 5–75 people in NYC … no
dedicated recruiter."

That excludes Citadel, Jane Street and every firm of their size on its face — not because of
their industry but because of **their headcount and the fact that they employ recruiters**. It
needs no interpretation, and it was approved as the product contract, which outranks a taxonomy
line item.

⚠ **The rhetorical charge was also overstated.** Revision 1 said the five strategy documents
"reference D3 zero times." True by grep, and misleading: `HIRING_MANAGER_WEDGE_REVIEW.md:88` and
`CONCIERGE_PILOT_OPTIONS.md:128` both cite the approved decision log by name (Gate 3, D11). They
engaged the log selectively. They did not ignore it. A keyword count is not a governance failure.

**Consequences, once the product contract is honoured:**

- **Startup engineering and AI infrastructure comply.** Both are populated by sub-75-person
  engineering-led companies without recruiters. No new decision was needed for either.
- **Quant SWE is excluded by firm size and the presence of recruiters**, not by industry and not
  by D3. A twelve-person quant startup with no recruiter would comply. Citadel does not.
- **15 interviews were about to be spent re-deciding a question the product contract answers.**

## The 30-day decision

| # | Question | Decision |
|---|---|---|
| 1 | Primary vertical | **Software/AI (D3), scoped by the §2 product contract: 5-75 people, engineering-led, no recruiter.** Startup engineering and AI infrastructure |
| 2 | Exact role | **Early-career software engineer at a sub-50-person company**, the role the paying customer already bought |
| 3 | First company-side user | **The CTO or founding engineer.** At this size they are user, buyer, champion and evaluator at once |
| 4 | Economic buyer | **Same person.** No recruiter to route around, no compliance gate |
| 5 | Problem solved first | **Defining the work.** Turning a vague ask into a scoped, defensible brief — *pending P1, see D19* |
| 6 | Components that stay relevant | `brief-engine.js`, `project-intake.js`, `evidence.js`, `placement_outcomes` |
| 7 | Not built before discovery | Anything vertical-specific, new scenarios, onboarding, automation of any step |
| 8 | Must be learned from managers | Whether their screening misses people, and whether they can define a work product |
| 9 | Abandon signal | Fewer than 3 of **20** confirm all five conditions (⚠ the denominator drifted between 25 and 30; the cadence — 5 interviews × 4 weeks — produces **20**) |
| 10 | Smallest pilot | One manager defines one work product; 10-20 students attempt it; manager judges 3-5 |

## New decisions

| # | Decision | Status |
|---|---|---|
| **D16** | ⚠ **Re-grounded.** The vertical is settled by the **§2 product contract** — 5-75 people, engineering-led, no recruiter — not by D3's taxonomy line. D3 stands as a role-family decision. The office-hours matrix does not reopen either | Decision |
| **D17** | ⚠ **Restored to 20 messages, and demoted to non-decisive.** Quant access is sampled by 20 outreach messages, channel-matched, recorded per segment. It **cannot open a D3 supersession on its own** — the product contract, not the response rate, is what excludes large quant firms. The probe measures whether a *sub-75-person quant firm without a recruiter* is reachable, which is a segment question inside the contract, not a vertical question | Decision |
| **D18** | Validation threshold has three branches. **5+ confirmations → build. 3-4 → extend by 15 interviews, do not build. 0-2 → abandon and re-segment.** ⚠ The "unprompted" requirement is dropped as unmeasurable — see the note below | Decision |
| **D19** | ⚠ **Superseded by the falsifier that already existed.** The pre-registered test of P1 is not the founder's binary recollection; it is the **4× rule already written in `docs/pilot/BRIEF_GAP_LOG.md`**. And **Deal 000 runs before interview one** | Decision |
| **D20** | The pilot is **free**, per D5. `CONCIERGE_PILOT_OPTIONS.md` Option 3 (selling a scoped brief) contradicts D5 and is **withdrawn from V1** | Decision |
| **D21** | ⚠ **Gate 1 stands, unmodified.** The 30-day bar is **5 signed Talent Briefs**, each with a real role, named evaluator and 5-day SLA. Interviews are the method, not the goal | Decision |
| **D22** | ⚠ **"Referrals win" is restored to every risk and kill-criteria table.** It was classified *Existential* in the binding log and had been dropped from all four V1 documents | Decision |
| **D23** | ⚠ **Student supply is a gating constraint with its own kill criterion**, not an assumed input. The pilot brief must attach to a **real open role** so the binding mitigation "recruit against live briefs only, never in general" survives | Decision |
| **D24** | ⚠ **D2 is honoured, not superseded.** The pilot's "strongest 3-5, with evidence, against the manager's rubric" **is** an explainable shortlist. The wedge sentence must say so, or D11 becomes unmeasurable | Decision |
| **D25** | ⚠ **The pilot runs concierge, never through the simulation engine.** Routing it through the 374-scenario engine would violate D14 and §7 (both out of scope for 90 days) | Decision |
| **D26** | ⚠ **What the one customer paid is written down before interview one.** It is the only pricing datum Covenda owns and appeared in none of these documents | Decision |
| **D27** | ⚠⚠ **The Gate 1 clock starts 1 September, not 1 August.** The bar is unchanged; the *window* moves, because Gate 1 requires a real open role and early-career postings land September-November. August is used for Deal 000, the pricing datum, the tracker, list-building and interviews 1-5 | Decision |
| **D28** | ⚠⚠ **Gates 2 and 3 stand, unmodified.** Both are binding in `02_CEO_REVIEW.md:141-147` and appeared in **none** of the four V1 documents. V1's 90-day goal does not replace Gate 3 — it is a floor beneath it | Decision |
| **D29** | ⚠⚠ **D9 (student consent on every introduction) is a permanent requirement and governs the pilot shortlist.** No student's work reaches a manager without that student's approval | Requirement (permanent) |
| **D30** | ⚠⚠ **D15 and Gate 0 gate the pilot.** The accessibility path for the required walkthrough must exist *before* the pilot, and Gate 0 is currently failing on two counts in the binding log | Requirement |

### On D17 — why 5 messages was indefensible

Revision 1 proposed testing quant with **five** messages, judged on response rate. The arithmetic
kills it. Against an implied software baseline of ~30%:

| Quant's true response rate | P(≥2 of 5, i.e. "beats software") |
|---|---|
| 30% — *identical to software* | **47%** — a coin flip |
| 10% — *genuinely inaccessible* | **8%** — false positive |

A 0/5 result carries a 95% confidence interval of roughly [0%, 52%]: consistent with quant being
*more* accessible than startups. Distinguishing 30% from 10% at 80% power needs ~60 messages per
arm. Five cannot distinguish anything, and a test that cannot fail is not evidence — it is a
procedure that produces the answer it was designed around.

Two further defects, both now fixed:

- **The arms were not comparable.** The software arm runs through warm-introduction tiers 0-5,
  starting with the existing paying customer and personal alumni. Five quant messages necessarily
  run cold at tiers 6-7. That measures channel warmth and reports it as vertical accessibility.
  **Fix: the comparison is cold-tier only, on both arms.**
- **It was a 4× cut sold as a saving.** `VERTICAL_SELECTION_MATRIX.md:103` set the falsification
  test at **20 messages**; `ADVISOR_FEEDBACK_DECISION_LEDGER.md:80` says "twenty cold messages
  answers it in a week." Revision 1 claimed it bought the number "for the price of five messages
  rather than fifteen interviews" — comparing its cut to the *contingent follow-on* rather than to
  the thing it actually cut. **20 stands.**

### On D18 — "unprompted" is unobtainable, so it is dropped

The threshold required all five conditions confirmed "independently and unprompted." The script
prompts four of them directly: Q10 asks whether the firm systematically misses candidates
(condition 1), Q11-13 cover defining a work product (condition 3), Q29 asks whether they would
review the strongest submissions (condition 4), Q28-30 cover recurrence (condition 5).

Once Q10 has been asked, nothing after it is unprompted. Leaving the word in makes "which answers
count" a judgement call by the person with the most to gain — at exactly the decision point the
pre-commitment exists to protect.

**Replaced with a testable rule.** A confirmation requires, recorded in the manager's own words in
the tracker's quote column:

1. A **specific named instance** of a candidate their process missed — not agreement that it
   happens. "Yes, probably" is not a confirmation.
2. A capability they say a resume cannot show.
3. A work product **they describe concretely enough to be built**, before Covenda proposes one.
4. Willingness to review results, stated with a timeframe.
5. The role recurring at a stated frequency.

Specificity is measurable; spontaneity is not.

⚠ **But the adjudicator did not change, and that was the real problem.** "Concretely enough to be
built" is still a judgement call made by the founder alone, at the decision point, with the most to
gain — structurally identical to "unprompted." Three fixes:

- **Write the verbatim quote first, decide after.** The tracker's quote column is filled during the
  call; the five conditions are scored in the Friday synthesis, from the quote, not from memory.
- **Pre-register one worked example of a passing answer and one of a failing answer for condition
  3, before interview one.** Without an exemplar, "concrete enough" means whatever day-30 needs it
  to mean.
- **A second reader scores the final call.** Anyone literate in the domain — the co-founder paying
  the other seat, an advisor, Alan. If no second reader is available, say so in the synthesis and
  treat the result as one branch weaker than it reads.

⚠ **Condition 2 has no question.** Conditions 1, 3, 4 and 5 map to Q10, Q11-13, Q29 and Q21/Q28-30.
"A capability a resume cannot show" maps to nothing in the instrument. Add it explicitly: *"What is
the thing you most need to know about someone that their resume or GitHub cannot tell you?"*

⚠ **The "3-4 → extend by 15" branch had no threshold for the extended sample.** It is **5 of 35**
cumulative — the bar does not scale with the sample, or extending would be a way of lowering it.

⚠ **"5+ → build" is wrong and contradicts this document's own Non-goals.** It means **proceed to
the Gate 1 signature ask, then the pilot** — not write code. Nothing is built before Gate 1 passes.

### On D19 — the fallback was the negation of the hypothesis

Revision 1 defined P1's alternative as "sourcing was the expensive step." P1 — defined once in the
repo, at `docs/pilot/BRIEF_GAP_LOG.md:76` — reads *"the bottleneck is scoping, **not supply**."*
Pre-registering ¬P1 as the alternative to P1 pre-registers nothing. It is the excluded middle
written out as though it were a hypothesis.

**The real falsifier already existed and was dropped.** From the same file:

> Scoping may have been expensive because it was the **first** one, and may get cheap with
> templates. **If minutes-to-scoped-brief drops more than 4× between deal 000 and deal 005, P1 is
> wrong.** Scoping was a learning tax, not a structural bottleneck.

That has a numeric trigger and an independent measurement. It is strictly better than asking the
founder's own customer, months later, whether the scoping *the founder personally conducted* was
hard — a question with maximum demand characteristics, one subjective source, and zero
independence, on which revision 1 hung a campaign-stopping decision.

**Both changes:**

- The 4× rule is the pre-registered test of P1. Interview zero's answer is *context*, not a
  trigger. It no longer stops the campaign by itself.
- **Deal 000 runs first.** `BRIEF_GAP_LOG.md:32` designs a one-hour retrospective run of the
  closed deal's scoping through `project-intake.js`. It needs nobody's calendar and it is
  currently blank. Scheduling 20 interviews before executing a free one-hour test the plan already
  designed is the same error this review was convened to correct.

⚠⚠ **Correction — the 4× rule cannot fire inside this plan's horizon, and A4 needs a test that
can.** The rule compares **deal 000 against deal 005**. Covenda has **one** customer, and the
90-day goal is *one* pilot and *one* `placement_outcomes` row. Nothing in 30 or 90 days produces
deals 001-005. Revision 2 therefore deleted the only executable test of P1 and replaced it with
one that cannot execute — while listing it as a live kill criterion. Two further defects: the
retrospective is run by the founder who already knows the answers, so deal 000's time is biased
*downward*, which makes the 4× threshold **harder** to trip and biases the test toward confirming
P1; and "minutes to scoped brief" was never defined.

**What actually gets used in V1:**

| Test | Horizon | Status |
|---|---|---|
| **Gap count** — of the questions you had to ask in real life, how many did `diagnosisGaps` ask? | Deal 000, **week 1** | **This is A4's V1 test.** Executable now |
| **Deal 000 vs the pilot's own scoping** (deal 001) | ~day 60-90 | Two points, not five. Directional only — **not** a kill criterion |
| **The full 4× rule** | Requires deals 001-005 | **Post-V1.** Keep the table; do not cite it as a V1 criterion |

**Measurement protocol, since none existed:** *minutes to scoped brief* = active wall-clock spent
by the founder and the company together, from the company's first substantive message to a brief
`evaluateBrief` accepts. Excludes waiting on replies. One stopwatch, logged per deal.

If the engine asked **most** of your real questions, the wedge is shippable and the gap list is
the roadmap. If it asked **almost none**, scoping is judgment rather than a question set — and
that is P1 surviving in a form that makes it much harder to productise. Both are findings. Neither
needs five deals.

### On D21 — the gate this document had deleted

`02_CEO_REVIEW.md:137` — binding, never superseded:

> **Gate 1 — demand (day 30).** 5 signed Talent Briefs, each with a real role, named evaluator,
> 5-day SLA. → Fail: the wedge is wrong or the segment is wrong. **Stop and re-segment before
> recruiting a single student.**

The string "Gate 1" appeared **nowhere** in the four V1 documents. Its replacement 30-day goal was
"25 interviews completed, 4 Friday syntheses written."

That swaps a commitment test for an activity test. Signed briefs are falsifiable and
money-adjacent; interviews conducted measure only that the founder was busy. A document whose
entire thesis is that decisions must be superseded *explicitly* had superseded the most
consequential one by omission.

**Gate 1 is the 30-day bar.** 20 interviews is the method by which five signatures are obtained.

### On D28 — the two gates this revision deleted the same way

Revision 2's central charge against revision 1 was that *"a document whose entire thesis is that
decisions must be superseded explicitly had superseded the most consequential one by omission."*
It then did the same thing to Gates 2 and 3. "Gate 2" appears in **none** of the four V1 documents;
"Gate 3" appears once, in passing, about the compatibility engine.

Both are binding (`02_CEO_REVIEW.md:141-147`) and neither has been superseded:

> **Gate 2 — shortlist relevance (day 60).** 5 shortlists delivered; ≥3 companies rate them
> relevant; ≥1 second request. → Fail: evidence does not change decisions. **This is the
> company-killing gate.**
>
> **Gate 3 — outcomes (day 90).** ≥10 introductions accepted, ≥5 evaluations completed, ≥1
> hire/project/trial.

**V1's 90-day goal — one pilot, one `placement_outcomes` row — is roughly 5× short of Gate 2 and
10× short of Gate 3.** That gap is now stated rather than hidden. V1 is a *floor*: the smallest
thing that produces a real outcome. It is not a substitute for the gates, and passing it does not
pass them. If the founder wants to formally relax Gates 2 and 3 to match one concierge pilot, that
is a legitimate decision — but it must be written as a supersession with a reason, not achieved by
not mentioning them.

### On D29 — the consent gate nobody mentioned

D9 is a **permanent requirement**: student consent on every introduction. §2 restates it: *"the
student approves every introduction before contact."*

The word "consent" appeared in **none** of the four V1 documents, while the pilot has Covenda
"select the strongest 3-5 and return them as an explained shortlist." **No student's work, name or
evidence reaches a manager without that student's explicit approval of that specific
introduction.** Consent is per-introduction, not a blanket sign-up at recruitment. This is the
requirement most likely to be quietly skipped under day-30 pressure and it is the one that would
most damage students if it were.

### On D23 — the student side, and the mitigation this plan removed

The four V1 documents said nothing about where 10-20 strong students come from, what fraction
complete, or what happens if fewer than 10 finish. There was no student-side kill criterion.

Worse, a binding mitigation had been silently inverted. `02_CEO_REVIEW.md:158`:

> Students won't build without liquidity → **recruit against live briefs only, never in general.**

And the pilot ask: *"No hiring commitment is required."* A brief with no hiring commitment is not
a live brief. As written, the plan asked strong students to do difficult unpaid work, during term,
for an unproven company, with an explicit guarantee that no job was attached.

**Resolution — Gate 1 already fixes this.** Gate 1 requires a **real role with a named
evaluator**. So the brief attaches to a genuinely open role, and the student is told the truth:
*this role is real and open; the manager has committed to review your work, not to hire you.* That
is a live brief without a hiring commitment. It is honest and it is recruitable.

**Student-side kill criterion:** fewer than 10 completed submissions means the pilot produced no
evidence about discovery, regardless of what the manager says. Record attempts, completions and
completion rate. If completion is under 50%, the exercise is mis-scoped and the next one shrinks.

### On D24 — the wedge sentence had lost the shortlist

D2 is binding: "Wedge is **explainable shortlisting**, single wedge." D11 is the approved success
metric: "≥3 of 5 companies request a second **shortlist**." Revision 1's one-sentence positioning
contained no shortlist, and the pilot demoted shortlisting to an optional warm-up "the weakest
test of the product" — while retaining D11 unchanged as the metric.

That was incoherent: a pilot producing no shortlist cannot produce the first of five second-
shortlist requests.

**It resolves without superseding anything.** Covenda selects the strongest 3-5 from 10-20
attempts and hands them over with linked evidence and a written reason. That **is** an explained
shortlist — sourced from work product rather than from résumés. The wedge sentence must say so.
D2 is honoured; D11 stays measurable.

### On D25 — the pilot is an assessment, and D14 says not yet

D14 cut simulations and assessments to Phase 4; §7 puts everything in it out of scope for 90 days.
The pilot administers a difficult work product to 10-20 students and verifies it. That is an
assessment, and `CONCIERGE_PILOT_OPTIONS.md:31` says so out loud — "simulation engine to run."

Revision 1 raised D20 against Option 3 for a pricing conflict with D5 and did not notice the
larger conflict sitting in the option it recommended.

**Resolution:** the distinction D14 cut is *the productised simulation engine* — 374 authored
scenarios, batch scoring, the taxonomy. A single manager-authored task, administered by hand,
graded by hand, judged by the manager against their own rubric, is concierge work. **It must not
route through the simulation engine, and no scenario may be authored for it.** If the pilot cannot
run without the engine, it is out of scope and the pilot is redesigned.

### On D20 — unchanged

`CONCIERGE_PILOT_OPTIONS.md` proposed selling a scoped brief standalone. D5 says the pilot is free
and the price is a written commitment plus a 5-day SLA. Withdrawn from V1, recorded in
`docs/V1_PILOT.md` as a post-pilot question.

## What Alan changed, and what he did not

**Adopted:** hiring managers over recruiters; overlooked-talent discovery over cost reduction;
difficult role-specific evidence; prestige halo over early network effects.

**Not adopted:** quant SWE as the vertical — excluded by the §2 product contract on firm size and
recruiter presence, not by the probe.

⚠ **Revision 1 discounted him unfairly.** It noted he advised without knowing Covenda had a paying
customer, that the deal closed outside the product, or that a 374-scenario engine existed — and
used that to discount his vertical choice. Stating what he lacked is legitimate; *concluding from
it* is not. Alan's case for quant rests on **economic value per exceptional hire and student
demand**. One closed startup deal is evidence against neither. Discounting a conclusion because
the person lacked information the conclusion does not depend on is an ad hominem with a citation.

**His argument is answered on the merits, and only partly:** quant's economics are almost
certainly better, and the product contract still excludes the firms that have them. That is a
real cost being accepted, not a rebuttal.

⚠ **And the one deal proves less than revision 1 claimed.** It closed over DMs and email, entirely
outside the product. That makes it evidence about **the founder's network**, not about the
segment's structural accessibility. Revision 1 read it the other way — "every one of the startup
cells is observed" — using a single relationship-mediated sale to score sales-cycle length, pilot
probability and willingness to share as *segment properties*. Five of startup engineering's
thirteen matrix cells trace to that one anecdote, at the heaviest weights, accounting for most of
the gap the plan called decisive. **n=1, counted five times, is still n=1.**

## Non-goals for 30 days

- No vertical-specific product.
- No new scenario authoring. 374 unvalidated ones exist.
- No onboarding product before one completed placement.
- No charging for the pilot (D5, D20).
- No pilot before Gate 1 (D21).
- No code. Every assumption below requires discovery first.

## Assumptions requiring discovery before any implementation is approved

| # | Assumption | Tested by |
|---|---|---|
| A1 | Managers experience a gap between who they surface and who could succeed | Interview Q7-Q10 |
| A2 | They can define a nontrivial work product | Q11-Q14 |
| A3 | They will review results without being chased | Pilot behaviour, not stated intent |
| A4 | Scoping is expensive for them, not just for Covenda | Q9-addendum **and the 4× rule** |
| A5 | Confidentiality does not block every realistic exercise | Q12, Q23 |
| A6 | The role recurs often enough to justify a reusable system | Q21 |
| **A7** | ⚠ **Roles do not simply fill by referral first** | Ask every manager how the last two hires arrived. **Existential (D22)** |
| **A8** | ⚠ **10+ strong students will complete difficult unpaid work against a real open role** | Pilot recruitment. **Kill criterion, D23** |

**None of these has been tested once.** The product has ~85 API handlers built against zero of
them.

---

## Reviewer concerns

An independent reviewer with no access to the conversation that produced revision 1 scored it
**5/10**. Everything above marked ⚠ is a fix for something it found. What remains unresolved:

**Accepted and fixed:** the D3 over-reading; the "zero references" charge; n=5's inability to
distinguish; the non-comparable probe arms; the 20→5 cut misdescribed as a saving; ¬P1 as a
fallback; Deal 000 unrun; the ad hominem against Alan; the one deal read as segment evidence;
Gate 1's deletion; the referral risk's deletion; missing student supply; the D2 and D14 conflicts;
"unprompted" being unobtainable; the missing pricing datum; the matrix arithmetic; the 25/30
denominator drift.

**Open — the founder decides, and no document can decide for them:**

1. **The plan may still be over-fitted to n=1.** `HIRING_MANAGER_WEDGE_REVIEW.md:59` says it
   plainly: the only row with a confirmed transaction is *paid company projects*, and Alan's
   proposals are "adjacent products that would each need their own first sale." The V1 plan builds
   around **manager-defined work products** — itself an adjacent product — while citing the
   paid-projects deal as its evidence base. **The one deal validates a different product than the
   one being planned.** Gate 1 is the mitigation: five signatures against the *new* product is
   the first evidence that is not the old deal wearing a new label.

2. **Founder capacity is not planned, only acknowledged.** No V1 document contains the words
   runway, cash, hours, or semester. The plan starts 1 August; its 30-day window closes as the
   academic year begins, and its own documents note internship postings land September-November.
   It simultaneously requires 20 messages/week, 10 warm-intro requests/week, 5 interviews/week, a
   weekly synthesis, the existing customer relationship, and recruiting 10-20 students — from one
   undergraduate. `V1_PILOT.md` names the founder as the single point of failure and mitigates it
   with "Accepted. Revisit at month 2," which is not a mitigation. **There is no if-this-slips
   branch anywhere.** See the capacity section in `V1_DISCOVERY_PLAN.md` for the reduced-scope
   fallback added in revision 2 — but the underlying constraint is real and unresolved.

3. **The interview arithmetic did not close.** 5 interviews/week × 4 weeks = 20, not 25, and the
   instrument is 33 questions — a 75-90 minute call — five times a week with strangers. Revision 2
   cut the target to 20 and introduced a 12-question core; the load is still heavy and the
   conversion assumption behind "80 messages → 20 interviews → 5 signatures" is asserted, never
   modelled.

4. **Competitive response beyond referrals is still absent.** What an incumbent does if this works
   is unexamined. Defensible to defer at this stage; recorded so it is deferred knowingly.

5. **Pricing terminates at day 90 with no information.** D5 defers pricing to "cohort two" and
   nothing schedules cohort two. D26 recovers the one datum that exists; it does not produce a
   price.
