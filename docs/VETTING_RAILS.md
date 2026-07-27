# Vetting rails

The constraints every vetting process runs inside, whatever the discipline.

---

## What a rail is

A vetting process is designed per vertical — robotics and private equity are judged on different
evidence, and pretending otherwise is how a generic assessment ends up measuring nothing. But
*differences* need a boundary, or twenty-five processes become twenty-five products.

A rail is a constraint that holds across all of them. Verticals differ in medium, task, and
what counts as a strong answer. They do not differ on any of the below.

---

## Rail 1 — the bar is published before it is applied

A student can read what they are being judged against before they are judged. A company can read
it before they trust the result.

This is the rail that makes the others enforceable. A private bar cannot be audited, cannot be
challenged, and drifts toward whatever the rater felt that day.

## Rail 2 — two raters, and disagreement is adjudicated

Every scored artefact is read twice. Where the two disagree beyond a threshold, it goes to
adjudication rather than being averaged.

Averaging two raters who disagree produces a number that neither of them believes. Inter-rater
reliability is tracked with Cohen's κ in `api/hardening.js`; a process whose κ is poor is a
process that is not measuring what it claims to.

## Rail 3 — no protected attribute, and no proxy for one

Never collected, never scored, never a feature: school, GPA, class rank, employer reputation,
gaps in history, age, gender, nationality, work authorisation, location.

Enforced in three places rather than one, because a rule in a single place is a rule with a
single point of failure:
- `api/portal.js` — excluded from `computeFitScore`
- `api/ml-data.js` — excluded from training export
- `api/resume-questions.js` → `stripProxies()` — removed from *model output*, because a model
  told not to probe prestige still occasionally does

## Rail 4 — the student sees no score

Scores are operator-only and explicitly non-binding (`api/batch-score.js` → `operatorOnly: true,
binding: false`). `studentView()` returns no number at all.

A visible score turns an application into a leaderboard, and a leaderboard changes what people
submit. It also implies a precision the process does not have.

## Rail 5 — nothing is automated into a decision

Every stage produces evidence for a human. No stage produces an outcome. The learned re-ranker
in `api/ml.js` refuses to emit a model below fifty completed outcomes and, past that gate, runs
in shadow (`api/scoring.js`).

There is no stage at which a model decides alone. That is a design constraint, not a current
limitation to be relaxed later.

## Rail 6 — the work envelope

No brief may require PII, PHI, production system access, credentials, or spend
(`checkAgainstEnvelope()`). Inputs must be public, synthetic, or explicitly founder-approved.

## Rail 7 — AI use is disclosed, never detected

Covenda does not run AI-detection on submissions. Detection is unreliable, and a false positive
accuses a student of cheating on the strength of a classifier nobody can inspect.

Instead the process captures what happened: prompts used, what the student verified themselves,
what they did without assistance. A recorded walkthrough answers the authorship question far
better than a detector, because a model cannot sit for the interview.

## Rail 8 — a refusal is a valid output

A brief that is not both useful and discriminating is refused rather than run
(`api/brief-engine.js`). A revision requires a stated reason. An exercise that cannot separate a
strong candidate from a weak one wastes the student's time and tells the company nothing.

---

## What is deliberately NOT a rail

**Time limits.** Some processes are timed because the work is; others are not. Imposing a
universal clock would measure typing speed in disciplines where it is irrelevant.

**A common scale.** A software score and a consulting score are not comparable and are not made
comparable. Forcing them onto one scale would invent a precision that does not exist.

**Video.** Screen recording suits work that happens on a screen. Robotics work happened on
hardware months ago, so that vetting is conversational (`api/session-script.js`). The rail is
"capture the reasoning", not "capture the screen".

---

## Where this connects

- `docs/VETTING_MATRIX.md` — every vertical against every rail
- `api/hardening.js` — κ tracking and the scorer gate
- `api/brief-engine.js`, `api/frameworks.js` — refusal and envelope
- `docs/AI_AUTHENTICITY.md` — the reasoning behind Rail 7
