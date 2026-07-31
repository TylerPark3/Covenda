# CEO Review — Covenda V1

Output of `02_CEO_REVIEW.md`. Scope reduction first, selective expansion second. Reviewed against `01_OFFICE_HOURS.md`, Chapters 3, 17, 29–34 of the master spec, and the repository.

**This document is binding on downstream GStack skills.** Where it conflicts with the master spec, the spec's own Ch. 1.4 rule applies: *when the document contains tension between an ambitious long-term system and a simpler first version, the implementation sequence controls.*

---

## 1. One-sentence V1

> Covenda gives a technical founder five evidence-backed candidates they would not have found, with the reasoning attached, for one real role they are hiring for right now.

---

## 2. Product contract

For a 5–75 person technical startup with one open early-career role and no recruiter, Covenda replaces the pile of low-signal applications with a small, explained shortlist. A founder gives us 45 minutes describing the work and the environment; within five business days they receive five candidates, each with linked evidence and a written reason they fit *this* role. The founder decides who to talk to; the student approves every introduction before contact. Covenda never scores a person, never ranks them universally, and never claims to predict hiring success. What it claims is narrower and testable: **you will spend less time and meet better-matched people than you would have alone.**

---

## 3. User journeys

### Primary — the founder (scarce side, drives everything)

1. Founder-led outreach → 45-minute Company DNA interview
2. Founder signs a one-page written Talent Brief (real role, named evaluator, 5-day evaluation SLA)
3. Receives 5 candidates with evidence links and written reasoning
4. Requests introductions to the ones they want
5. Evaluates by their own process — interview, take-home, or paid trial
6. Reports the outcome (**mandatory**, this is the product's real input)
7. Requests a second shortlist ← *the only success metric that matters*

### Secondary — the student

1. Recruited by the founder from a Columbia club, lab, or hackathon **against a live brief**
2. Builds a profile in under 30 minutes: identity, 1–3 evidence items, availability, preferences
3. One evidence item is verified by a human
4. Receives a specific introduction request naming the company and the work
5. Approves or declines
6. Is evaluated, and the outcome is recorded on their profile as a durable Work Record

**Student value before liquidity** (Ch. 29.2): a shareable evidence-linked profile and a written gap analysis — *"here is what this kind of company looks for that your evidence does not yet show."* That is useful the day it is written, with zero companies present. It is also the only student-side promise V1 makes.

---

## 4. Core transaction

Unchanged from Ch. 3.3 and from `01_OFFICE_HOURS.md`. The economic unit is Ch. 31.5:

```
one verified company talent need
  -> one accepted shortlist
  -> one completed evaluation
  -> one recorded outcome
```

Contribution margin is measured at that unit before any account growth.

---

## 5. 90-day operating model

The founder is the product. Explicitly Ch. 29.3.

| Function | V1 | Later |
|---|---|---|
| Company DNA | Founder interview, written by hand | Structured intake |
| Shortlisting | Founder reads evidence and picks 5 | Compatibility engine, measured against the human first |
| Evidence verification | Manual, ≤45 min/student | Repository analysis, endorsements |
| Introductions | Product (already built) | Same |
| Outcome capture | Founder chases by hand | Form + reminders |
| Student recruitment | In-person, club by club | Referral loops |

**Pricing decision: the pilot is free, but not cheap.** Ch. 31.8 asks "will companies pay before hire?" — that is the wrong question at n=5. Money is not the scarce resource for a funded startup; *founder attention* is. So the price is commitment: a written brief, a named evaluator, and a 5-business-day evaluation SLA. A company unwilling to sign that would not have paid either, and we learn it in week one instead of month three. Pricing is tested with cohort two.

---

## 6. Minimum feature set

Everything here **already exists in the repository**. V1 requires almost no new construction — it requires removal and one integration.

**Keep and rely on**
- Auth, member portal, student profile, company profile
- Evidence items with source links and the self-reported vs. verified distinction
- Company verification
- Project/role posting (becomes the Talent Brief)
- Application and **introduction approval** — the student's consent gate, non-negotiable
- Messaging after approval
- Admin surfaces for manual operation
- Outcome/completion recording → Work Record

**Build (small)**

> **Superseded by the schema audit in `03_V1_SPEC.md` §0.** All three items below already exist as tables: `matches` (shortlist, with `human_decision` and a DB constraint requiring `human_rationale`), `placement_outcomes` (outcome), and the existing readiness/evidence-tier logic (gap analysis). V1 is a **wiring** problem, not a construction problem. `placement_outcomes` in particular has no UI in either portal or admin, which is the single most important gap. D6 is amended accordingly; the spec governs.

1. ~~**Shortlist object**~~ → exists as `matches`
2. ~~**Outcome form**~~ → exists as `placement_outcomes`, unwired
3. ~~**Gap analysis view**~~ → exists as readiness/evidence-tier logic, needs reframing

**Collapse (debt that will bite)**
4. **One evidence ladder.** `api/evidence.js` and `portal.js`'s `studentEvidenceTier` are two competing definitions of the same concept. Fix before any new evidence UI. Two ladders means two truths about what "verified" means.

---

## 7. Explicit non-goals

Deferred, not deleted. Dormant code is not debt; dormant code wired to serve nonexistent outcomes is.

| Non-goal | Rationale |
|---|---|
| 25 specialisations | Ch. 34.8 = Phase 6. V1 ships **software/AI only** |
| Batch admission scoring & churn | Optimises a funnel with no demand behind it |
| Simulations and assessments | Ch. 34.6 = Phase 4 |
| Coursework ontology | A course is a question generator, not evidence |
| Open roles / Greenhouse sync | Aggregating others' jobs is not the wedge |
| Credits, escrow, payouts, Stripe Connect | Paid trials optional; defer together |
| Super-intern, ATS push, ML export | Phase 3+ |
| Public batch catalogue | Publishes a bar nobody has cleared |
| Universal ranking or score | Spec non-negotiable, permanent |
| Open direct messaging | Consent gate is the product |
| Any claim of improved hiring | Forbidden until outcome evidence exists |

**Conflicts with the thesis that must be corrected now:**

- **Illustrative examples presented as real.** Every example on the site is labelled illustrative because it is. A product whose thesis is *evidence over claims* cannot lead with synthetic evidence. Five real consented profiles > fifty fabricated ones.
- **Batch-first framing.** The live product leads with cohorts and specialisations. That is Phase 5 language on a Phase 1 company, and it tells a founder we are a programme, not a shortlist.
- **Student-side surface area.** Onboarding, coursework, readiness, evidence ladders are all built for the abundant side. The scarce side has a project form.

---

## 8. Stage gates

**Gate 0 — foundation (Ch. 34.2)** *(≈ complete)*
Student + company walkthrough end to end; no critical privacy gap; example profile understandable without founder explanation.
❌ *Currently failing the third:* the walkthrough has no accessibility path (repo's own known gap) and examples are illustrative.

**Gate 1 — demand (day 30)**
5 signed Talent Briefs, each with a real role, named evaluator, 5-day SLA.
→ Fail: the wedge is wrong or the segment is wrong. **Stop and re-segment before recruiting a single student.**

**Gate 2 — shortlist relevance (day 60)**
5 shortlists delivered; ≥3 companies rate them relevant; ≥1 second request.
→ Fail: evidence does not change decisions. This is the company-killing gate.

**Gate 3 — outcomes (day 90)**
≥10 introductions accepted, ≥5 evaluations completed, ≥1 hire/project/trial.
→ Pass: begin Phase 2 (compatibility), measured against the founder's manual picks.

---

## 9. Risks and assumptions

| Risk | Severity | Mitigation |
|---|---|---|
| **Referrals win** | Existential | Track it explicitly. If pilot roles fill by referral, the wedge is wrong. |
| Founder time doesn't scale past 5 companies | High | Expected. V1 is not meant to scale; it is meant to teach. |
| Verification cost > value | High | Cap 45 min/student, measure, kill if exceeded |
| Students won't build without liquidity | Medium | Recruit against live briefs only — never in general |
| Companies hire and leave | Medium | Ch. 29.8: treat conversion as success, transparently |
| Long hiring cycles blow the 90-day window | Medium | Accept project/trial outcomes, not only hires |
| Sunk-cost pull toward built features | **High** | This document. The cut list is binding. |

The last one is the real risk. There are 83 endpoints and 63 migrations of built product, and the natural pull is to justify them. Chapter 1.4 anticipated exactly this: *the implementation sequence controls.*

---

## 10. Decision log

Binding on `/spec`, `/plan-design-review`, `/plan-eng-review`, `/cso`, `/qa-only`.

| # | Decision | Status |
|---|---|---|
| D1 | First user is the **founder**, not the student | Decision |
| D2 | Wedge is **explainable shortlisting**, single wedge | Decision |
| D3 | One vertical: **software/AI** | Decision |
| D4 | Shortlisting, DNA, verification are **manual** in V1 | Decision |
| D5 | Pilot is **free**; price is written commitment + 5-day SLA | Decision |
| D6 | New build limited to **shortlist object, outcome form, gap analysis** | Decision |
| D7 | Evidence ladders **collapsed to one** before new evidence UI | Requirement |
| D8 | Illustrative examples **removed or unmistakably marked** | Requirement |
| D9 | Student consent gate on every introduction | Requirement (permanent) |
| D10 | No universal score, no prestige proxy, no hiring claim | Requirement (permanent) |
| D11 | Success = **≥3 of 5 companies request a second shortlist** | Decision |
| D12 | V1 proves **discovery and evaluation**, not hiring | Decision |
| D13 | Minimum data: brief, shortlist + reasoning, introduction, outcome | Requirement |
| D14 | Everything in §7 is out of scope for 90 days | Decision |
| D15 | Accessibility path for the required walkthrough before pilot | Requirement |

**D12 deserves emphasis.** V1 does not prove Covenda improves hiring. Sample size makes that impossible and Ch. 1.5 forbids the claim. It proves a founder will accept a shortlist, act on it, and come back. That is sufficient and it is honest.

---

## Selective expansion

Two additions that strengthen the core transaction and cost almost nothing:

1. **Written reasoning is a first-class object, not a note.** Store the per-candidate rationale as structured data attached to the shortlist. It is the training data for Phase 2 compatibility and the only artifact that makes shortlists auditable. Capturing it later means losing the pilot's most valuable output.

2. **Gap analysis as the student's standalone value.** Already largely built (readiness/evidence tiers). Reframed from a batch-admission score to *"what this kind of company looks for that your evidence does not show,"* it delivers Ch. 29.2 immediate student value with zero liquidity — and gives students a reason to return before any company exists.

Everything else expansionary is deferred.

---

## Next command

`/spec` with `docs/gstack-prompts/03_V1_SPEC.md`, treating D1–D15 as binding constraints.
