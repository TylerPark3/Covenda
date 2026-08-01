# Retrospective

> **Correction (2026-07-31, `/office-hours`).** The "zero transactions" claim below was
> derived from a schema audit and is wrong about the business. A company has paid —
> money actually moved. The transaction closed over DMs, email and manual matching, so it
> left no row in `placement_outcomes` and no `member_projects` row at `status='complete'`.
> The database is empty; the business is not. Read every transaction-count claim in this
> document as "transactions the product carried," not "transactions that happened."

Output of `18_RETRO.md`. Covers the session that produced `2f6ae5e..HEAD` — 20 commits, 8 production deploys.

---

## What shipped

| | |
|---|---|
| **Homepage restored** | Dead since `ddca447`. One missing element aborted `app.js`, unwiring every control on the site. |
| **Portal restored** | Two separate crashes: a stale `localStorage` payload, then a contract mismatch on `unprompted`. |
| **Sign-in restored** | `covenda.app` had never been verified in Resend. DNS moved to Vercel; domain now verified. |
| **RLS bypass closed** | Two `SECURITY DEFINER` views returned the full contact list to `anon`/`authenticated`. |
| **Outcome loop closed** | `placement_outcomes` existed with no UI. Chapter 32's north star had nothing writing to it. |
| **Company shortlist** | The operator's curated shortlist finally reaches the company. |
| **Accommodation promise honoured** | Panel and server both said "applying is not blocked while you wait"; the client blocked anyway. |
| **Student form fixed** | Reported by a real user, Veer, mid-session. |
| **Render fault isolation** | One bad field now costs its section, not the page. |
| **Seven planning documents** | Office hours → CEO → spec → design → eng → security → QA. |

---

## What produced user value

**Everything that came from running the product. Almost nothing that came from reading about it.**

The homepage crash, the portal crash, the dead mail path, the RLS bypass, the unwired outcome loop and Veer's form bug were all found by loading pages, clicking buttons, querying DNS and reading schemas. Each was real and each is fixed.

The findings that came from reading documentation — D-01, Q-07, Q-10 — were **all three wrong**. They looked like defects because a note said so, or because a pattern had been genuine three times before.

That is the sharpest lesson of the session and it has a number attached: **6 for 6 on things observed, 0 for 3 on things read.**

---

## Where the blueprint helped

- **Chapter 34's phase gates** made "you have built Phase 5 and never cleared Phase 1" a statement about the company's own plan rather than an opinion.
- **Chapter 29.5's visibility conditions** are why the shortlist leak (B-01) was findable at all — there was a written standard to check against.
- **Chapter 1.5's "inspect the existing codebase before proposing replacement architecture"** was the single most valuable instruction. Every time it was followed, the answer changed: `matches` already was the shortlist, `placement_outcomes` already was the outcome form, the operator matcher already existed, `api/evidence.js` already had eight importers.

## Where the blueprint created unnecessary scope

- **The 400-page spec makes everything look like V1.** 83 API endpoints and 63 migrations exist and not one has carried a transaction. (Revenue does exist: a company has paid. That deal closed manually, outside the product, which is the actual finding.) The document says not to do this — and it was done anyway, because a specification that describes everything is read as a backlog.
- **25 specialisations, batch scoring, simulations, the coursework ontology** are all built and all optimise a funnel with no demand behind it.

---

## Defects caught, and by what

| Source | Found |
|---|---|
| Driving a real browser | Homepage dead, Veer's form bug, portal render |
| Querying live infrastructure | Resend never verified, DNS at Porkbun, `www` broken |
| Reading schema | Outcome loop unwired, shortlist already existed |
| Supabase advisor | RLS bypass (independently confirmed) |
| A real user | The student form — **the only user-reported bug, and it arrived within hours** |
| **The 1,323-test suite** | **None of the four critical defects** |

That last row matters. The suite is a real asset and it caught nothing that was actually broken, because it asserted structure rather than behaviour.

---

## Test health

**1,323 → 1,375.** More important than the count: every test added was **verified failing against the defect it describes** before being committed. Three of my own tests failed during the session and were right to — a fixture that used a now-stripped key, an assertion pinning a line that got a better fix, and one false-positiving on a comment.

A test that has never failed is decoration.

---

## Security and privacy debt

**Paid down:** RLS bypass closed with a scanner over every view; `rationale`/`note`/`need` added to the log deny-list; `placement_outcomes` revoked from browser roles; visibility gate on the shortlist.

**Outstanding:** no audit events on the new surfaces (N-02); file-upload and parser paths never exercised; the Resend key created this session is in the transcript and must be revoked.

## Accessibility debt

**Paid down:** the accommodation route now works as promised — the defect was not a missing feature but a broken promise, made specifically to people who needed it. Tier is carried by text, not colour alone. `aria-live` and `focus-visible` on all new controls.

**Outstanding:** no screen-reader pass; the `alt=""` portrait at `index.html:719` is ambiguous.

---

## Repeated manual work worth productizing

- **Deploy is two commands and the second is forgettable.** `vercel --prod` then `vercel alias set`. Miss the alias and the domain silently serves the old build. Eight deploys, eight chances to forget.
- **Migrations require a human to paste SQL** while code deploys automatically. That gap is how the client got eleven migrations ahead of the schema and how rate limiting sat inert for days.

## Premature automation

None added. `matches.score` stays null with `scorer_version='manual-v1'`, which is correct: the engine should be measured against the operator's manual picks, and those picks are only now being recorded.

---

## Gaps in the decision ledger

**D7 was wrong** and became a blocking requirement in the spec on the strength of a stale note. **D6 was superseded** within a day by a schema audit. Both were corrected in place rather than quietly dropped.

The gap is not the errors — it is that both were written as decisions when they were **inferences from documentation**. A decision log should distinguish "we decided" from "we believe, based on X."

---

## 1. Keep

- Reproducing before diagnosing. It was right every time it was done and wrong every time it was skipped.
- Verifying a test fails against the defect before committing it.
- `Array.isArray(x) ? x : []` over `x || []`. Shape, never truthiness.
- Writing *why* in comments. The `fitTier` comment is the only reason D-01 got a second look, and the `validateStep` comment had already diagnosed Veer's bug before it was reported.

## 2. Change

- **Treat RESUME.md and any hand-written note as a lead, not a finding.** Three phantoms came from one stale file.
- **Add a synthetic browser check to CI.** Load the homepage, click a nav control, assert the DOM changed. Ten lines. It would have caught the homepage crash the day it shipped.
- **Make deploy one command** that aliases automatically.
- **Assert the applied migration head at startup.**

## 3. Stop

- Asserting a defect from a document without opening the file.
- Pattern-matching duplication as drift. Two of four "duplicate implementation" findings were correct designs.
- Writing planning documents ahead of a schema audit. The CEO review's build list was obsolete within a day.

## 4. Next sprint objective

**One authenticated end-to-end run of the core loop.** Brief → shortlist → introduction → approval → outcome, by a real signed-in operator, company and student. Nothing in the V1 spec has ever been executed by a real session, and the shortlist, worklist and accommodation gate are all currently verified only by source assertions.

## 5. One measurable product assumption to test

> **A founder shown five evidence-backed candidates will request a second shortlist.**

Falsified if fewer than 3 of 5 pilot companies ask again. It is assumption A1/A6 from office hours, it is the only success criterion that matters, and it needs no further engineering to test — the surface now exists.

## 6. Learnings worth saving

1. **Run it before you diagnose it.** 6/6 observed, 0/3 read.
2. **A stale note is worse than no note.** RESUME.md cost three phantom findings and one blocking requirement.
3. **HTTP 200 says the site serves, not that it works.** It returned 200 throughout a total outage.
4. **`x || []` is a truthiness test wearing a shape test's clothing.**
5. **A broken promise is worse than a missing feature.** The accommodation route existed, was well built, and lied.
6. **A test that has never failed is decoration.**
