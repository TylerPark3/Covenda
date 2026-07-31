# Baseline QA — Covenda

Output of `07_BASELINE_QA.md` (`/qa-only`, report only). Executed against the live product with a real browser, not a desk review.

---

## Current state: green

| Surface | Result |
|---|---|
| `covenda.app` | **200** |
| `covenda.app/portal.html` | **200** |
| `covenda.app/admin.html` | **200** |
| `www.covenda.app` | **200** ✅ *(was failing TLS)* |
| `POST /api/portal` `auth-readiness` | `{"ok":true,"googleConfigured":true}` |
| `POST /api/portal` `batch-briefs` | 200 |
| Homepage console errors | none |
| Homepage nav interaction | `home → student` ✅ |
| Resend domain | **verified** (DKIM, SPF, MX all green) |
| Test suite | 1,323 pass / 0 fail |

---

## Defects found and fixed during this baseline

Four production defects. Three had been live before this session began.

### Q-01 — Homepage completely unresponsive · **Critical · FIXED**

Every button and nav control on `covenda.app` did nothing. No console error, no failed request — the page rendered perfectly and responded to nothing.

`app.js:1897` called `$('[data-clear-draft]', form).addEventListener(...)`. Commit `ddca447` removed `[data-clear-draft]` from `index.html` and left the line. The selector returned `null`, the call threw, and because `app.js` wires the whole page in one uninterrupted top-level pass, **every listener below line 1897 never attached** — audience nav, workspace tabs, work-type buttons, all dialog close buttons, nav targets, `data-action` buttons, the intro screen.

Present before this session. Diagnosed by re-executing `app.js` in a `try/catch` against the live DOM.

### Q-02 — Portal crash presenting as a sign-in failure · **Critical · FIXED**

Signed-in members were dropped on the sign-in screen under `object is not iterable (cannot read property Symbol(Symbol.iterator))`.

`portal.js:5063` — `for (const sig of (t.unprompted || []))` where the server returned `{}`. An object is truthy, so `|| []` passed it through to `for...of`, which threw and took the entire dashboard with it.

**Took three attempts to locate.** V8 names the source when it can (`t.unprompted is not iterable`) but for a *parenthesised* expression it cannot, emitting the same message a bad `new Set(obj)` produces. That collision sent two searches down the wrong path — an audit of all 26 native-constructor sites came back clean while the bug sat in a `for...of`.

Fixed by `asList()` across all 25 sites in `portal.js`, `app.js`, `admin.js`.

### Q-03 — Onboarding lockout · **Critical · FIXED**

`startOnboarding()` built values with `Array.isArray` guards, then merged `localStorage` verbatim. A stale payload replaced a guarded array and reached `new Set(...)`, throwing. Because the bad state lived in `localStorage`, reloading replayed the crash forever.

### Q-04 — Sign-in email entirely dead · **Critical · FIXED**

Both mail paths were down: Resend rejected `covenda.app` (never verified, added 2026-07-27 with no DNS records ever created), and the Supabase fallback mailer also failed.

Fixed by adding the three records once nameservers moved to Vercel. Domain now **verified**.

### Q-05 — `www.covenda.app` broken · **FIXED (incidentally)**

Hit Porkbun's parking wildcard `*.covenda.app → pixie.porkbun.com` and failed TLS. Resolved automatically by the nameserver move.

---

## Open defects

### Q-06 — Product renders a score its own code forbids · **High**

`fitPill` renders `${s}% fit` at 3 call sites; `fitTier` renders a tier label and carries the comment *"The number stays available to the operator, never rendered to the company."* Violates Ch. 4.2, Ch. 1.5 instruction 4, and D10. → **D-01**

### Q-07 — Two evidence ladders · **High**

`api/evidence.js` vs `portal.js`'s `studentEvidenceTier`. Two definitions of "verified" in a product whose thesis is verification. → **R-07**

### Q-08 — Outcome capture has no UI · **High**

`placement_outcomes` exists; zero references in `portal.js` or `admin.js`. Ch. 32's north star cannot be measured. → **R-05**

### Q-09 — Walkthrough has no accessibility path · **High**

Required video with no text alternative, captions requirement, or accommodation route. `accommodation_requests` exists in schema and is unwired. → **R-09 / D-12**

### Q-10 — Examples presented as real · **Medium**

Every example on the site is illustrative. A product whose thesis is evidence over claims cannot lead with synthetic evidence. → **R-08 / D8**

### Q-11 — Render has no fault isolation · **High (systemic)**

Q-01 and Q-02 were both single-line errors that took entire pages down. Until render sections are individually fault-tolerant, any future null or shape mismatch does the same. → **E-01**

---

## Untested — genuine coverage gaps

Not "passed" — **not exercised**, and stated as such:

| Area | Why untested |
|---|---|
| Authenticated portal flows | No test account; sign-in was dead for the whole session |
| Admin surfaces | Requires admin credentials |
| File upload / parsing | `file-upload`, `video-upload`, `xlsx-parse`, `doc-parse` — needs auth and fixtures |
| Payment / escrow | Stripe paths not exercised |
| Mobile / responsive | Desktop viewport only |
| Screen-reader behaviour | No assistive-technology pass |
| Cross-browser | Chromium only; the reported error strings are V8-specific |

**The first is the most important.** Every authenticated flow the V1 spec depends on — shortlist, introduction, outcome — is unverified end to end. Now that email works, that is the first QA to run.

---

## Assessment

Three of four critical defects predate this session and were **invisible**: the site returned HTTP 200 throughout while being completely unusable. Uptime monitoring would have shown green the entire time.

That is the durable lesson. `curl` proves the site *serves*; it says nothing about whether it *works*. Both Q-01 and Q-02 were found only by driving a real browser and clicking.

**Recommendation: a synthetic browser check in CI** — load the homepage, click a nav control, assert the DOM changed. Ten lines. It would have caught Q-01 the day `ddca447` shipped.

The test suite is a real asset at 1,323 tests, but **all four critical defects passed it**. Tests added since are behavioural and each was verified failing against the broken version first.

---

## Priority order

1. **Q-08** wire outcome capture — nothing else produces learnable data
2. **Q-11** render fault isolation — prevents recurrence of Q-01/Q-02
3. **Q-06** delete `fitPill`
4. **Q-07** collapse evidence ladders
5. **Q-09** accessibility path
6. **Q-10** remove illustrative examples
7. Authenticated end-to-end QA, now that sign-in works

---

## Sequence complete

All seven planning steps are written to `docs/v1-planning/`. Per `README_RUN_ORDER.md`, prompts 08–26 are the **per-feature loop** — run per feature, not once — and 14–17 (`/ship`, `/land-and-deploy`, `/canary`, `/document-release`) deploy to production. They were deliberately not run.
