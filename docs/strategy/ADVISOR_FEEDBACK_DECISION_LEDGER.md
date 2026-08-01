# Advisor Feedback Decision Ledger

Source: `docs/advisor-feedback/alan-zhang/01_ALAN_ZHANG_FEEDBACK.md`
Session: `/office-hours`, 2026-08-01, branch `strategy/alan-zhang-feedback`

Every line below carries a label:

| Label | Meaning |
|---|---|
| **[ADVISOR]** | Alan's claim. Unverified by Covenda evidence. |
| **[EVIDENCE]** | Supported by something Covenda has actually observed. |
| **[INFERENCE]** | Reasoning from the repository or the session. Not observed. |
| **[UNKNOWN]** | A market question no one here can answer. Needs an interview. |

---

## The decision

**Run 30 hiring-manager interviews split across quant SWE and startup engineering. Commit to a
vertical only when five managers in one segment independently confirm the gap.**

Confidence: **medium-high** on the method, **low** on which segment wins.

### Strongest argument for

**[EVIDENCE]** Two independent sources reached the same conclusion by different routes. Alan
argues from the demand side that hiring managers define the real bar. The 2026-07-31
`/office-hours` session established, by direct questioning of the founder, that the most
expensive step in Covenda's one real paid deal was *"getting the company to define what they
wanted."* Neither derived it from the other. Convergence of an outside opinion and inside
operating experience is the strongest evidence in this pack.

### Strongest argument against

**[ADVISOR]** Alan's actual recommendation is quant SWE, and this decision declines to take it.
If quant is right, four weeks of split interviews is four weeks not spent building access to a
market with long relationship cycles. The counterargument to *that*: the discovery plan written
from Alan's own feedback (`04_HIRING_MANAGER_OUTREACH_STRATEGY.md`) sets a validation threshold
of *"at least five managers independently confirm"* before building anything vertical-specific.
Committing to quant now would violate the guardrail derived from the advice.

### What would change this decision

- Five quant managers confirming the gap in the first ten interviews → commit to quant early,
  stop the startup arm.
- Zero quant managers agreeing to a call in three weeks → access is the constraint, not value.
  Fall back to startups, where cold outreach demonstrably works.
- Existing paying customer says the scoping pain was one-off, not structural → P1 collapses and
  the entire discovery frame needs rebuilding.

---

## Claim-by-claim ruling

### 1. Speak with hiring managers, not recruiters

**ACCEPTED.** **[ADVISOR]** as stated, **[EVIDENCE]** as confirmed.

Alan's reasoning is that managers know what predicts success. Covenda's own experience says the
scoping conversation is the expensive one, and scoping happens with whoever owns the work. Those
are the same person.

**[INFERENCE]** This also has a repository consequence. `api/brief-engine.js` already implements
scoping — `diagnosisGaps`, `evaluateBrief`, `defenseQuestionsFor`, `buildRubric` — and is wired
through `api/project-intake.js:457` and `portal.js:3655`. It has never carried a real
conversation. The interviews are how its question set gets written by people who know the answer.

### 2. Begin with one narrow, high-value category (quant SWE)

**PARTIALLY ACCEPTED. Narrowness accepted, vertical deferred.**

**[ADVISOR]** Quant SWE is Alan's example, offered as his strongest, not as a proven choice.

**[EVIDENCE]** Covenda's one paying customer is a startup, not a quant fund. Alan gave this
advice without knowing Covenda had revenue at all. That is not a criticism of Alan; it is a
reason to weigh his vertical choice differently from his method.

**[UNKNOWN]** Whether quant firms will take a call from an undergraduate-founded company with no
placements. Nothing in Covenda's history tests this. It is the single largest unknown in the pack
and it is cheap to test: twenty cold messages answers it in a week.

### 3. Sell overlooked-talent discovery, not cost reduction

**ACCEPTED.** **[ADVISOR]**, and consistent with existing positioning.

**[EVIDENCE]** The approved V1 framing already describes replacing *"the pile of low-signal
applications with a small, explained shortlist."* Alan's phrasing is sharper on the buyer's
motive: a firm that captures enormous value from one exceptional hire buys *discovery*, not
savings. **[INFERENCE]** The word "alpha" should stay out of general messaging and appear only
in quant-specific conversations, where it is native rather than borrowed.

### 4. Build difficult, role-specific evidence

**ACCEPTED IN PRINCIPLE. ALREADY BUILT, FROM THE WRONG DIRECTION.**

**[EVIDENCE]** `api/simulation.js` plus `scenarios.js`, `scenarios-2.js`, `simulation-run.js`,
`session-script.js`, `assessments.js` and `exercise-files.js` total **2,705 lines**, with **374
authored scenarios**, and **zero recorded runs**. The engine is a branching state machine that
deliberately refuses to emit a score: *"The moment an engine like this produces a number, that
number becomes the product, and nobody can explain it."*

**[INFERENCE]** The engine is sound and should be kept. The scenarios are the unvalidated part:
374 of them were authored from a blueprint before a single hiring manager was asked what
distinguishes a strong intern. Alan's #4 is 80% built in the wrong order. Interviews validate or
replace the *content*, not the machine.

### 5. Expand into accelerated onboarding

**DEFERRED, not rejected.** **[ADVISOR]**

**[INFERENCE]** Onboarding requires knowing what a role truly demands, which is the output of
discovery, not an input to it. Selling onboarding before running a placement means claiming to
shorten a ramp Covenda has never observed.

**[UNKNOWN]** Whether managers experience onboarding delay as a budgeted problem. Questions 18-20
of `06_HIRING_MANAGER_INTERVIEW_SCRIPT.md` test exactly this; the answers decide whether it is a
second product or a feature.

### 6. Prestige halo over early network effects

**ACCEPTED.** **[ADVISOR]** **[INFERENCE]** Consistent with the approved decision that the first
user is the scarce side. A shallow two-sided marketplace is the failure mode Covenda is one
funnel away from; 83 API endpoints against zero product-carried transactions is what that looks
like from the inside.

---

## What Alan did not know

Stated plainly, because it changes how much weight his vertical choice should carry.

1. **[EVIDENCE]** Covenda has a paying customer. Money moved. He advised as though pre-revenue.
2. **[EVIDENCE]** That deal closed entirely outside the product — DMs, email, manual matching.
3. **[EVIDENCE]** The founder's own expensive step was scoping, which independently confirms his
   central claim.
4. **[EVIDENCE]** A simulation engine and 374 scenarios already exist, unused.
5. **[EVIDENCE]** A compatibility engine exists, validated at 95.4% against a synthetic
   calibration set, gated on real outcomes that do not exist yet.

His method survives all five. His vertical choice was made without any of them.

---

## Non-goals

- **No vertical-specific product** until the validation threshold is met.
- **No new scenario authoring.** 374 unvalidated ones already exist.
- **No onboarding product** before one completed placement.
- **No abandoning the paying customer.** They are interview #1, not a sunk cost.
- **No code.** This session produced documents only.

## Timeline

| When | What |
|---|---|
| 7 days | 25 personalised messages sent, 10 warm intros requested, existing customer interviewed |
| 30 days | 15+ interviews done, first Friday syntheses written, segment signal visible |
| 90 days | Threshold met in one segment, one concierge pilot running with a manager-defined rubric |
