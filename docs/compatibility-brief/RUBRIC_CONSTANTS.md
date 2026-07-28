# RUBRIC CONSTANTS — port verbatim

These constants were calibrated against 216 labeled pairings and agree with Tyler's hand-written anchors 83% of the time. Do not substitute your own values. Put all of them in a single config file (`api/compatibility.config.js`) with these comments intact.

## Domain families

Every evidence item and every project is tagged with a family: `ml`, `data`, `eng`, `fin`, `research`, `growth`.

## Project adjacency — directional, per project

Adjacency is a property of the project, not a symmetric graph. A banker can run a market study, so finance evidence counts toward a research brief. A market researcher cannot build a three-statement model, so a modeling brief admits finance evidence only.

```js
const PROJECT_FAMILY = {
  P001: { direct: "ml",       adjacent: ["data", "eng"] },
  P002: { direct: "data",     adjacent: ["ml", "eng"] },
  P003: { direct: "fin",      adjacent: [] },
  P004: { direct: "research", adjacent: ["fin", "growth"] },
  P005: { direct: "growth",   adjacent: ["research"] },
  P006: { direct: "eng",      adjacent: ["ml", "data"] },
};
```

New projects must declare `direct` and `adjacent` explicitly at creation. When a project names a specific craft, `adjacent` is an empty array.

## Evidence weights

```js
const EVIDENCE_WEIGHT = {
  accepted_trial: 1.00,  // a real employer already said yes
  verified:       0.80,  // deliverable reviewed by Covenda
  assessment:     0.55,  // passed Covenda assessment
  resume:         0.38,  // real signal, unverified authorship
  self:           0.12,  // assume unverified
};
```

## Relevance and staleness multipliers

```js
const RELEVANCE = { direct: 1.00, adjacent: 0.50, unrelated: 0.15 };

// staleness by evidence age in months
// <= 24 -> 1.00 ; 25-36 -> 0.50 ; > 36 -> 0.35
```

## Top-three decay

Score each evidence item as `EVIDENCE_WEIGHT × RELEVANCE × staleness`, sort descending, take **only the top three**, and weight them `1.00 / 0.55 / 0.30`. Sum.

The cap exists so breadth of weak claims can never out-score one strong item. A student with nine self-reported claims must not beat a student with one accepted trial in the right domain. Do not remove it.

## Thresholds

```js
const ACCEPT_THRESHOLD = 0.42;  // capability bar
const REPEAT_THRESHOLD = 0.68;  // bar for would-request-again
const NO_DIRECT_FLOOR  = 0.60;  // bar when no evidence is direct-family
const TIMELINE_HARD    = 0.65;  // capacity ratio floor
const TIMELINE_SOFT    = 1.00;  // below this, deadline risk costs the rating
const EMPLOYER_NAME_BONUS = 0.03; // discrete, ablatable; set to 0 to test
```

## Timeline math

```
requiredHoursPerWeek = estimatedHours / (deadlineDays / 7)
capacity             = availabilityHoursPerWeek * (deadlineDays / 7)
capacityRatio        = capacity / estimatedHours
```

Policy — note this DIFFERS from the Python generator, which hard-failed low ratios. Tyler overruled that:

- `weeksAvailable * 7 < deadlineDays` → student is gone before it is due → not shown, `failing: timeline`
- `capacityRatio < 0.65` → still scored and shown on capability, tier capped at **Moderate fit**, prominent timeline warning, `failing: timeline`
- `0.65 <= capacityRatio < 1.00` → scored normally, tier capped at **Moderate fit**, timeline warning shown
- `capacityRatio >= 1.00` → no timeline effect

Never let a timeline problem be reported as a capability verdict.

## Negative history

A prior rejected or abandoned trial in the project's direct or adjacent family caps the tier at **Exploratory fit** and sets `failing: history`. A strong skills list does not override it. Surface it honestly in the uncertainty line.

## No-direct-evidence rule

If nothing in the evidence is direct-family, the domain is unproven: require `NO_DIRECT_FLOOR` (0.60) instead of `ACCEPT_THRESHOLD` (0.42).

**Known open question — implement the rule as written and flag it:** whether verified capability in one domain should transfer to another is an unresolved product decision. Tyler's anchors say a strong analyst can probably handle an adjacent technical brief; the current rule says otherwise. Make `NO_DIRECT_FLOOR` a single config value so the policy can be changed in one place, and log how many recommendations it suppresses so the decision can be made on data later.

## Tier mapping

Map the final score to tiers. Start with these and re-tune using the calibration sweep:

```js
const TIERS = [
  { name: "High fit",        min: 0.68 },
  { name: "Moderate fit",    min: 0.42 },
  { name: "Exploratory fit", min: 0.30 },
];
// below 0.30 -> not shown
```
