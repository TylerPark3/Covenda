# Career Signal Engine — /autoplan review

Plan under review. Feature spec as supplied by Tyler, reviewed against `docs/COVENDA_MASTER_SPEC.md`, `docs/COVENDA_GSTACK_CONTEXT.md`, the approved V1 decision log (`02_CEO_REVIEW.md` D1–D15), and the repository.

**Voices:** `[codex-unavailable]` — the Codex CLI is not installed on this machine. All dual-voice sections run Claude-only and are tagged accordingly. This is a real reduction in review independence and is noted rather than papered over.

---

## Phase 0 — Intake

**UI scope:** yes (cards, feed, portal views, admin editor — 15+ matches).
**DX scope:** no (no API/CLI/SDK surface; the operator editor is product UI, not developer surface). Phase 3.5 will be skipped.

**Plan size as stated:** 7 new tables, 15 numbered V1 items, 3 route families (public / student / operator), a public content pipeline, an admin editor with review states, and a rules-based recommendation engine.

**For comparison, the approved V1 plan's entire new build:** three objects — and the schema audit found all three already existed, reducing V1 to wiring.

---

## Phase 1 — CEO Review

### 0A. Premise challenge

Six premises are load-bearing here. Two hold, one is unknowable yet, three do not survive contact with the repository or the approved plan.

---

**P1 — "Students often choose a field based on labor-market conditions that existed several years earlier."** → **HOLDS.**

This is the strongest part of the pitch and it is consistent with Ch. 2.1's framing of hiring as an information problem. The personal example (CS → finance → "what combination of capabilities will remain valuable") is specific and credible. No challenge.

---

**P2 — "This feature is supplementary and will not distract from the core transaction."** → **DOES NOT HOLD.**

The spec's own success criteria include *"the feature does not distract from Covenda's core transaction."* Measured against the approved plan, it is the largest thing in the product:

| | Approved V1 | Career Signal Engine |
|---|---|---|
| New tables | 0 | 7 |
| New route families | 0 | 3 |
| New numbered deliverables | 3 (all already existed) | 15 |
| Serves | the scarce side (founders) | the abundant side (students) |

D1 says the first user is the founder because students are abundant and reachable at near-zero cost through the founder's own network, while companies are the scarce side. This feature is entirely student-facing. It does not move the metric D11 defines as the only one that matters — *≥3 of 5 companies request a second shortlist.*

Calling it supplementary does not make it small.

---

**P3 — "Covenda can publish startup demand intelligence."** → **DOES NOT HOLD YET, and the spec half-admits it.**

The spec is unusually honest here (*"do not pretend Covenda has broad proprietary market intelligence if the dataset is small"*, `Insufficient sample size` as a first-class label). That instinct is right. But the current dataset is not small — it is **zero**. No completed trial, no accepted deliverable, no recorded outcome. The `placement_outcomes` table was wired only today and has never been written to.

The spec's own worked example — *"among five technical startups interviewed by Covenda, four prioritised…"* — requires five interviewed startups. There are none yet. Every insight in V1 would carry the label `Manually curated research`, which is a newsletter, not platform intelligence.

**This premise becomes true after the pilot, not before it.** That is a sequencing objection, not a rejection.

---

**P4 — "A new rules-based recommendation engine is needed."** → **DOES NOT HOLD. Most of it exists.**

| Feature requirement | Already in the repo |
|---|---|
| Capabilities with insufficient evidence | `evidenceGaps()`, `technicalGaps()`, `financeGaps()`, `diagnosisGaps()` |
| What to build next | **`provingPlan()`** — returns `{competency, currently:'claimed', build: provenBy}` per competency |
| What startups are hiring for | **`api/roles.js`** — live Greenhouse boards, `isStudentRole()`, `extractSkills()` |
| Capability taxonomy | `api/skills-taxonomy.js`, `api/course-ontology.js` (37 competencies, 653 lines) |
| Marketability summary | `api/readiness.js` — `classifyReadiness()`, `nextSteps()`, `readinessFor()` |
| Evidence tiers and ceilings | `api/evidence.js` |

`career_recommendation_rules` as a new table with `conditions`/`recommendation`/`capability_mapping` would be a **second** recommendation system beside `readiness.js` + `provingPlan()`. That is the exact pattern that produced the duplicated arming buttons, the dead `cancelProjectButton`, and the triplicated `TIER_ORDER` — and Ch. 1.5 instruction 2 forbids it: *reuse existing abstractions unless a documented limitation makes extension impractical.*

No such limitation is documented in the spec.

---

**P5 — "Students will return to update progress."** → **UNKNOWABLE, and it is the feature's real bet.**

Retention on a career-planning tool with no companies behind it is the assumption everything else rests on. The spec lists it under success criteria but proposes no way to falsify it early. It is testable far more cheaply than the full build (see the counter-proposal).

---

**P6 — "This improves opportunity discovery."** → **NOT DEMONSTRATED.**

The causal chain is: student reads signal → builds evidence → becomes discoverable → company finds them. Step 4 requires companies running searches. There are none. Until the pilot produces demand, better student profiles have nobody to be discovered *by*.

---

### 0B. Existing code leverage map

```
Feature sub-problem                    →  Existing code                        Gap
────────────────────────────────────────────────────────────────────────────────────────
"What should I build next?"            →  provingPlan()                        none — exists
"Which capabilities lack evidence?"    →  evidenceGaps/technicalGaps           none — exists
"What are startups hiring for?"        →  api/roles.js (live boards)           none — exists
"Marketability summary"                →  readiness.js                         reframing only
"Capability taxonomy"                  →  skills-taxonomy + course-ontology    none — exists
"Save / complete a recommendation"     →  —                                    REAL GAP
"Public content with sources"          →  —                                    REAL GAP
"Operator content editor + states"     →  admin.js patterns                    REAL GAP
"Student career preferences"           →  member_profiles (partial)            small gap
```

**Two genuine gaps, not seven tables:** durable content with citations, and the ability to save/complete a recommendation.

---

### 0C. Dream state

```
CURRENT          0 transactions · 83 endpoints · shortlist just wired · outcomes never recorded
THIS PLAN (as
 specified)      + 7 tables · + public content pipeline · + second recommendation engine
                 still 0 transactions · founder attention split across two products
12-MONTH IDEAL   Career Signals grounded in Covenda's OWN hiring data — a moat nobody can copy,
                 because it comes from outcomes only Covenda observed
```

The gap between "this plan" and "12-month ideal" is **the pilot**. The feature's long-term version requires exactly the dataset the pilot produces. Built now, it is curated research with a Covenda logo; built after, it is proprietary and defensible.

### 0C-bis. Implementation alternatives

| | Approach | Effort (human / CC) | Risk |
|---|---|---|---|
| **A** | Build as specified — 7 tables, 15 items | ~3–4 weeks / ~2 days | Splits founder attention during the only pilot that matters; publishes market claims from n=0 |
| **B** | **Content-only slice** — `career_signals` + sources, public feed, admin editor. No engine, no plans, no new recommendation tables. Personalisation reuses `provingPlan()` + `readiness.js` behind the existing portal. | ~4–5 days / ~3 hours | Tests P5 (will students return?) cheaply; no second engine to maintain |
| **C** | Defer entirely until Gate 3 | 0 | Loses the acquisition channel while the pilot runs |

**Auto-decided: B.** Principle P4 (DRY — do not build a second recommendation engine beside `readiness.js` and `provingPlan()`) and P2 (blast radius — B stays inside the existing portal and admin surfaces). B keeps the genuinely new thing (sourced, reviewable content) and refuses the duplicated thing (a parallel rules engine).

---

### 0E. Temporal interrogation

- **Hour 1:** an operator writes a Career Signal with two sources and a review date. Real value, no dependencies.
- **Day 30:** ~8 signals published. Students read them. Nothing measurable happens to the core transaction.
- **Day 90:** the pilot has produced 5 outcomes. *Now* a signal can say "among five startups Covenda briefed, four prioritised X" — with a real n.
- **Month 6:** the content layer is defensible because it is grounded in Covenda's own outcome data.

The feature gets dramatically better after the pilot and only marginally better before it. That is the whole argument for sequencing.

---

## Decision Audit Trail

| # | Phase | Decision | Class | Principle | Rationale |
|---|---|---|---|---|---|
| 1 | CEO | Skip Phase 3.5 (DX) | Mechanical | — | No API/CLI/SDK surface; operator editor is product UI |
| 2 | CEO | Approach B over A and C | Taste | P4 DRY, P2 blast radius | A duplicates `readiness.js`/`provingPlan()`; C loses the channel entirely |
| 3 | CEO | `career_recommendation_rules` rejected | Mechanical | P4 DRY | Second recommendation engine beside an existing one; Ch. 1.5 #2 forbids without documented limitation |
| 4 | CEO | `student_career_plans`/`_actions` deferred | Taste | P2, P3 | Save/complete is a real gap, but it can extend existing profile storage rather than add two tables |
| 5 | CEO | Content layer accepted | Mechanical | P1 completeness | Sourced, reviewable, expiring content is genuinely new and has no existing home |

*(Audit continues through Phases 2–3 after the premise gate.)*
