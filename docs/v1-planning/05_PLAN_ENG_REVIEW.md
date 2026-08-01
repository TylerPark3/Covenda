# Engineering Review — Covenda V1

Output of `05_PLAN_ENG_REVIEW.md`. Reviewed against the repository, the V1 spec, and defects observed in production during this session.

---

## Verdict

The codebase is **better engineered than it is sequenced**. 1,323 tests, idempotent migrations, deliberate comments explaining *why*, careful RLS on `submissions`, a real type system. This is not a codebase in trouble.

Its problem is that it is one large, tightly-coupled front end serving a product stage that has not been validated — and it has a specific, repeated structural failure mode that has now caused two production outages.

**No re-architecture is recommended.** V1 requires wiring, deletion, and three structural fixes.

---

## The structural defect: one throw kills the page

`app.js` and `portal.js` wire the entire UI from a single uninterrupted run of top-level code. A throw anywhere aborts the script and leaves **every listener below it unattached**.

Observed in production twice today:

| Incident | Cause | Blast radius |
|---|---|---|
| Homepage dead | `app.js:1897` — `$('[data-clear-draft]', form).addEventListener(...)` where markup had dropped the element | Every nav control, dialog, and CTA on the site |
| Portal dead | `portal.js:5063` — `for (const sig of (t.unprompted \|\| []))` where the server returned `{}` | Entire dashboard; surfaced as a sign-in failure |

Both were single-character-class errors. Both took the whole surface down. Neither produced a console error a user would see.

**E-01 (blocking): isolate render sections.** Each `panel.append(section(...))` should be individually fault-tolerant, so a bad field costs its own section and nothing else. A `try/catch` per section boundary, logging to `error_events`, is sufficient — no framework required.

**E-02 (done, keep): shape guards over truthiness guards.** `asList()` now guards all 25 `for...of` sites; `mergeSavedOnboard` guards restored state. The pattern is `Array.isArray(x) ? x : []`, never `x || []`. A test enforces it.

**E-03: the server should not return `{}` where the client expects a list.** The render is now defensive, which is correct, but the shape is wrong at source. Audit the JSONB columns whose defaults are `'{}'` where `'[]'` is meant.

---

## The repeated pattern: correct abstraction, old one left in place

This has now appeared four times:

| Correct | Left in place | Consequence |
|---|---|---|
| `armedButton` | `cancelProjectButton`, plus copies in delete/withdraw | Withdraw silently stopped setting `is-armed` |
| ~~`api/evidence.js`~~ | ~~`studentEvidenceTier`~~ | **Not an instance** — a wrapper, not a rival |
| `fitTier` (tier label) | `fitPill` (`% fit`) | Product renders a score its own comment forbids |
| `endProjectControl` | `cancelProjectButton` (dead) | Dead code carrying duplicate confirm logic |

Two were real and are fixed. Two claimed instances were not instances at all: the evidence ladders (R-07) and `fitPill` (D-01) both turned out to be correct designs I mistook for drift. The pattern is real; my hit rate on spotting it was 50%.

**E-04: extraction is not complete until the callers move and the original is deleted.** Worth a standing review rule, because in every instance the *replaced* implementation kept being used — sometimes more than the replacement.

---

## Architecture assessment

| Area | Rating | Note |
|---|---|---|
| Data model | **8/10** | `matches`, `introductions`, `placement_outcomes` well-shaped; DB-level rationale constraint is excellent |
| Migrations | **8/10** | Idempotent, commented, re-runnable |
| RLS posture | **7/10** | `submissions` correctly locked; two views bypassed it until today |
| API structure | **6/10** | 83 endpoints, none of which has carried a transaction (revenue exists; it closed manually, outside the product) |
| Front-end structure | **4/10** | 6,500-line single-scope scripts; one throw kills all |
| Test coverage | **7/10** | 1,323 tests, but structural — few behavioural |
| Error visibility | **5/10** | `error_events` exists; unapplied until today, so failing open |
| Observability | **4/10** | No instrumentation on the four pilot gates |

### On the 83 endpoints

Not inherently wrong, but `RESUME.md` lists five modules with **no callers** (`batch-churn`, `ml-data`, `analyze-model`, `proof-methods`, and `evidence.js` partially). Dormant code is not debt. Dormant code that gets wired to serve outcomes that do not exist *is*.

**E-05:** leave them dormant (D14). Do not delete — deletion invites rewriting later. Do not wire — wiring invites maintaining.

### On test coverage

1,323 tests is a real asset, but most assert *structure* (does this string appear in source) rather than *behaviour*. Both production outages today passed the full suite. The tests added since — `asList` behaviour, `mergeSavedOnboard` shape handling, `errorSite` parsing, the for-of scanner, the view-security scanner — are behavioural and each was verified to **fail against the broken version first**.

**E-06: a test that has never failed against the defect it describes is decoration.** Make "demonstrate the test failing first" a review requirement.

---

## Migration and data risk

**Migrations were applied ~11 behind for days.** `RESUME.md` recorded applied state through `fit_dimensions` while 11 later migrations sat unapplied, including `infrastructure` (rate limits, `error_events`). Both the limiter and the error log fail open by design, so nothing broke — and nothing was protected or recorded either.

**E-07:** the deploy path and the migration path are independent, and only one is automated. `npx vercel --prod` ships code; migrations require a human to paste SQL. That gap is how the client got ahead of the schema — and is a plausible source of the `{}`-instead-of-`[]` shape mismatch.

Minimum fix: a startup assertion that the applied migration head matches the expected head, logged loudly on mismatch. `scripts/preflight.mjs` already does this class of check for local dev.

---

## Security (defer to `/cso`, flagged here)

- Two `SECURITY DEFINER` views returned the full contact list to `anon`/`authenticated` despite `submissions` revoking them. Fixed today.
- Rate limits and error logging were unapplied — the limiter protected nothing while appearing to.
- All Vercel env vars are Sensitive type, so unreadable even by CLI. Good posture; means credential rotation needs a documented runbook.

---

## Engineering plan for V1

**Blocking before pilot**

| ID | Work | Est. |
|---|---|---|
| R-05 | Wire `placement_outcomes` — operator worklist + form | M |
| R-01/R-02 | Wire `matches` into an operator shortlist builder and company view | L |
| E-01 | Per-section fault isolation in render | M |
| R-09 | Walkthrough accessibility path | M |
| R-08 | Remove illustrative examples | S |

**Not blocking, do early**

| ID | Work |
|---|---|
| E-03 | Audit JSONB defaults for `{}` vs `[]` |
| E-07 | Migration-head assertion at startup |
| — | Instrument the four pilot gates |

**Explicitly not doing:** compatibility automation, verification automation, simulations, batch machinery, any of D14. `matches.score` stays null; `scorer_version='manual-v1'`.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Another single-throw outage | **High** | E-01 |
| Client/schema drift | **High** | E-07 |
| Sunk-cost pull to wire dormant modules | **High** | D14 is binding |
| 6,500-line scripts resist safe change | Medium | Accept for V1; revisit after Gate 3 |
| Structural tests give false confidence | Medium | E-06 |

---

## What I would push back on

**The V1 spec assumes the operator surface is cheap to build.** R-01 (shortlist builder) is the largest single piece of work in the plan and it is admin-only, so it will feel like it does not count. It is the founder's daily tool for 90 days and deserves real design.

**Conversely: do not build a beautiful admin.** It has one user, and after Gate 3 it is replaced by the compatibility engine. Build it plain and fast.

---

## Next command

`/cso` with `docs/gstack-prompts/06_SECURITY_REVIEW.md`.
