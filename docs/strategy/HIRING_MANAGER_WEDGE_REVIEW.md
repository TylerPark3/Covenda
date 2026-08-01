# Hiring-Manager Wedge Review

Sections A, C, D, E and H of `02_OFFICE_HOURS_PROMPT.md`.

Labels: **[ADVISOR]** **[EVIDENCE]** **[INFERENCE]** **[UNKNOWN]**

---

## A. Buyer and stakeholder map

Alan's claim is that Covenda has been talking to the wrong person. The map below tests it by
separating roles that get collapsed in practice.

| Role | User | Buyer | Champion | Evaluator | Blocker | Beneficiary |
|---|---|---|---|---|---|---|
| **Hiring manager / EM** | ✅ | sometimes | ✅ | ✅ | | ✅ |
| Engineering manager | ✅ | | ✅ | ✅ | | ✅ |
| Team lead / senior mentor | ✅ | | ✅ | ✅ | | ✅ |
| CTO (small firm) | ✅ | ✅ | ✅ | ✅ | | ✅ |
| Founder (startup) | ✅ | ✅ | ✅ | ✅ | | ✅ |
| Head of talent | | ✅ | sometimes | | ✅ | |
| Recruiter | ✅ | | | | ✅ | |
| Campus recruiter | ✅ | | | | ✅ | |
| Legal / compliance | | | | | ✅ | |
| L&D lead | | sometimes | | | | |
| **Student** | ✅ | | | | | ✅ |

**The finding. [INFERENCE]** Recruiters are the only row that is *user and blocker with no other
role*. They operate the process, can refuse a tool, and gain nothing from a candidate their
existing pipeline missed — an overlooked-talent product implies their pipeline has a hole.
Selling to them means selling a critique of their work.

Hiring managers are the only row that is champion, evaluator and beneficiary at once. **[ADVISOR]**
Alan is right, and the map explains why more precisely than his phrasing did.

**The exception that matters. [EVIDENCE]** At a startup, founder and CTO occupy every column
simultaneously. There is no recruiter to route around and no compliance function to clear. That
is not a small convenience; it is why Covenda's one paid deal closed at all, and it is the
strongest argument for the segment Alan did not know existed.

**Access ranking. [INFERENCE]** CTO at a sub-50-person firm > founder > engineering manager >
head of engineering > head of talent > recruiter. Seniority is not the axis; *combined authority*
is. One person who can decide, evaluate and benefit beats three who each hold one piece.

---

## C. Product wedge comparison

| Wedge | Customer | Transaction | Time to value | Software needed | Willingness to pay | Evidence needed first |
|---|---|---|---|---|---|---|
| Evidence-backed discovery | Hiring manager | Per shortlist | Days | **Exists** | **[UNKNOWN]** | 5 managers confirm the gap |
| Manager-designed simulations | Hiring manager | Per role definition | Weeks | **Exists, unvalidated** | **[UNKNOWN]** | Managers will define one |
| Paid company projects | Company | Per project | Weeks | **Exists, proven** | **[EVIDENCE] Yes** | Already proven once |
| Role-specific preparation | Student | Subscription | Months | Partial | Low **[INFERENCE]** | Students pay, unlikely early |
| Assessment and routing | Company | Per candidate | Days | **Exists** | **[UNKNOWN]** | Managers trust an outside score |
| Accelerated onboarding | Company | Per hire | Months | None | **[UNKNOWN]** | One completed placement |
| Combined discovery + prep | Both | Mixed | Months | Partial | **[UNKNOWN]** | Everything above |

**[EVIDENCE]** Only one row has a confirmed transaction: paid company projects. Money moved for
exactly that. Every other willingness-to-pay cell is unknown, and three of them require software
that already exists and has never been used.

**[INFERENCE]** The honest reading is that Covenda's proven wedge is the one it already sold, and
Alan's proposals are adjacent products that would each need their own first sale. The interviews
should test whether manager-designed simulations can *attach* to the paid project — not whether
they replace it.

---

## D. Reconciling with the existing app

What the repository already contains, and what each thing should become.

### Preserve

**`api/brief-engine.js`** — `diagnosisGaps`, `evaluateBrief`, `defenseQuestionsFor`,
`buildRubric`, `requiresDefense`. **[EVIDENCE]** Wired through `api/project-intake.js:457` and
rendered by `portal.js:3655`. It has never carried a real conversation.

**[INFERENCE]** This is the single most important asset for Alan's thesis and nobody has noticed.
It is a machine for extracting a scoped brief from a vague ask, which is precisely what
questions 11-17 of the interview script are trying to learn. The interviews should be run *with
this engine's gap questions in hand*, and every question a manager answers that the engine never
asked becomes its next question.

**`api/compatibility.js` + `compatibility.config.js`** — **[EVIDENCE]** Weights 0.55 / 0.38 /
0.12 verified against `Covenda_Compatibility_Engine_Explained.pdf`; school, GPA, clubs and
fraternity stripped, with a passing invariance test. Gated on Gate 3 by the approved decision
log. Preserve, do not touch.

**`api/simulation.js` and the state engine** — **[EVIDENCE]** 2,705 lines across seven modules.
Deliberately emits no score. Preserve the engine.

### Repurpose

**The 374 authored scenarios.** **[EVIDENCE]** Authored from a blueprint, zero runs, zero
hiring-manager input. **[INFERENCE]** Treat them as a hypothesis library rather than a product.
When a manager answers interview question 12 — *"which parts of the role could be simulated
safely outside the firm?"* — check whether any of the 374 already matches. A hit validates one.
A miss says the taxonomy was authored for the wrong reader.

### Postpone

**Batch admission, batch scoring, the coursework ontology, 25 specialisations.** **[EVIDENCE]**
All supply-side, all built against zero product-carried transactions. **[INFERENCE]** None of
them move a hiring-manager conversation. Freeze rather than delete; they are cheap to hold and
expensive to rebuild.

### Do not build

**Anything vertical-specific.** The threshold in `04_HIRING_MANAGER_OUTREACH_STRATEGY.md` is five
independent confirmations. Nothing has been confirmed once.

---

## E. The core company claim

Alan's proposed framing:

> Covenda helps hiring managers discover exceptional early-career talent that resume-based
> pipelines miss.

**[INFERENCE]** This is better than the current framing on the buyer's motive and worse on
proof. It asserts that Covenda *can* find those people, which requires either a placement record
or a method a manager finds credible on inspection. Covenda has one paid engagement and zero
recorded outcomes.

**Recommended framing until a placement exists:**

> Covenda gives a hiring manager one difficult, role-relevant work product, run with explicit
> AI-use rules, and returns evidence of how a small group of students actually handled it.

**[INFERENCE]** This claims only what can be delivered on day one, and it is falsifiable in a way
the discovery claim is not. Every noun in it maps to something in the repository:
`brief-engine` defines the work product, the simulation engine runs it, `api/evidence.js` grades
what came back.

**On "alpha".** **[ADVISOR]** Keep it out of general messaging. It is native vocabulary inside a
fund and borrowed everywhere else, and borrowed vocabulary reads as someone selling to a market
they do not belong to.

---

## H. Onboarding

**DEFER. Not a first product, not rejected.**

**[INFERENCE]** Onboarding requires knowing what a role demands, which is discovery's *output*.
Selling it now means claiming to shorten a ramp Covenda has never observed. That is a
verification overclaim of exactly the kind the product exists to eliminate.

**[UNKNOWN]** Whether managers hold a budget for onboarding delay, or absorb it as a cost of
doing business. Questions 18-20 of the interview script test it directly.

**Promote it if:** five or more managers name a specific, costed onboarding delay unprompted, and
at least one says it hurts more than mis-hiring. **[INFERENCE]** That combination would mean the
second product is more painful than the first, which is worth knowing before building either.
