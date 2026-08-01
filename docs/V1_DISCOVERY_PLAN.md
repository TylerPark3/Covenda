# V1 Discovery Plan

CEO review, 2026-08-01. Mode: SCOPE REDUCTION.

Reduces `docs/strategy/30_INTERVIEW_DISCOVERY_PLAN.md` from a two-segment campaign to one
segment plus a bounded probe, because D3 had already decided the vertical.

---

## The one question

> Does a CTO at a sub-50-person software company experience a gap between the candidates their
> process surfaces and the candidates who could succeed on their team, and can they name what
> would reveal it?

## Allocation

| | Count | Purpose |
|---|---|---|
| Interviews, software/AI | **25** | Test A1-A6 (see `V1_DECISION_LEDGER.md`) |
| Quant probe, messages only | **5** | Measure response rate. **Not interviews.** D17 |

The reduction from 30 interviews to 25 plus a probe is the point. The prior plan spent 15
interviews re-deciding a settled vertical. Five messages buy the same information about quant
access, which was the only genuinely open question.

## Interview zero

**The customer who already paid.** They bought the thing. Their words are the only demand
vocabulary Covenda owns, and every subsequent interview is calibrated against them.

Ask them Q9-addendum first: *"When you brought someone in, how long did it take to write down
what you actually wanted them to do, and what made that hard?"*

**If they say it was easy, stop the campaign and read D19.** P1 is wrong, and running 25 more
interviews against a false premise costs a month.

## Targets

CTO at sub-50 people, founding engineer, engineering manager, head of engineering, first-time
intern manager. Ranked by **combined authority**, not seniority: a person who decides, evaluates
and benefits beats three who each hold one piece.

## Warm-introduction hierarchy

0. The existing paying customer
1. Columbia alumni known personally
2. Alumni one introduction away
3. Former interns at target firms
4. Professors and club leaders with industry ties
5. Founders and investors connected to target firms
6. Cold LinkedIn
7. Cold email

## Cadence

25 personalised messages a week, 10 warm-introduction requests, 5 completed interviews, one
written synthesis every Friday.

**Track outreach-to-response ratio separately for software/AI and for the quant probe.** That
comparison is D17's entire mechanism.

## Progression

| Interviews | Purpose |
|---|---|
| 0 | The paying customer. Calibrate vocabulary. Test P1 |
| 1-5 | Learn language. Do not pitch. Do not mention the product |
| 6-15 | Test whether the same capabilities and failures recur |
| 16-22 | Introduce one work-product concept and let them attack it |
| 23-25 | Ask the strongest prospects for a pilot |

## Script

`docs/advisor-feedback/alan-zhang/06_HIRING_MANAGER_INTERVIEW_SCRIPT.md` is the script, plus
three additions:

**After Q9** — *"When you last brought in an intern, how long did it take you to write down what
you actually wanted them to do? What made that hard?"* Tests P1 directly. The only question in
the campaign that tests the founder's own finding rather than the advisor's claim.

**After Q17** — *"If a student used AI for most of the mechanical work but made every judgment
call themselves, is that a pass or a fail for you?"* Q17 asks how AI use should be evaluated;
this forces the ruling. The entire simulation design depends on the answer and nobody at Covenda
knows it.

**After Q24** — *"Who else should I be asking, and would you introduce me?"* Turns 25 interviews
into 40.

## Do not pitch

Do not mention the compatibility engine, batch admission, the 374 scenarios, the evidence ladder,
or any number the system computes. Describing a scoring system to someone whose job is judging
people invites them to critique your algorithm instead of telling you about their problem.

## Thresholds (D18)

| Confirmations | Meaning | Action |
|---|---|---|
| **5+** | The gap is real and serveable | Build the pilot |
| **3-4** | Real signal, insufficient sample | **Extend by 15 interviews. Do not build** |
| **0-2** | Not real, or not here | Abandon and re-segment |

A confirmation requires all five, independently and unprompted: candidates their process misses;
a capability a resume cannot show; a nontrivial work product they could define; willingness to
review results; a role recurring often enough to justify a reusable system.

**Pre-committed before interview one.** A threshold set after seeing the data is not a threshold.

## Disconfirming evidence to watch for

These are easy to explain away, which is why they are written down now:

- Screening is already fine; the constraint is headcount, not identification.
- They describe the gap but cannot define a work product. **The most dangerous outcome:** the
  pain is real and Covenda cannot serve it, which looks like encouragement until the pilot fails.
- Would use it, would not pay.
- Confidentiality blocks every realistic exercise.
- Nobody answers. Silence is data.

## Recording

`07_DISCOVERY_TRACKER.csv`. Per interview: segment, title, company size, introduction source,
whether they named a missed candidate, whether they could define a work product, whether they
would review results, confidentiality objections, and **one verbatim quote**.

The quote column is the most valuable. Covenda's positioning is currently written in Covenda's
words. Twenty-five quotes in a hiring manager's words is the raw material for rewriting it in
theirs, and the gap between the two is usually where the product is.

## 30-day goal

25 interviews completed, 4 Friday syntheses written, threshold resolved to one of D18's three
branches, and the quant probe's response ratio recorded.

## 90-day goal

One concierge pilot run to a recorded outcome. **One row in `placement_outcomes`.** That table
has existed since 2026-07-27 and has never been written to; every strategy document in this
repository is downstream of a dataset with zero rows.
