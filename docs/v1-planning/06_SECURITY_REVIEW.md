# Security Review — Covenda V1

Output of `06_SECURITY_REVIEW.md` (`/cso`). Findings verified against the repository, the live deployment, and the Supabase advisor.

---

## Verdict

**Posture is above average for a pre-revenue product**, and materially better than the codebase's own history would predict. Secrets are handled correctly, the primary PII table is properly locked down, the API authenticates consistently, and rate limiting and error logging were designed with the right failure semantics.

Two real defects were found and fixed during this review. One systemic gap remains.

The thing worth stating plainly: Covenda's product is *trust*. A privacy failure here is not a security incident, it is a thesis failure. The system holds names, emails, schools, and stated career interests of students who have not yet consented to being visible to anyone.

---

## Findings

### S-01 — RLS bypass via `SECURITY DEFINER` views · **Critical · FIXED**

`public.submissions` is correctly locked:

```sql
alter table public.submissions enable row level security;
revoke all on table public.submissions from public, anon, authenticated;
grant select, insert, update on table public.submissions to service_role;
```

But `people_directory` and `people_possible_duplicates` read that table, and a Postgres view executes as its **owner**. Neither declared grants, so both inherited the default `public` schema grants to `anon` and `authenticated`.

Two ordinary-looking views returned **the entire contact list** — every name, email, school and stated interest ever submitted — to precisely the roles the table denies.

Supabase's linter rates this critical (rule `0010_security_definer_view`) and is right.

**Exploitability at time of discovery:** not currently leaking. The browser never receives a Supabase key; every read goes through `/api/*` on the service role. But the `anon` key is *designed to be publishable*. A protection that holds only while a publishable key stays private is not a protection.

**Fix (shipped):** `security_invoker = on` on both views so they execute as the caller, plus explicit `revoke ... from public, anon, authenticated` so the default schema grants cannot be silently re-inherited on recreation. The original migration was fixed too, so a fresh database is never briefly vulnerable. `tests/model/view-security.test.js` walks every view in every migration and fails on any without `security_invoker` — verified failing against the vulnerable files first.

---

### S-02 — Rate limiting and error logging inert for days · **High · RESOLVED**

`20260728200000_infrastructure` (rate limits, `error_events`, `video_url` index) sat unapplied while `RESUME.md` recorded applied state as `fit_dimensions` — 11 migrations behind.

Both subsystems **fail open by design**, which is the correct choice (`api/limits.js`: *"a limiter that takes the product down when its own table is missing has caused more damage than the abuse it was guarding against"*). The consequence is that for several days:

- `magic-link-ip` (5 per 10 min) and `magic-link-address` (6 per hour) enforced **nothing** — the magic-link endpoint is pre-auth and internet-reachable
- `resume-interview` (10/hr, calls the Anthropic API per upload — a direct cost path) enforced nothing
- No error was recorded anywhere queryable

The limiter appeared to protect while protecting nothing. That is the specific failure mode the module's own header warns about.

**Root cause is process, not code:** code deploys are automated (`npx vercel --prod`), migrations require a human to paste SQL. Two independent paths, one automated. See **E-07** in the engineering review.

---

### S-03 — No migration-head assertion · **Medium · OPEN**

Nothing detects client/schema drift. This is how S-02 persisted unnoticed, and is a plausible source of the `{}`-instead-of-`[]` shape mismatch that crashed the portal.

**Recommendation:** assert applied migration head against expected head at startup; log loudly on mismatch. `scripts/preflight.mjs` already performs this class of check for local dev.

---

### S-04 — Secrets handling · **PASS**

- `.gitignore` covers `.env*`
- No live credential in tracked source. The one commit matching `SUPABASE_SERVICE_ROLE_KEY=` (`e180000`) adds a **test** referencing the variable *name*, not a value.
- All Vercel env vars are **Sensitive** type — write-only, unreadable even by `vercel env pull`, which returns `[SENSITIVE]`. Strong posture.

**Consequence to document:** credentials cannot be read back, so rotation needs a runbook. During this session, fixing Resend required a *new* API key because reading the existing one was impossible by design.

**Action:** the Resend key `re_VZNK…` created during this session appears in the session transcript and **must be revoked.**

---

### S-05 — API authorization · **PASS**

- Every HTTP handler authenticates. An initial scan flagged files lacking `authorizeMember`, but all except one are library modules; the exception (`ats-push.js`) authenticates via `userFrom()` and returns 401.
- `sameOrigin(req)` rejects cross-origin POSTs before any work.
- Bearer tokens validated server-side against Supabase.
- Errors do not leak internals: `portalFailure()` returns generic messages for unknown errors, passing through only a whitelisted set of user-actionable prefixes.

---

### S-06 — PII in logs · **PASS, extend**

`safeDetail()` in `api/limits.js` strips keys matching `/token|secret|key|password|authorization|cookie|email|phone/i` and keeps only shallow scalars. Error logging explicitly never records a request body — *"a log that quietly accumulates user data is a breach waiting to be found."*

**Extend the deny-list to `rationale` and `note`.** V1 introduces `matches.human_rationale` (an operator's candid written assessment of a named person) and `placement_outcomes.note`. Neither belongs in an event payload.

---

### S-07 — Student visibility defaults · **Medium · OPEN**

Ch. 29.5 defines visibility gates: profile complete, identity confirmed, ≥1 evidence item, privacy configured, available, no unresolved integrity issue.

**Requirement for V1:** a student who has not explicitly configured privacy must be **invisible**, not defaulted-in. R-01's shortlist builder must enforce every gate server-side, not merely filter in the UI. A student appearing on a founder's shortlist without having consented to visibility is the single worst failure this product can have.

---

### S-08 — Introduction consent gate · **PASS, must stay server-enforced**

`introductions` models consent correctly: `status`, `student_response`, `responded_at`, and messaging gated on acceptance.

**Requirement:** the gate must be enforced in the API, not only the UI. R-04's acceptance criteria state this. A UI-only gate is not a gate.

---

## Threat model for the pilot

| Threat | Likelihood | Impact | Status |
|---|---|---|---|
| Contact list exfiltrated via views | Was possible | **Severe** | Fixed (S-01) |
| Magic-link endpoint abused to spam an inbox | Medium | Medium | Fixed by applying migration (S-02) |
| Cost attack on `resume-interview` | Low | Medium | Fixed (S-02) |
| Student surfaced without consent | **Medium** | **Severe** | Open (S-07) |
| Operator rationale leaked to the student | Low | High | Open (S-06) |
| Credential in transcript | **Certain** | Medium | Revoke `re_VZNK…` |
| Client/schema drift | Medium | Medium | Open (S-03) |

---

## Required before the pilot

| ID | Action | Priority |
|---|---|---|
| S-04a | Revoke the Resend key from this session | **Immediate** |
| S-07 | Enforce Ch. 29.5 visibility gates server-side | **Blocking** |
| S-06a | Add `rationale`, `note` to the `safeDetail` deny-list | **Blocking** |
| S-08a | Assert consent gate server-side in tests | **Blocking** |
| S-03 | Migration-head assertion | High |
| — | Confirm `matches` / `placement_outcomes` revoked from browser roles | **Blocking** |

---

## What this review is not

It is not a penetration test, and no live exploitation was attempted beyond read-only DNS and API status checks against the owner's own infrastructure. Ratings are based on source review, schema audit, the Supabase advisor, and observed production behaviour.

Untested and worth doing before real student data: file-upload handling (`file-upload.js`, `video-upload.js`, `xlsx-parse.js`, `doc-parse.js`) — parsers on user-supplied files are a classic vector and were out of scope here.

---

## Next command

`/qa-only` with `docs/gstack-prompts/07_BASELINE_QA.md`.
