# Implementation prompt — Per-batch readiness plan

**Status:** Requirement (per the blueprint's §1.4 labels)
**Depends on:** `api/batches.js`, `api/technical-evidence.js`, `api/roles.js`, `api/course-ontology.js`

---

## What to build

A student who puts their profile (or pastes a resume) into a batch sees **what to work on for
that specific batch**: the gap between what they have shown and what that batch reads for,
ordered, with a concrete artifact named for each item.

One personalised plan per batch, derived from evidence already recorded. Not a new form.

---

## Inspect before writing anything

The blueprint's rule 1 is non-negotiable and most of this already exists. Read these first:

| What you need | Where it already is |
|---|---|
| The batch's core skills, weighted | `SPECIALISATION_SKILLS[slug]`, `coreWeights()` — `api/batches.js` |
| Which of them the student is missing | `batchCompatibility(...).missing` — already returned |
| The six scored components and their ceilings | `batchCompatibility(...).components` |
| Concrete artifacts this batch accepts | `acceptsFor(slug)` — `api/batches.js:586` |
| What evidence would prove a skill | `COMPETENCIES[id].provenBy` — `api/course-ontology.js` |
| Gaps already phrased as next actions | `technicalGaps(profile)` — `api/technical-evidence.js:491` |
| Evidence recommended for a request | `evidencePlanFor(profile, request)` — `api/technical-evidence.js:664` |
| Skills read out of a resume | `extractSkills(text)` — `api/roles.js` |
| Strongest tier reached per skill | `tierBySkill` map, built in `api/portal.js` before `batchesWithFit` |

**Extend these. Do not write a second scorer, a second skill extractor, or a second gap
generator.** Two of anything here will drift and start disagreeing on screen.

---

## The model

Add to `api/batches.js`:

```
batchReadinessPlan(batch, profileContext) -> {
  version,
  batch: { slug, name },
  standing: { covered, total, evidenced },   // counts, not a grade
  items: [
    {
      skill,                 // the missing or unevidenced core skill
      weight,                // its position weight in this batch, so order is defensible
      have: 'none' | 'stated' | 'evidenced',
      build,                 // ONE concrete artifact, taken from acceptsFor(slug) or provenBy
      why,                   // one sentence: what this batch reads it for
      lifts: [componentId],  // which scored components this would move
    }
  ],
  note,
}
```

**Ordering is by the batch's own weight, not by what is easiest.** `coreWeights()` already
ranks a batch's skills by centrality; the plan follows it. A plan sorted by convenience tells
a student to do the cheap thing first, which is how you get a profile of small artifacts.

**`have` has three states, not two.** A skill that is stated but unevidenced is a different
job from one that is absent: the first needs proof, the second needs the skill. Collapsing
them makes the plan wrong for the more common case.

---

## Hard rules

These come from the blueprint's §1.5 and from constraints already enforced in this codebase.
Each has a test to write alongside it.

1. **No readiness score, no percentage complete, no rank.** Report counts and the ordered
   list. A composite here would be the exact thing rule 4 forbids, and it would be uncalibrated
   because nothing has been placed.
2. **Never presented as admission.** `evaluateBatchAdmission` remains the only gate. The plan
   says what would strengthen an application, never that following it produces one. Copy must
   not imply otherwise.
3. **Every item names a concrete artifact.** A gap with no route attached is a rejection with
   extra words. If no artifact can be named for a skill, omit the item rather than emit advice.
4. **Coursework never counts toward the plan being met.** It is `claimed` tier and excluded from
   matching; it may suggest what to build, never satisfy it.
5. **A pasted resume is read and dropped.** Same contract as `matchResumeToRoles`: no insert,
   no update, no storage. Test it by grepping the handler.
6. **Refusals return, never throw past the caller.** Input errors must start with a prefix in
   `/^(Enter|Choose|Only|Account|This|Please|Add|Describe|A refresh)/` or the portal returns 500
   instead of 400.
7. **Do not use school, GPA, or club membership.** `BANNED_FIELDS` in
   `api/compatibility.config.js` already lists them; the plan must not reintroduce them.

---

## The surface

Inside a batch's existing **Details** panel, below "How this score is built" — the score is the
claim, the plan is what to do about it, and they belong together.

- Show the top **three** items expanded, the rest behind a disclosure. A twelve-item list is a
  wall, and the weight ordering means the first three are the ones that matter.
- Each item: the skill, what to build, and which components it lifts.
- If the student has nothing on their profile, show the paste-a-resume box that already exists
  on the roles panel rather than an empty state.
- State plainly that this is guidance and not a gate.

---

## Definition of done

- `batchReadinessPlan` is unit-tested against a fixture batch with a student who has (a) nothing,
  (b) stated skills only, (c) evidenced skills. All three produce sensible, ordered plans.
- A test asserts the returned object has no `score` / `readiness` / `percent` / `rank` key.
- A test asserts every item carries a non-empty `build`.
- A test asserts the plan is reachable from the portal and rendered in the batch Details panel —
  a model with no callers is not a feature, and this codebase has shipped that mistake before.
- The full suite passes and the change is verified in a real browser, not by reading the CSS.
