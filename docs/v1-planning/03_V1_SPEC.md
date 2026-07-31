# V1 Specification — Covenda

Output of `03_V1_SPEC.md`. Binding constraints: D1–D15 in `02_CEO_REVIEW.md`.

**Governing principle (Ch. 1.5, instructions 1–2):** inspect the existing codebase before proposing replacement architecture; reuse existing abstractions unless a documented limitation makes extension impractical. This spec adds **no new tables**.

---

## 0. Correction to the CEO review

`02_CEO_REVIEW.md` §6 listed three things to build: a shortlist object, an outcome form, and a gap analysis view. A schema audit shows **all three already exist**. D6 is amended accordingly.

| CEO review said "build" | Reality |
|---|---|
| Shortlist object | **`matches`** — `opportunity_id`, `student_user_id`, `human_decision` ∈ {proposed, selected, rejected}, `human_rationale`, `explanation`, `score_components` |
| Outcome form | **`placement_outcomes`** — `days_to_contribution`, `senior_hours`, `independent_resolution`, `rework_rate`, `would_continue`, `note` |
| Gap analysis | Existing readiness / evidence-tier logic |

`matches` already carries a database-level constraint that `human_rationale` is non-empty whenever `human_decision` is set. The "written reasoning as a first-class object" proposed as a *selective expansion* in the CEO review was designed and enforced some time ago.

**V1 is a wiring problem, not a construction problem.**

---

## 1. Repository and live-app audit

### Wiring status of the V1 loop

| Table | API | portal.js | admin.js | Verdict |
|---|---|---|---|---|
| `member_projects` (Talent Brief) | ✅ | ✅ | ✅ | Wired |
| `matches` (shortlist) | 1 file | 11 refs | 1 ref | **Partial** |
| `introductions` (consent gate) | 1 file | 1 ref | 0 | **Thin** |
| `placement_outcomes` (outcome) | 1 file | 0 | 0 | **No UI at all** |

`placement_outcomes` is the critical gap. Chapter 32's north star is *successful evidence-backed student-company relationships*; Ch. 31.5's economic unit ends in *one recorded outcome*. There is currently no surface through which an outcome can be recorded. Every downstream system — compatibility calibration, hiring memory, ML export — consumes a table nothing writes to.

### Existing assets V1 reuses unchanged

Auth and roles · student/company profiles · company verification · evidence items and tiers · `member_projects` state machine (`draft → scoping → open → matched → in_progress → review → complete → archived`) · `project_applications` · `project_messages` (post-approval) · admin surfaces · `error_events` · `rate_limits`.

### Known defects carried in

| Defect | Source | Action |
|---|---|---|
| Two evidence ladders (`api/evidence.js` vs `studentEvidenceTier`) | RESUME.md | **R-07**, blocking |
| Walkthrough has no accessibility path | RESUME.md / D15 | **R-09**, blocking |
| Illustrative examples presented as real | D8 | **R-08**, blocking |
| `batch-churn`, `ml-data`, `analyze-model`, `proof-methods` unwired | RESUME.md | Leave dormant (D14) |

---

## 2. System actors

| Actor | Auth | V1 capability |
|---|---|---|
| Student | Supabase auth, role `student` | Profile, evidence, approve/decline introductions, view own gap analysis |
| Company | Supabase auth, role `company` | Talent Brief, view shortlist, request introduction, record outcome |
| Operator (founder) | Admin | Company DNA, build shortlists, verify evidence, chase outcomes |
| Service role | Server only | All DB access; no browser role touches these tables directly |

---

## 3. Domain entities (existing — no new tables)

```
member_profiles ──< evidence items
      │
      │ (shortlisted onto)
      v
   matches >────── member_projects (Talent Brief)
      │                   │
      v                   v
introductions ──────> project_messages
      │
      v
placement_outcomes
```

---

## 4. State machines

**Talent Brief** — reuse `member_projects.status` unchanged.
V1 uses `draft → scoping → open → matched → complete`. `in_progress`/`review` apply only if a paid trial occurs (out of scope, D14). No new states.

**Match** — `human_decision`: `null` (candidate under consideration) → `proposed` (on shortlist, sent to company) → `selected` | `rejected`.
Invariant already enforced in-database: any non-null `human_decision` requires non-empty `human_rationale`.

**Introduction** — `status`: `sent → accepted | declined`, plus `student_response` and `responded_at`. Messaging unlocks only on `accepted`.

**Outcome** — a `placement_outcomes` row is terminal and append-only.

---

## 5. Requirements

Each has: story · rationale · preconditions · happy path · states · data · authorization · audit · privacy · acceptance · tests · observability · rollback.

---

### R-01 — Operator builds a shortlist against a Talent Brief

**Story.** As the operator, I select candidates for a brief and record why each one fits, so the company receives reasoning rather than a ranked list.

**Rationale.** D2 (shortlisting wedge), D4 (manual). `matches` exists and enforces rationale; there is no operator surface to populate it.

**Preconditions.** Brief `status='open'`; operator authenticated as admin; ≥1 student visible per Ch. 29.5 gates (profile complete, identity confirmed, ≥1 evidence item, privacy configured, available, no unresolved integrity issue).

**Happy path.** Open brief in admin → browse eligible students with evidence → add candidate → write rationale (required) → set `human_decision='proposed'` → repeat to 5 → publish shortlist.

**States.**
- *Loading* — skeleton rows; never a blank page.
- *Empty* — "No students yet meet the visibility bar for this brief," listing which gate each near-miss fails. Never an empty grid.
- *Error* — the write failed, the rationale is preserved in the field, retry offered. Rationale must never be lost to a failed request.
- *Permission* — non-admin receives 403 and no candidate data.
- *Stale* — brief edited since load → warn before publish.

**Data.** Insert/update `matches` (`opportunity_id`, `student_user_id`, `human_decision`, `human_rationale`, `explanation`, `scorer_version='manual-v1'`, `decided_at`).

**Authorization.** Operator only. Service role. `matches` must be revoked from `anon`/`authenticated`.

**Audit.** `shortlist.candidate_added`, `shortlist.published` — actor, brief, student, timestamp. No rationale text in the audit payload.

**Privacy.** Only students meeting Ch. 29.5 visibility appear. A student who has not configured privacy is invisible, not defaulted-in.

**Acceptance.**
1. Rationale-less publish is rejected client-side *and* by the DB constraint.
2. Exactly 5 candidates default; more is allowed but flagged (D2: five, not a pool).
3. Ineligible students cannot be added.
4. Publishing twice is idempotent.

**Tests.** Unit: eligibility predicate. Integration: constraint rejects empty rationale. E2E: brief → 5 candidates → publish. Negative: non-admin 403; ineligible student rejected.

**Observability.** Count published shortlists, candidates per shortlist, operator minutes per shortlist (validates A4's 45-minute cap).

**Rollback.** Un-publish returns `human_decision` to `null`; rows are never hard-deleted.

---

### R-02 — Company views its shortlist

**Story.** As a founder I see five candidates with evidence and reasoning, so I can decide who to meet.

**Rationale.** The moment of value for the scarce side (D1).

**Happy path.** Portal → brief → five cards, each: name/handle, evidence items with source + verification tier, the operator's rationale, availability. No score. No rank order.

**States.** *Empty* — "Your shortlist is being prepared" with the SLA date, never an empty state implying failure. *Partial* — a candidate whose evidence is mid-verification shows the tier honestly, never a spinner masquerading as data. *Permission* — a company sees only its own briefs.

**Authorization.** `owner_user_id = auth.uid()` on the parent brief.

**Privacy.** Contact details are withheld until an introduction is accepted (D9).

**Acceptance.**
1. No numeric score is rendered anywhere (D10).
2. Every candidate shows ≥1 evidence item with its tier.
3. Rationale is always visible.
4. Candidates are not ordered by score; order is stable and explicitly "no ranking implied".

**Observability.** Shortlist view, per-candidate expand, time to first introduction request.

---

### R-03 — Company requests an introduction

**Story.** As a founder I request an introduction to a candidate.

**Rationale.** Existing `introductions` table; the consent gate is the product (D9).

**Happy path.** Candidate → Request introduction → fill `role_summary`, `why_relevant`, `compensation`, `time_commitment`, `next_step` → send. Status `sent`.

**States.** *Error* — draft preserved. *Permission* — only the brief owner. *Stale* — candidate withdrew → block with explanation.

**Authorization.** Company owns the brief; candidate is `proposed` on it.

**Audit.** `introduction.requested`.

**Acceptance.** Cannot request for a candidate not on the shortlist. Duplicate requests are blocked. No contact detail is exposed before acceptance.

---

### R-04 — Student approves or declines

**Story.** As a student I approve or decline an introduction before any contact.

**Rationale.** D9, permanent. Ch. 1.5 instruction 11 (humans in the loop).

**Happy path.** Portal → pending introduction showing company, role, compensation, time commitment, next step → Approve or Decline → messaging unlocks only on approve.

**States.** *Empty* — "No introduction requests yet," with the gap analysis as the useful next action. *Permission* — a student sees only their own.

**Data.** `introductions.status`, `student_response`, `responded_at`.

**Audit.** `introduction.accepted` / `introduction.declined`.

**Privacy.** Declining is not penalised, not surfaced to the company as a rating, and not shown to other companies.

**Acceptance.**
1. Messaging is impossible before acceptance (server-enforced, not UI-only).
2. Declining reveals no student contact detail.
3. Decision is irreversible in V1 and states so before confirming.

---

### R-05 — Outcome capture *(the critical gap)*

**Story.** As the operator or founder I record what happened after an evaluation.

**Rationale.** `placement_outcomes` exists with **no UI in portal or admin**. Ch. 32's north star and Ch. 31.5's economic unit both terminate here. Without this the pilot produces no learnable data and every downstream system consumes an empty table.

**Preconditions.** An `introductions` row with `status='accepted'`.

**Happy path.** Admin (and optionally company) → accepted introduction → Record outcome → what happened (interviewed / offered / hired / project / trial / no fit / no response) → `would_continue` → optional `days_to_contribution`, `senior_hours`, `note` → save.

**States.** *Empty* — accepted introductions with no outcome are listed as an operator worklist, sorted oldest first. This list is the founder's day-90 job. *Partial* — all quantitative fields optional; only "what happened" and `would_continue` are required. Demanding precision the founder cannot supply produces fabricated data.

**Data.** Insert `placement_outcomes`.

**Authorization.** Operator always; company for its own introductions.

**Audit.** `outcome.recorded`.

**Privacy.** Free-text `note` is operator-visible; never shown to the student without explicit consent.

**Acceptance.**
1. Every accepted introduction appears in the outstanding-outcome worklist until recorded.
2. Outcome is recordable with only the two required fields.
3. Recorded outcomes surface on the student's profile as a Work Record only with consent.
4. Outstanding-outcome count is queryable — it is the pilot's core operating metric.

**Tests.** Integration: insert with minimum fields; worklist excludes recorded. E2E: accepted introduction → outcome → disappears from worklist.

**Observability.** Outcomes recorded / accepted introductions (target ≥80% by day 90); median days from acceptance to outcome.

---

### R-06 — Student gap analysis

**Story.** As a student with no company interest yet, I see what evidence is missing for the roles I want.

**Rationale.** Ch. 29.2 immediate student value with zero liquidity; the only student-side promise V1 makes (D1 secondary journey).

**Reuse.** Existing readiness / evidence-tier logic, **reframed** from batch-admission scoring to evidence-gap description. No new engine.

**Acceptance.**
1. Renders with zero companies and zero shortlists present.
2. Never displays a numeric score or percentile (D10).
3. Every gap names a concrete next artifact ("a repository you own end to end"), not an abstract competency.
4. Never states or implies a hiring probability.

---

### R-07 — Collapse the evidence ladders *(blocking)*

**Story.** As an engineer I need one definition of evidence tier.

**Rationale.** `api/evidence.js` and `portal.js`'s `studentEvidenceTier` are competing definitions. Two ladders means two truths about "verified" — the exact claim the product is built to make. Must be resolved before any new evidence UI (D7).

**Acceptance.** One module owns tiers; `portal.js` imports it; a test asserts no second ladder exists.

---

### R-08 — Remove illustrative examples *(blocking)*

**Rationale.** D8. A product whose thesis is *evidence over claims* cannot lead with synthetic evidence.

**Acceptance.** No example presented as a real person/company unless it is real and consented; any remaining sample is unmistakably labelled in the UI, not only in source.

---

### R-09 — Accessibility path for the required walkthrough *(blocking)*

**Rationale.** D15. The walkthrough is required to apply; requiring video with no text alternative, captions, or accommodation route excludes students. The spec flags it; the code does not answer it.

**Acceptance.** A documented alternative exists and is reachable from the walkthrough step; `accommodation_requests` (already in schema) is wired to it.

---

## 6. RLS policy matrix

The audit already found and fixed two `SECURITY DEFINER` views bypassing RLS (`people_directory`, `people_possible_duplicates`). Same posture applies to every V1 table.

| Table | anon | authenticated | service_role |
|---|---|---|---|
| `matches` | none | none | select/insert/update |
| `introductions` | none | own rows only | all |
| `placement_outcomes` | none | none | all |
| `member_projects` | none | own or visible | all |
| `member_profiles` | none | own + visible fields | all |

**Rule:** browser roles reach nothing directly; all access is via `/api/*` on the service role. Any new view declares `security_invoker = on` — already enforced by `tests/model/view-security.test.js`.

---

## 7. Event taxonomy

`brief.created` `brief.opened` `shortlist.candidate_added` `shortlist.published` `introduction.requested` `introduction.accepted` `introduction.declined` `outcome.recorded` `evidence.verified` `gap_analysis.viewed`

Every event: actor, subject, timestamp, request id. **No free-text rationale or note in any event payload** — `safeDetail()` in `api/limits.js` already strips credential-shaped and PII-shaped keys; extend its deny-list to `rationale` and `note`.

---

## 8. Operator workflow (the founder's day)

1. **Outstanding outcomes** — accepted introductions with no `placement_outcomes` row, oldest first
2. **Briefs awaiting shortlist** — `status='open'`, no published matches, against the 5-day SLA
3. **Evidence to verify** — students with unverified items blocking eligibility
4. **Introductions awaiting student response** — >72h, needs a nudge

This is the whole admin product for 90 days.

---

## 9. Migration plan

**No new tables. No new columns.** Required work is wiring, plus:

1. Extend `safeDetail()` deny-list with `rationale`, `note`
2. Confirm `matches` / `placement_outcomes` revoked from `anon`, `authenticated` (pattern already set by `20260730300000_secure_people_views.sql`)
3. Index `placement_outcomes(student_user_id, recorded_at)` for the worklist

Every migration idempotent and re-runnable, per existing convention.

---

## 10. Seeded demo data

Per D8, seeds are **operator-only** and never render in a company or student view. The demo dataset is explicitly non-production-visible; the site shows real consented profiles or nothing.

---

## 11. End-to-end test matrix

| # | Path | Asserts |
|---|---|---|
| E1 | Brief → 5 candidates + rationale → publish | R-01 |
| E2 | Company views shortlist | No score rendered; rationale present |
| E3 | Introduction requested → student approves → messaging unlocks | R-03/R-04 |
| E4 | Student declines | No contact leak; no penalty |
| E5 | Accepted → outcome recorded | Leaves worklist |
| E6 | Gap analysis, zero companies | Renders; no score |
| E7 | Non-admin hits shortlist API | 403, no data |
| E8 | `anon` hits `matches` via PostgREST | Denied |
| E9 | Publish without rationale | Rejected client and DB |
| E10 | Walkthrough accessibility path | Reachable |

---

## 12. Observability

Instrument the four pilot gates directly: signed briefs (Gate 1), shortlists rated relevant + second requests (Gate 2), introductions accepted / evaluations completed / hires (Gate 3), and operator minutes per shortlist (A4).

`error_events` and `rate_limits` already exist for this — but note the infrastructure migration was only applied recently, so both were failing open until then.

---

## 13. What this spec deliberately does not build

Everything in D14, plus: no compatibility automation (`matches.score` stays null in V1; `scorer_version='manual-v1'`), no automated verification, no simulations, no batch machinery. Phase 2 begins only after Gate 3, and the engine will then be measured **against the operator's manual picks** — which is exactly what `human_decision` + `human_rationale` were designed to provide.

---

## Next command

`/plan-design-review` with `docs/gstack-prompts/04_PLAN_DESIGN_REVIEW.md`.
