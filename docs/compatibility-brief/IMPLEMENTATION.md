# IMPLEMENTATION — what to build

Four parts. Part B is the most important; if time is short, do A and B properly and stub C and D.

---

## Part A — `api/compatibility.js`

Export `scoreMatch(studentId, projectId)`.

### Step 1: strip banned fields
Build a sanitized student object. School, GPA, clubs, and affiliations must be physically absent, not merely unused.

### Step 2: rubric score
Implement exactly as specified in `RUBRIC_CONSTANTS.md`: per-item `weight × relevance × staleness`, sort, top three with decay `1.00 / 0.55 / 0.30`, sum. Add `EMPLOYER_NAME_BONUS` as a separate additive term, tracked separately in the return value.

### Step 3: semantic layer (additive, optional at v1)
Embed the project brief once. Embed each evidence item **individually** — never the profile as one blob. Cosine similarity × the same verification weight. Use this to break ties and to generate reason text. If no embeddings provider is configured, the rubric score alone must still work; the system degrades gracefully.

### Step 4: modifiers
Apply timeline, negative history, and no-direct-evidence rules per RUBRIC_CONSTANTS.md. Each modifier records what it did.

### Step 5: output

```json
{
  "tier": "High fit",
  "reasons": [
    { "evidenceId": "...", "kind": "verified", "family": "fin",
      "text": "Verified financial model — closely matches your valuation task" }
  ],
  "uncertainty": { "capability": "...", "text": "..." },
  "timelineWarning": "2 hrs/week available against ~6 hrs/week needed" | null,
  "failing": "capability|timeline|history|engagement|none",
  "internals": {
    "rubricScore": 0.71,
    "employerNameContribution": 0.03,
    "topItems": [ ... ],
    "modifiersApplied": [ ... ]
  }
}
```

`internals` is never sent to employer-facing UI. It exists for founder dashboards and ablation checks.

Reasons must be the actual top-weighted contributing items. Never generate reason text independently of the score.

---

## Part B — Outcome and event logging

This is the part that matters most. It is what turns operations into proprietary training data.

Create an **append-only** `match_events` store. Every event records: timestamp, matchId, studentId, projectId, and **the complete feature vector and score at time of scoring**. Features drift; a label is worthless unless paired with the features that produced the recommendation.

Event sequence:

```
match_shown -> employer_viewed -> employer_shortlisted -> trial_funded
-> deliverable_submitted -> revision_requested (count)
-> deliverable_accepted | deliverable_rejected | trial_abandoned
-> closeout_rating (boolean)
-> repeat_within_30d (backfilled by a daily job)
```

### Close-out gate
Server-enforced. Trial close-out and verified-work-record issuance both block until `closeout_rating` is answered. This is a hard requirement, not a UI nicety.

### Nightly label materialization
Write to `training_labels`:
- `label = 1` iff `deliverable_accepted` AND `closeout_rating = true`
- `label = 0` for rejected, abandoned, or accepted-with-negative-rating
- Columns: `matchId`, `label`, `featureVectorAtScoring`, `source = 'real_trial'`, `createdAt`

### Founder weak labels
A founder-only screen: rate any match 1-5 for expected fit, optional one-line rationale. Under 10 seconds per rating. Stored with `source = 'founder_rating'`.

---

## Part C — Synthetic data endpoints

Dev-only, isolated:

- `POST /api/dev/synthetic/student` — accepts a student object, creates it flagged `synthetic: true`
- `POST /api/dev/synthetic/project` — same for projects
- `POST /api/dev/synthetic/outcome` — matchId + accepted + rating, writes with `source = 'synthetic'`
- All three accept arrays for bulk load
- Synthetic records are excluded from every employer-facing surface, metric, and export unless `includeSynthetic=true` is passed explicitly

---

## Part D — Validation and calibration scripts

### `scripts/validate-against-calibration.js`
Loads `calibration_dataset.csv`, runs `scoreMatch` on all 216 pairings, compares predicted accept/repeat to the CSV labels. Prints overall agreement, agreement on `label_source = human_anchor` rows separately, and a list of every disagreement with both rationales.

**Bar: >= 80% overall agreement.** The reference implementation hits 83% against human anchors. Below 80% means the port is wrong — debug the port, do not retune the constants to force a pass.

### `scripts/calibrate-thresholds.js`
Sweeps tier boundaries across the loaded dataset and reports, per tier, the share of pairings with `label = 1`. Purpose: confirm High fit carries a materially higher label rate than Moderate. Report only — never auto-writes config.

---

## Required tests

1. **School invariance** — two profiles differing only by school name produce byte-identical output
2. **Employer-name ablation** — setting `EMPLOYER_NAME_BONUS` to 0 changes the score by exactly the configured contribution and nothing else
3. **Close-out gate** — attempting to close a trial or issue a work record without a rating fails server-side
4. **Synthetic isolation** — a default query returns zero synthetic records; `includeSynthetic=true` returns them

---

## Constraints

- No ML libraries. No training. Deterministic arithmetic only.
- All constants in one config file, comments preserved.
- Extend existing repo files; never rename or rebuild them.
- If something in this brief conflicts with the existing codebase, stop and report rather than resolving it yourself.
