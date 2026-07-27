# The evidence graph

How a claim becomes something a company can rely on, and what stops it moving further.

---

## The problem

A student says "I can build React interfaces." A company reads it. Nothing about that sentence
tells the company whether it is true, and every platform in this market resolves the ambiguity
the same way: by falling back on the school name, which is a proxy for admissions decisions made
when the person was seventeen.

Covenda resolves it by **attaching a source to every claim and enforcing a ceiling per source**.

---

## The five tiers

Implemented in `api/evidence.js`.

| Tier | What it means | Who can create it |
|---|---|---|
| `claimed` | The student said it | The student |
| `artifact` | A file, repo, or link exists | The student, plus an automated read |
| `contribution` | Their specific part is identified | The student, corroborated |
| `observer` | Someone who watched the work confirms it | A named third party |
| `employer` | A company confirms delivered work | A company, post-engagement |

A tier is never inferred. It is granted by a source, and the source has a ceiling.

---

## Ceilings are enforced, not trusted

This is the part that matters, and it is the reason the ladder is not decorative.

```
Club membership          → caps at `claimed`
Third-party assessment   → caps at `artifact`
Connected GitHub account → caps at `contribution`
Named observer, verified → caps at `observer`
Completed Covenda trial  → reaches `employer`
```

**A source cannot promote a claim above its own ceiling, however confident it is.** A club
officer confirming "yes, they were in the club" is real information, and it says nothing about
whether the person can build anything — so it caps at `claimed` and no amount of enthusiasm in
the endorsement text moves it.

This is enforced in code rather than in policy, because a policy that lives in a document is a
policy that drifts the first time someone is in a hurry.

---

## Why an assessment platform caps at `artifact`

A third-party assessment produces a score. A score is an artifact: it exists, it is real, and
it was produced under conditions Covenda did not observe.

Covenda cannot see whether the person sat it alone, whether they had the questions in advance,
or whether the vendor's own validation holds. So the score is recorded, shown, and capped. It
is evidence *that a test was taken*, not evidence that the underlying capability exists.

Treating a vendor's number as ground truth would mean outsourcing the one judgement Covenda
exists to make.

---

## Invitation is not endorsement

The single most common way an evidence graph gets corrupted is by treating a referral link as a
professional vouch.

- **Invitation** — someone sent this person a link. It explains how they arrived. It is not
  evidence of anything and grants **no tier**.
- **Endorsement** — a verified person confirms a specific contribution they directly observed.
  It grants `observer`, and only for the specific claim it names.

A student who arrives through a professor's link has not been endorsed by that professor. If
the professor separately completes an endorsement naming what they saw, that is a different
object with a different tier.

---

## What a company sees

Not a total. A per-claim tier, with the source named.

```
Python              observer      Prof. Lee, confirmed the pipeline work
SQL                 artifact      Connected repository, 14 months of commits
React               claimed       Self-reported, no evidence attached
Financial modelling artifact      Spreadsheet uploaded, opened and read
```

The `claimed` row is shown, not hidden. A company that can see which claims are unevidenced can
weigh them; a company shown only the strong ones is being managed.

---

## What deliberately does not exist

**No composite evidence score.** Summing tiers into a single number would make the ladder
decorative — the whole point is that a company can see *which* claim is strong and which is not,
and a total destroys exactly that.

**No decay.** A confirmed contribution from two years ago is still a confirmed contribution.
Time-decaying evidence would quietly penalise students who worked earlier, which is a proxy for
age.

**No tier a student can grant themselves above `claimed`.** Uploading a file reaches `artifact`
because a file can be opened and read. Nothing a student can type moves them higher.

---

## Where this connects

- `api/evidence.js` — the registry, the ceilings, and the enforcement
- `api/portal.js` → `computeFitScore` — reads tiers when weighting a skills match
- `api/ml.js` → `evidence_depth` — a tier-weighted feature, gated with the rest of the model
- `docs/VETTING_MATRIX.md` — which tier each vertical's process can reach
