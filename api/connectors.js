// Proof Connector Framework — the registry + evidence-meta core (Plaid-style).
//
// The moat is the FRAMEWORK, not any one connector. Every industry's proof mechanism reduces
// to the same two forgery defenses:
//   • OAuth proves OWNERSHIP  — you can screenshot someone else's portfolio; you can't OAuth
//     into their account.
//   • Timestamps prove HISTORY — months of accumulated activity can't be faked in an afternoon
//     (the shared api/forensics.js service).
// A new industry is therefore a CONFIG, not a new product: {oauth_provider + extraction_job +
// schema_mapper}. Every connector emits Stage-0 `skill_claim` rows, plus an `evidence_meta`
// jsonb that carries the ownership + forensics signal.
//
// SCOPE DISCIPLINE (hard rule): the pilot ships the framework + EXACTLY TWO connectors —
// GitHub (upgraded to ownership-verified) and the finance stack — plus the two human rails
// (walkthrough interviews + structured referrals). Every other connector is a documented
// registry stub, NOT built. The framework is the moat; outcomes data is the fuel — don't build
// eight connectors before twenty projects have run.

import { analyzeTimeline, FORENSICS_VERSION } from './forensics.js';

export const CONNECTOR_REGISTRY_VERSION = 'registry-1.0.0';
export { FORENSICS_VERSION };

// status:
//   'live'       — built and enabled in the pilot
//   'planned'    — code path exists but gated (e.g. pending third-party terms / secrets)
//   'human_rail' — proof CANNOT be API-verified here; a human mechanism IS the proof, by design
//   'stub'       — registry room only; ZERO feature code (schema/naming reserved for later)
//
// ownership: 'oauth' (provably-owned account) | 'artifact' (uploaded file) | 'interview' | null
// history:   the timestamp source the forensics service reads, or 'none'
export const CONNECTORS = {
  // ---- Connector A: GitHub, upgraded to ownership-verified ------------------------------
  github: {
    connector_id: 'github', industry: 'software',
    oauth_provider: 'github', scopes: ['read:user', 'public_repo'], // READ-ONLY, minimal
    extraction_job: 'github-analyze', schema_mapper: 'github-skills',
    ownership: 'oauth', history: 'commit_timeline', status: 'live',
    label: 'GitHub', note: 'Paste-a-repo still works (ownership_verified:false); OAuth over your own account yields ownership_verified:true + full commit-timeline forensics.',
    example: { company: 'A seed-stage AI startup hiring a backend student', sees: 'the student\u2019s own GitHub account connected via OAuth, eight months of commit history on a real project, and the specific files behind each language claim \u2014 not a r\u00e9sum\u00e9 line reading \u201cproficient in Python\u201d.' },
  },

  // ---- Connector B: the finance stack (flagship) — three instruments, one connector -----
  alpaca_track_record: {
    connector_id: 'alpaca_track_record', industry: 'finance',
    oauth_provider: 'alpaca', scopes: ['account:read', 'trading:read'], // READ-ONLY audit trail
    extraction_job: 'alpaca-orders', schema_mapper: 'finance-track-record',
    ownership: 'oauth', history: 'order_audit_trail', status: 'planned',
    label: 'Alpaca paper-trading', note: 'Read the complete order audit trail (entries/exits/timestamps/drawdown) → a timestamped track record that cannot be backfilled.',
    example: { company: 'A prop desk or fintech evaluating a markets student', sees: 'a six-month timestamped order trail \u2014 entries, exits, drawdowns \u2014 scored on risk discipline and sustained activity, never on P&L, because rewarding returns rewards gambling.' },
    terms_note: 'BLOCKER: verify Alpaca API terms permit this read + credentialing use before enabling. Ships as status:planned until confirmed.',
  },
  xlsx_model: {
    connector_id: 'xlsx_model', industry: 'finance',
    oauth_provider: null, scopes: [],
    extraction_job: 'xlsx-formula-parse', schema_mapper: 'dcf-rubric',
    ownership: 'artifact', history: 'none', status: 'live',
    label: 'Financial model (.xlsx)', note: 'Programmatic formula-integrity + structure scored against a DCF rubric — parse formulas, not just values.',
    example: { company: 'A search fund screening an analyst', sees: 'the student\u2019s DCF parsed formula-by-formula: live formulas versus pasted values, structure against a published rubric. A workbook of hardcoded numbers scores low by construction.' },
    dep_note: 'Uses a minimal server-only .xlsx formula parser (api/xlsx-parse.js) — no new npm dependency; unzips the OOXML package with Node zlib.',
  },
  pitch_defense: {
    connector_id: 'pitch_defense', industry: 'finance',
    oauth_provider: null, scopes: [],
    extraction_job: 'rubric-interview', schema_mapper: 'finance-rubric',
    ownership: 'interview', history: 'none', status: 'live',
    label: 'Pitch defense', note: 'Reuses the existing dual-rater anchored-rubric + walkthrough-interview machinery (api/hardening.js) with a finance rubric — no new mechanism.',
    example: { company: 'A boutique advisory hiring a summer analyst', sees: 'the student defending that model live against anchored rubric questions, scored independently by two raters who then adjudicate.' },
  },

  // ---- Honest-limits routing: proof can't be API-verified → the human rail IS the proof --
  sales: {
    connector_id: 'sales', industry: 'sales',
    oauth_provider: null, extraction_job: null, schema_mapper: null,
    ownership: null, history: 'none', status: 'human_rail', rail: 'instrumented_trial',
    label: 'Sales', note: 'Simulations are entry-ticket only. Real proof = the instrumented trial: outreach through Covenda-provisioned tooling → platform-verified reply rates. Documented config, built later.',
    example: { company: 'A B2B SaaS startup hiring an SDR', sees: 'a bounded outreach trial run through Covenda-provisioned tooling, so reply rates are platform-measured \u2014 and a scored debrief on what they changed between attempts, which is the part that predicts the next hire.' },
  },
  biotech_lab: {
    connector_id: 'biotech_lab', industry: 'biotech',
    oauth_provider: null, extraction_job: null, schema_mapper: null,
    ownership: null, history: 'none', status: 'human_rail', rail: 'pi_referral',
    label: 'Biotech / lab', note: 'Bench skills are physically unverifiable remotely. The PI structured-referral rail is the PRIMARY mechanism by design — never fake verification where it cannot exist.',
    example: { company: 'A biotech lab taking on a research assistant', sees: 'narrow, cross-checked answers from the PI who supervised the bench work, under their own name \u2014 the strongest signal available for work whose quality lives in judgement rather than in a log.' },
  },

  // ---- Deferred: registry room only, ZERO feature code ----------------------------------
  figma: {
    connector_id: 'figma', industry: 'design', oauth_provider: 'figma', status: 'stub',
    label: 'Figma', note: 'Version-history forensics: weeks of iteration vs a one-session import — the "polish without process" answer for design.',
  },
  sandbox_suite: {
    connector_id: 'sandbox_suite', industry: 'cross', oauth_provider: null, status: 'stub',
    label: 'Sandbox Suite', note: 'Instrumented environments ($50-budget marketing challenge, SQL sandbox) — generalizes the Alpaca idea to verticals without a natural audit trail.',
  },
  challenge_library: {
    connector_id: 'challenge_library', industry: 'cross', oauth_provider: null, status: 'stub',
    label: 'Challenge Library', note: 'Standardized challenges; doubles as labeled training data for the scorer.',
  },
  ats_greenhouse: {
    connector_id: 'ats_greenhouse', industry: 'cross', oauth_provider: 'greenhouse', status: 'stub',
    label: 'ATS (Greenhouse)', note: 'Covenda as a "work-trial stage" inside existing pipelines. Verify partner terms before Phase 3.',
  },
  verified_record_embed: {
    connector_id: 'verified_record_embed', industry: 'cross', oauth_provider: null, status: 'stub',
    label: 'Verified Record Embed API', note: 'Outbound mirror; disintermediation defense. A portable standard — worth building only after record density.',
  },
};

export function listConnectors(filter = {}) {
  let rows = Object.values(CONNECTORS);
  if (filter.status) rows = rows.filter(c => c.status === filter.status);
  if (filter.industry) rows = rows.filter(c => c.industry === filter.industry);
  return rows;
}

export function getConnector(id) {
  return CONNECTORS[id] || null;
}

// Which connectors are actually usable right now (built + enabled).
export function liveConnectors() {
  return listConnectors({ status: 'live' });
}

// Public-safe view for the site (no scopes/terms internals leaked): what proof each vertical
// accepts, and — crucially — where API proof CANNOT reach, stated honestly.
export function connectorDirectory() {
  return Object.values(CONNECTORS).map(c => ({
    connector_id: c.connector_id,
    industry: c.industry,
    label: c.label || c.connector_id,
    status: c.status,
    ownership: c.ownership || null,
    verifiable: c.status === 'live' || c.status === 'planned',
    example: c.example || null,
    rail: c.rail || null,
    note: c.note || '',
  }));
}

// ---- evidence_meta: the per-claim ownership + forensics signal ----------------------------

// Build the evidence_meta jsonb a connector attaches to each skill_claim row. Within a tier,
// this meta MOVES WEIGHT (ownership-verified + longitudinal > pasted one-shot) but never moves
// the tier itself — tiers [claimed, artifact, referral, trial] are unchanged.
export function buildEvidenceMeta({ connectorId, ownershipVerified = false, forensics = null } = {}) {
  return {
    source_connector: connectorId || null,
    ownership_verified: ownershipVerified === true,
    history_span_days: forensics ? forensics.history_span_days : 0,
    cadence_features: forensics ? forensics.cadence_features : null,
    backfill_flags: forensics ? (forensics.backfill_flags || []) : [],
  };
}

// Convenience: run the shared forensics over a timeline and fold it straight into evidence_meta.
export function evidenceMetaFromTimeline({ connectorId, ownershipVerified, timestamps, now }) {
  const forensics = analyzeTimeline(timestamps, now ? { now } : {});
  return { meta: buildEvidenceMeta({ connectorId, ownershipVerified, forensics }), forensics };
}

// Weight multiplier applied WITHIN the artifact tier. Ownership-verified + a sustained,
// unflagged history earns up to +ARTIFACT_META_BOOST; a pasted one-shot artifact stays at the
// base 1.0; a flagged (backfilled/dumped) timeline gets NO boost — anomalies route to human
// review and are never rewarded. This deliberately stays a fraction of a tier step, so it can
// never promote weak evidence past genuinely harder-to-fake tiers.
export const ARTIFACT_META_BOOST = 0.3;
export function metaWeight(evidenceMeta) {
  if (!evidenceMeta) return 1;
  if ((evidenceMeta.backfill_flags || []).length) return 1; // anomaly → no boost
  let signal = 0;
  if (evidenceMeta.ownership_verified) signal += 0.5;
  if (evidenceMeta.cadence_features && evidenceMeta.cadence_features.sustained) signal += 0.5;
  return 1 + ARTIFACT_META_BOOST * Math.min(1, signal);
}
