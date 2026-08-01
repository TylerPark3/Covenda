# 30-Interview Discovery Plan

Section F of `02_OFFICE_HOURS_PROMPT.md`. Operational plan for the campaign that decides the
wedge.

This extends `04_HIRING_MANAGER_OUTREACH_STRATEGY.md` rather than replacing it. The changes:
the campaign is **split across two segments** instead of committed to quant, and interview #1 is
**the customer who already paid**.

---

## The one question

> Does a hiring manager experience a gap between the candidates their process surfaces and the
> candidates who could actually succeed on their team — and can they name what would reveal it?

Everything else is texture.

---

## Split

| Segment | Interviews | What it tests |
|---|---|---|
| Startup + AI-infra engineering | 15 | Does the scoping gap generalise past one customer? |
| Quant SWE | 15 | Will they take the call, and will they share requirements? |

Quant gets equal weight despite ranking third in `VERTICAL_SELECTION_MATRIX.md`, because its
uncertainty sits in cells that one week of outreach converts to fact. Startups rank first on
evidence; quant ranks third on guesses.

## Titles

**Startup / AI-infra:** CTO at a sub-50-person company, founding engineer, engineering manager,
head of engineering, first-time intern manager.

**Quant SWE:** engineering manager, quantitative development manager, trading systems lead,
research engineering lead, infrastructure lead, senior engineer who mentors interns.

Ranked by *combined authority*, not seniority. A CTO who decides, evaluates and benefits beats a
VP who holds one of the three.

## Warm-introduction hierarchy

Unchanged from `04_`, with one addition at the top.

0. **Your existing paying customer.** They bought the thing. They can describe the gap in their
   own words, and their words are the only demand vocabulary Covenda owns.
1. Columbia alumni you know personally
2. Alumni one introduction away
3. Former interns at target firms
4. Professors and club leaders with industry ties
5. Founders and investors connected to target firms
6. Cold LinkedIn
7. Cold email

## Weekly cadence

- 25 personalised messages
- 10 warm-introduction requests
- 5 completed interviews
- 1 written synthesis every Friday

**Track the outreach-to-response ratio per segment separately.** That ratio is the
accessibility number the vertical matrix cannot supply, and it is the cheapest finding in the
campaign.

## Progression

| Interviews | Purpose |
|---|---|
| 1-5 | Learn vocabulary. Do not pitch. Do not mention Covenda's product |
| 6-15 | Test whether the same capabilities and the same failures recur |
| 16-25 | Introduce one concrete work-product concept and let them attack it |
| 26-30 | Ask the strongest prospects for a pilot |

---

## Questions

`06_HIRING_MANAGER_INTERVIEW_SCRIPT.md` is the script and it is good. Three additions, each
earning its slot for a reason specific to what Covenda already has.

**A. After Q9** — *"When you last brought in an intern, how long did it take you to write down
what you actually wanted them to do? What made that hard?"*

Directly tests P1. It is the only question in the campaign that tests the founder's own finding
rather than the advisor's claim, and if the answer is "ten minutes, it was easy", the scoping
thesis is in trouble.

**B. After Q17** — *"If a student used AI for most of the mechanical work but made every
judgment call themselves, is that a pass or a fail for you?"*

Q17 asks how AI use should be evaluated. This forces the ruling. **[UNKNOWN]** Nobody at Covenda
knows whether managers want AI-free work or AI-fluent work, and the entire simulation design
depends on the answer.

**C. After Q24** — *"Who else should I be asking about this, and would you introduce me?"*

Turns 30 interviews into 45. Cheapest line in the script.

## What not to pitch

Do not mention: the compatibility engine, batch admission, the 374 scenarios, the evidence
ladder, or any number the system computes. **[INFERENCE]** Describing a scoring system to
someone whose job is judging people invites them to critique your algorithm instead of telling
you about their problem. The engine is not the product in this conversation; their pain is.

---

## Evidence thresholds

**Validating.** Five managers, independently and unprompted, describe:
1. Candidates their process misses
2. A capability a resume cannot show
3. A nontrivial work product they could define
4. Willingness to review results
5. A role recurring often enough to justify a reusable system

All five, from five different people, before anything vertical-specific gets built.

**Disconfirming — and these are the ones to watch for, because they are easy to explain away:**

- Managers say screening is *already* fine and the constraint is headcount, not identification.
- They can describe the gap but cannot define a work product. **[INFERENCE]** This would be the
  most dangerous outcome: it means the pain is real and Covenda cannot serve it, which looks like
  encouragement right up until the pilot fails.
- They would use it but not pay, because interns are cheap and a bad one is survivable.
- Confidentiality blocks every realistic exercise, so only toy problems are shareable.
- Nobody answers. Silence is data.

**Pre-commitment.** Write down now, before interview #1: *"If fewer than 5 of 30 confirm all
five conditions, Covenda does not build a vertical-specific system this quarter."* A threshold
set after seeing the data is not a threshold.

## Recording

Use `07_DISCOVERY_TRACKER.csv`. Per interview capture: segment, title, company size, source of
introduction, whether they named a missed candidate, whether they could define a work product,
whether they would review results, confidentiality objections, and one verbatim quote.

**The verbatim quote is the most valuable column.** **[INFERENCE]** Covenda's positioning is
currently written in Covenda's words. Thirty quotes in a hiring manager's words is the raw
material for saying it in theirs, and the gap between the two is usually where the product is.
