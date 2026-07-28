# SPEC — Compatibility Score Contract

Decisions locked by Tyler, July 2026. Changing any of these requires updating this file first.

## 1. Target variable

The score predicts `P(deliverable accepted AND positive employer rating)`.

- One binary label per completed trial
- `label = 1` when the employer accepts the deliverable AND answers YES to the close-out question
- `label = 0` for rejection, abandonment, or acceptance with a NO rating

**Close-out question (exact wording):** "Would you request this student for future work?" [Yes / No]

This question is mandatory and server-enforced. The employer cannot close out a trial, and the student's verified work record is not issued, until it is answered. The coupling is intentional — the employer's rating unlocks the student's credential.

**Validation metric (not a training target):** actual employer repeat behavior within 30 days. Tier assignments must correlate with real repeat rate.

## 2. Allowed inputs

1. Verified evidence items, weighted by verification level
2. Assessment and defense results
3. Skills and skill confidence
4. Availability and deadline feasibility
5. Stated interests
6. Past Covenda trial outcomes, including negative ones
7. Full resume work history, employer names included

**Employer-name rule:** employer name is a discrete, inspectable, ablatable feature. Never blend it into a text embedding. Setting its config weight to 0 must change scores by exactly its configured contribution and nothing else.

## 3. Banned inputs — enforce in code, not convention

- School name, school prestige, or any proxy
- GPA
- Clubs, fraternities, prestige affiliations
- All protected attributes and proxies

Strip these from the student object before it reaches the scoring path. A unit test must prove two profiles differing only by school name score identically.

## 4. Output format

Three tiers only. Never expose a raw percentage to an employer.

- **High fit**
- **Moderate fit**
- **Exploratory fit**
- Below the floor: not shown

Every tier ships with:
- Top 3 reasons, each citing a specific evidence item
- Exactly 1 stated uncertainty
- A timeline warning line when capacity ratio < 1.0 (see RUBRIC_CONSTANTS.md)

**Consistency rule:** reasons are generated FROM the top-weighted scoring features. Never written independently. Score and reasons must never disagree.

## 5. Compatibility is not admission

Compatibility predicts outcomes. Admission is a published requirements checklist living in `api/batches.js`. Never blend them. A High-fit student who fails a batch requirement sees the specific gap and how to close it — never a bare rejection.

## 6. Availability policy

Availability is a **scoring factor with a visible warning, not a hard gate**. Rationale from Tyler: availability has nothing to do with capability. A brilliant student with 2 hrs/week still surfaces, with the timeline risk shown plainly to the employer so nobody is surprised at the deadline.

Capability and timeline are separate judgments. The output must always name which one is weak.

## 7. Data provenance

Every label row carries `source`: `real_trial` | `founder_rating` | `synthetic`.

- Synthetic data is for pipeline testing and threshold calibration only
- Never mix sources in a query, export, or future training run without an explicit flag
- No external claim of "trained on outcomes" until real labels exist
