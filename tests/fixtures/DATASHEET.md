# Datasheet — matching golden set & fixtures

## Golden set (tests/model/match.test.js)
- **Provenance:** 6 seed cases hand-authored 2026-07-24 by the founder/Claude pair while
  building match-1.0.0. **Synthetic** — no real people, companies, or records.
- **Purpose:** acceptance metric = engine agreement with the human matcher's choice; every
  case carries the human rationale.
- **Growth policy:** append real operator decisions (from public.matches, with rationales)
  as new cases; target ≥20. Strip PII before committing (ids only, no names/emails).

## Skill taxonomy seed (api/skills-taxonomy.js, TAXONOMY_VERSION seed-1)
- **Provenance:** hand-derived 2026-07-24 by the founder/Claude pair; ~35 canonical skills +
  aliases covering the pilot's verticals, plus an O*NET-Work-Styles -> env_* anchor map
  (the element names follow O*NET's; the mapping is Covenda's). **This is NOT Lightcast or
  O*NET data** and claims no such provenance.
- **Replacement path:** regenerate CANONICAL from derived Lightcast Open Skills / O*NET
  fixtures when ingested; bump TAXONOMY_VERSION; call sites unchanged. Normalization never
  drops a skill — unmatched strings pass through.

## Pending Phase-1 grounding fixtures (not yet built)
O*NET Work Styles / Skills / DWA (public domain, US DOL) and Lightcast Open Skills — commit
only DERIVED fixtures with source/URL/license/retrieval-date/transform recorded here. No raw
third-party dumps; no protected attributes enter any feature.
