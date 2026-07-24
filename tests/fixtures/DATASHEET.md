# Datasheet — matching golden set & fixtures

## Golden set (tests/model/match.test.js)
- **Provenance:** 6 seed cases hand-authored 2026-07-24 by the founder/Claude pair while
  building match-1.0.0. **Synthetic** — no real people, companies, or records.
- **Purpose:** acceptance metric = engine agreement with the human matcher's choice; every
  case carries the human rationale.
- **Growth policy:** append real operator decisions (from public.matches, with rationales)
  as new cases; target ≥20. Strip PII before committing (ids only, no names/emails).

## Pending Phase-1 grounding fixtures (not yet built)
O*NET Work Styles / Skills / DWA (public domain, US DOL) and Lightcast Open Skills — commit
only DERIVED fixtures with source/URL/license/retrieval-date/transform recorded here. No raw
third-party dumps; no protected attributes enter any feature.
