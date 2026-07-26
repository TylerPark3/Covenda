import { analyzeTimeline } from './forensics.js';
import { buildEvidenceMeta } from './connectors.js';

// Proof Connector Framework — Connector B (finance stack) logic.
//
// Three instruments, one connector:
//   1) Alpaca paper-trading track record  — GATED on terms (computeTrackRecordFeatures is pure
//      and ready; no live OAuth handler ships until Alpaca's API terms are verified).
//   2) .xlsx model rubric parse           — api/xlsx-parse.js (live).
//   3) Pitch defense rubric               — reuses api/hardening.js dual-rater machinery + the
//      'Financial modeling' anchors (no new mechanism).
//
// Guardrail: we score the timestamped RECORD (span, cadence, risk discipline) — the thing that
// cannot be backfilled — NOT trading returns. Rewarding raw P&L would reward gambling; the
// forgery defense is the history, not the profit.

export const FINANCE_CONNECTOR_VERSION = 'finance-1.0.0';

// Alpaca order audit trail → track-record features. orders: [{ filled_at, side, symbol,
// filled_avg_price, qty, ... }]. Pure; the OAuth read that produces `orders` is gated on terms.
export function computeTrackRecordFeatures(orders, { now = Date.now() } = {}) {
  const filled = (orders || []).filter(o => o && o.filled_at);
  const timestamps = filled.map(o => o.filled_at);
  const forensics = analyzeTimeline(timestamps, { now });
  // A crude realized-equity path to read max drawdown as a RISK-DISCIPLINE signal (not returns).
  let equity = 0, peak = 0, maxDrawdown = 0;
  const sorted = [...filled].sort((a, b) => new Date(a.filled_at) - new Date(b.filled_at));
  for (const o of sorted) {
    const price = Number(o.filled_avg_price) || 0;
    const qty = Number(o.qty) || 0;
    const dir = String(o.side).toLowerCase() === 'sell' ? 1 : -1; // sells realize, buys deploy
    equity += dir * price * qty;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
  }
  return {
    trades: filled.length,
    span_days: forensics.history_span_days,
    cadence: forensics.cadence_features,
    max_drawdown_pct: Math.round(maxDrawdown * 1000) / 10,
    forensics,
  };
}

// Build the finance skill_claim rows a completed instrument emits. Track-record and model both
// live at the ARTIFACT tier; the evidence_meta carries ownership + forensics (see connectors.js
// — ownership-verified + sustained weighs more within the tier). A forensics anomaly is routed
// to human review by the caller and never auto-credited.
export function trackRecordClaim({ studentUserId, features, evidencePointer }) {
  return {
    student_user_id: studentUserId,
    skill: 'Trading track record',
    skill_canonical: 'Financial modeling',
    level: `${features.trades} trades over ${features.span_days} days (max drawdown ${features.max_drawdown_pct}%)`,
    verification_tier: 'artifact',
    evidence_pointer: evidencePointer || 'alpaca://track-record',
    evidence_meta: buildEvidenceMeta({ connectorId: 'alpaca_track_record', ownershipVerified: true, forensics: features.forensics }),
  };
}

export function modelClaim({ studentUserId, rubric, evidencePointer }) {
  return {
    student_user_id: studentUserId,
    skill: 'Financial modeling',
    skill_canonical: 'Financial modeling',
    level: `${rubric.score}/10 vs DCF rubric${rubric.flags.length ? ` — ${rubric.flags.length} flag(s)` : ''}`,
    verification_tier: 'artifact',
    evidence_pointer: evidencePointer || 'xlsx://model',
    // An uploaded artifact is not OAuth-owned, but it IS a real programmatic parse (not a paste).
    evidence_meta: buildEvidenceMeta({ connectorId: 'xlsx_model', ownershipVerified: false, forensics: null }),
  };
}
