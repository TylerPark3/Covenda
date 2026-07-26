# Covenda — Proof Connector Framework

**Status:** framework + two connectors shipped; everything else is a documented registry stub.
Patch to the Compatibility Engine spec. Same global guardrails (classic `app.js`; idempotent
migrations + `notify pgrst`; RLS unchanged; evidence-cited claims only; per-pair scores, no
leaderboards; decision-support; audit logging; `npm run check` green).

## The principle (encoded)

Every industry's proof mechanism reduces to two forgery defenses that generalize:

- **OAuth proves OWNERSHIP** — you can screenshot someone else's portfolio; you can't OAuth into
  their account.
- **Platform timestamps prove HISTORY** — months of accumulated activity can't be fabricated in
  an afternoon.

Build these **once** as a framework (Plaid-style): a new industry is a connector **CONFIG**
(OAuth provider + extraction job + schema mapper), not a new product. The framework is the moat;
outcomes data is the fuel.

## What ships (scope discipline)

Framework + **exactly two** connectors (GitHub upgraded, finance stack) + the two human rails
that already exist (walkthrough interviews + structured referrals). Every other connector is a
registry stub, not built.

| Piece | File | Status |
|---|---|---|
| Connector registry | `api/connectors.js` | live |
| Shared timestamp-forensics | `api/forensics.js` | live |
| `evidence_meta` on `skill_claim` + `connector_accounts` | migration `20260726370000_proof_connectors.sql` | live |
| Connector A — GitHub OAuth (ownership) | `api/connect-github.js`, `analyzeGithub` in `api/portal.js` | live |
| Connector B — .xlsx model rubric | `api/xlsx-parse.js`, `api/analyze-model.js` | live |
| Connector B — pitch defense | reuses `api/hardening.js` dual-rater rubric | live |
| Connector B — Alpaca track record | `api/finance.js` (`computeTrackRecordFeatures`) | **gated** |
| Honest-limits directory | `api/proof-methods.js` | live |

## Framework core

- **Registry** (`CONNECTORS`): `{connector_id, industry, oauth_provider, scopes (read-only,
  minimal), extraction_job, schema_mapper, status}`. `status ∈ {live, planned, human_rail, stub}`.
- **`evidence_meta`** on every emitted `skill_claim`: `{source_connector, ownership_verified,
  history_span_days, cadence_features, backfill_flags}`.
- **Shared forensics** generalizes the GitHub burst detector: history span, accumulation cadence,
  single-dump/backfill detection. **Anomalies route to human review and are never auto-credited.**
- **Within the artifact tier**, ownership-verified + longitudinal evidence weighs more than a
  pasted one-shot (`metaWeight`). The meta moves **weight**, not the tier — tiers `[claimed,
  artifact, referral, trial]` are unchanged.
- **Consent + privacy:** OAuth is student-initiated, read-only, and revocable (`connector_accounts.
  revoked_at`). We store derived features + evidence pointers, **never raw dumps**, and never a
  third-party access token in our DB (the GitHub token is used transiently to read the login,
  then discarded).

## Connector A — GitHub, upgraded to ownership-verified

- The paste-a-repo flow still works; its claims are marked `ownership_verified: false`.
- GitHub OAuth (`read:user`, `public_repo` — read-only): the student connects their **own**
  account. When the connected login matches a repo's owner, that repo's claims become
  `ownership_verified: true` with full commit-timeline forensics.
- The UI shows the difference honestly — **linked repo** vs **verified account** — the anti-slop
  answer made visible.

## Connector B — the finance stack (flagship)

1. **Alpaca paper-trading (GATED).** `computeTrackRecordFeatures` reads an order audit trail into
   span/cadence/drawdown features and runs the shared forensics — a timestamped record that
   cannot be backfilled. We score the **record** (sustained real activity + risk discipline),
   **not trading returns** (rewarding P&L would reward gambling). **BLOCKER:** verify Alpaca's API
   terms permit this read + credentialing use before enabling; ships as `status: planned`.
2. **`.xlsx` model rubric.** `api/xlsx-parse.js` reads the OOXML zip via the central directory and
   inflates parts with Node's built-in `zlib` — **no new npm dependency** — then scores FORMULA
   integrity + DCF structure. It parses **formulas, not values**: a hardcoded model of pasted
   numbers scores low and is flagged by construction.
3. **Pitch defense.** Reuses the existing dual-rater anchored-rubric + walkthrough-interview
   machinery (`api/hardening.js`) with the finance rubric — no new mechanism.

## Honest-limits routing (a feature, not a gap)

`api/proof-methods.js` publishes where API proof can and **cannot** reach:

- **Sales** → `human_rail: instrumented_trial`. Simulations are entry-ticket only; real proof is
  the instrumented trial (outreach through Covenda-provisioned tooling → platform-verified reply
  rates). Documented config, built later.
- **Biotech / lab** → `human_rail: pi_referral`. Bench skills are physically unverifiable
  remotely; the PI structured-referral rail is the **primary** mechanism by design.

Never fake verification where it can't exist — route to the human rail and label it.

## Deferred (registry stubs only — schema room, zero feature code)

Figma (version-history forensics), Sandbox Suite (instrumented $50 marketing / SQL challenges),
Challenge Library (doubles as labeled training data), ATS/Greenhouse (Covenda as a work-trial
stage — verify partner terms before Phase 3), Verified Record Embed API (outbound mirror /
disintermediation defense — after density).

## Operator setup (secrets are operator-provisioned; Claude never handles them)

Set in Vercel to enable the GitHub OAuth path:

- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` — a GitHub OAuth app whose callback is
  `https://covenda.app/api/connect-github?action=callback`.
- `CONNECTOR_STATE_SECRET` — any long random string (signs the CSRF state). Falls back to the
  Supabase service key if unset.
- `APP_BASE_URL` (optional) — overrides the inferred origin for redirects.

## Acceptance

- Registry + shared forensics exist; both connectors emit `skill_claim` rows with `evidence_meta`;
  anomalies route to human review. ✓
- GitHub: OAuth path yields `ownership_verified` claims; paste path still works, honestly
  labelled. ✓
- Finance: Alpaca track-record features (gated) + `.xlsx` rubric parse + pitch-defense rubric land
  as tiered, evidence-pointed claims. ✓
- Honest-limits routing visible for sales/biotech; deferred connectors exist only as stubs. ✓
- No raw third-party dumps stored; OAuth read-only + revocable; `npm run check` green. ✓
