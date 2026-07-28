# Covenda Compatibility Engine — Implementation Brief

You are implementing the compatibility scoring system for Covenda, a two-sided platform where students complete short, paid work trials for companies and accepted work becomes a verified, portable work record.

## Read these first, in this order

1. `SPEC.md` — the product contract. Target variable, allowed/banned inputs, output format. Do not violate it.
2. `RUBRIC_CONSTANTS.md` — the exact scoring constants, already calibrated against 216 labeled examples. Port these verbatim; do not invent your own weights.
3. `IMPLEMENTATION.md` — what to build, file by file.
4. `calibration_dataset.csv` — 216 labeled student × project pairings used to validate the implementation.
5. `anchor_disagreements.csv` — 10 known open cases. Context only; do not code around them.

## Before writing any code

Read the existing repo first. These files already exist and must be EXTENDED, not rebuilt or renamed:
- `docs/COMPATIBILITY_ENGINE_MASTER.md`
- `api/batches.js` — admission engine, REQ descriptors, VETTING_RAILS
- `api/connectors.js` and `docs/PROOF_CONNECTORS.md` — verification capabilities
- `api/hardening.js` — dual-rater rubrics, ownership defense
- `docs/MODEL_CARD.md`

If any of the above conflicts with these documents, stop and report the conflict rather than resolving it yourself.

## Critical framing — do not misunderstand this

**Nothing here is a trained machine learning model, and you must not build one.** The scoring engine is deterministic arithmetic over hand-calibrated constants. A trained model comes later, once ~150-300 real trial outcomes exist. The most valuable part of this build is not the scorer — it is the event logging that turns every completed trial into a labeled training example. If you have to choose where to be careful, be careful there.

Do not add ML libraries, do not train anything, do not import scikit-learn or tensorflow equivalents.

## Definition of done

- `api/compatibility.js` scores a student × project pairing and returns tier + reasons + uncertainty
- Event logging captures the full feature vector at scoring time, paired with eventual outcome
- Employer close-out is gated on the one-tap rating question
- Synthetic data endpoints exist and are isolated from real data
- The validation script reproduces the labels in `calibration_dataset.csv` at >= 80% agreement
- All four required tests pass (see IMPLEMENTATION.md)
