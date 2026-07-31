# Code Review — the day's branch

Output of `09_CODE_REVIEW.md`. Staff-engineer review of `2f6ae5e..HEAD` against `docs/COVENDA_GSTACK_CONTEXT.md`, the approved plan, and the product invariants.

**Caveat worth stating up front: I wrote nearly all of this.** A self-review catches contradictions and invariant violations reliably; it is weaker on "was this the right thing to build at all." Treat the blocking finding below as evidence the review was worth running, and the taste calls as still open.

---

## Scope

20 commits · 30 code files · **1,583 insertions / 98 deletions**, of which ~800 lines are tests. Docs excluded from this review.

---

## Blocking findings

### B-01 — The company shortlist leaked students who had not consented to be visible · **FIXED in this pass**

`loadCompanyShortlists` returned every candidate the operator marked `proposed`, joined to `member_profiles`, with **no visibility gate**. A company saw name, headline, school and evidence band regardless of whether that student had ever made their profile visible.

The security review had already named this exactly — S-07, *"a student appearing on a founder's shortlist without having consented to visibility is the single worst failure this product can have"* — and the feature shipped without it anyway. Writing the requirement down did not cause it to be implemented.

Why it is a real leak and not a technicality: the student directory has always gated on `portfolio_visibility = 'members'`. A shortlist showing someone the directory would hide is the same disclosure by another route. An operator choosing to propose someone is a judgement about fit; it is not that person agreeing to be shown to a company.

**Fix:** the gate is applied in the profile query, and a candidate with no visible profile is dropped before any field is assembled — not rendered with a blank name, because a nameless card still discloses that a specific person was shortlisted.

---

## Non-blocking findings

### N-01 — `record-outcome` is not idempotent

`placement_outcomes.insert` has no conflict handling. The operator button disables on click and re-enables on error, so a retry after a failed-but-committed write would create a second row. Low severity — `introduction_id` makes duplicates visible and the worklist anti-join still resolves — but the outcome table is the pilot's primary dataset, and duplicate rows in it are worse than in most places. A unique index on `introduction_id` would settle it.

### N-02 — No audit events for the new surfaces

The spec's event taxonomy (§7) lists `shortlist.published`, `outcome.recorded`, `introduction.*`. None are emitted. `error_events` exists and is now applied. Not blocking for a 5-company pilot where the operator *is* the audit log, but it is a stated requirement that quietly did not ship.

### N-03 — The shortlist has no empty state of its own

If an operator proposes candidates and every one of them fails the visibility gate (now possible, by design), the company sees nothing at all rather than "a shortlist is being prepared." The section simply does not render. Not wrong, but silent.

### N-04 — `asList` accepts any iterable, including a `Map`

`for (const x of someMap)` yields `[key, value]` pairs, which no caller wants. No current caller passes a Map, and rejecting them would have been arbitrary, but it is a latent foot-gun rather than a guarantee.

---

## Invariant checks

| Invariant | Result |
|---|---|
| No universal or hidden ranking | ✅ `score`/`score_components` never leave the server; order is `decided_at`; the page states nothing is ranked |
| Missing evidence ≠ weakness | ✅ `presentationBand` returns `self_reported` for an empty profile; Agency renders nothing at `tier: 'none'` rather than a zero |
| No prestige proxies | ✅ school is displayed, never used to filter, sort or gate |
| Referrals optional | ✅ untouched |
| Verification not overclaimed | ✅ `presentationBand` reads the post-ceiling tier |
| Consent / visibility | ❌ → ✅ **B-01** |
| RLS | ✅ `matches` revoked in `20260726330000`; `placement_outcomes` revoked in the new migration; views fixed with `security_invoker` |
| Tenant isolation | ✅ shortlists scoped by `owner_user_id`, then by brief ids |
| Migration safety | ✅ additive, nullable, `if not exists`, idempotent; no `set not null`, no drops |
| Rollback | ⚠️ additive columns need no rollback; `human_decision` reversal is untested |
| Loading / empty / error states | ⚠️ mostly present; N-03 |
| Accessibility | ✅ improved — `aria-live` on outcome status, focus-visible on new controls, tier carried by text not colour only, and the accommodation gate fixed |
| Overbuilt V1 | ✅ nothing built that D14 excluded |

---

## Fixes made in this pass

1. **B-01** — visibility gate on the company shortlist, plus two tests.
2. Test-fixture correction in `limits.test.js` (`note` became a stripped key; the truncation assertion needed a key that survives).
3. `list-guard` assertion scoped to the Agency section — it was matching a comment that documents the old bug, which is prose worth keeping.

---

## Tests

**1,373 → 1,375 passing, 0 failing.** Every new test in this branch was verified failing against the defect it describes before being committed. That was not previously the norm — all four critical production defects found today passed the pre-existing suite.

---

## Residual risks

**Nothing here has been exercised by an authenticated session.** The shortlist, the outcome worklist and the accommodation gate are all verified by source assertions and, where possible, by driving the public pages in a real browser. None has been run by a signed-in student, company or operator. That is the single largest gap in confidence and it is now unblocked, because mail works.

**The visibility gate has a product consequence worth a decision.** A student who has not set their profile visible now silently disappears from a shortlist the operator built. That is correct for privacy and surprising for the operator, who gets no signal that their choice was dropped. The operator surface should probably say so. Flagging rather than deciding — it is a product call.

**Self-review limits.** I wrote the code being reviewed. B-01 was found by checking my own work against a list I had written earlier; the things a fresh reader would question — whether the shortlist card is the right shape, whether the Agency section is worth showing at all — are not the things a self-review surfaces.
