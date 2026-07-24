import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeTimeline } from '../../api/forensics.js';
import {
  CONNECTORS, listConnectors, getConnector, liveConnectors, connectorDirectory,
  buildEvidenceMeta, evidenceMetaFromTimeline, metaWeight,
} from '../../api/connectors.js';

const DAY = 86_400_000;
// Build `count` timestamps spread evenly across `spanDays`, ending `now`.
function spread(count, spanDays, now = Date.UTC(2026, 5, 1)) {
  if (count <= 1) return [now];
  const step = (spanDays * DAY) / (count - 1);
  return Array.from({ length: count }, (_, i) => now - (count - 1 - i) * step);
}

// ---- Shared timestamp forensics -----------------------------------------------------------

test('forensics: a real months-long history reads as sustained, not anomalous', () => {
  const r = analyzeTimeline(spread(30, 120), { now: Date.UTC(2026, 5, 1) });
  assert.equal(r.anomaly, false);
  assert.equal(r.needsReview, false);
  assert.ok(r.history_span_days >= 100);
  assert.equal(r.cadence_features.sustained, true);
});

test('forensics: a single-session dump is flagged and routed to human review', () => {
  const now = Date.UTC(2026, 5, 1);
  const sameDay = Array.from({ length: 12 }, (_, i) => now - i * 60_000); // 12 events in 12 minutes
  const r = analyzeTimeline(sameDay, { now });
  assert.equal(r.anomaly, true);
  assert.equal(r.needsReview, true);
  assert.ok(r.backfill_flags.includes('single_session'));
  assert.equal(r.cadence_features.sustained, false);
});

test('forensics: a compressed backfill (much activity, no time) is flagged', () => {
  const now = Date.UTC(2026, 5, 1);
  const r = analyzeTimeline(spread(10, 2, now), { now }); // 10 events across 2 days
  assert.equal(r.anomaly, true);
  assert.ok(r.backfill_flags.includes('compressed_history'));
});

test('forensics: an empty timeline is a no_history anomaly, never silently credited', () => {
  const r = analyzeTimeline([]);
  assert.equal(r.events, 0);
  assert.equal(r.needsReview, true);
  assert.deepEqual(r.backfill_flags, ['no_history']);
});

// ---- Connector registry -------------------------------------------------------------------

test('registry: ships the framework + EXACTLY two live connectors + the two human rails', () => {
  const live = liveConnectors().map(c => c.connector_id).sort();
  // GitHub + the finance stack (xlsx + pitch-defense live now; Alpaca gated as planned).
  assert.deepEqual(live, ['github', 'pitch_defense', 'xlsx_model']);
  assert.equal(getConnector('alpaca_track_record').status, 'planned'); // gated on terms
  const rails = listConnectors({ status: 'human_rail' }).map(c => c.connector_id).sort();
  assert.deepEqual(rails, ['biotech_lab', 'sales']);
});

test('registry: deferred connectors exist ONLY as stubs with zero build fields', () => {
  for (const id of ['figma', 'sandbox_suite', 'challenge_library', 'ats_greenhouse', 'verified_record_embed']) {
    assert.equal(getConnector(id).status, 'stub');
    assert.equal(getConnector(id).extraction_job, undefined); // no job = not built
  }
});

test('registry: OAuth connectors declare read-only, minimal scopes', () => {
  assert.deepEqual(CONNECTORS.github.scopes, ['read:user', 'public_repo']);
  assert.ok(!CONNECTORS.github.scopes.some(s => /write|admin|delete/.test(s)));
  assert.ok(CONNECTORS.alpaca_track_record.scopes.every(s => /:read$/.test(s)));
  assert.ok(CONNECTORS.alpaca_track_record.terms_note.includes('verify Alpaca'));
});

test('directory: honest-limits verticals are marked non-verifiable and routed to a rail', () => {
  const dir = connectorDirectory();
  const sales = dir.find(c => c.connector_id === 'sales');
  assert.equal(sales.verifiable, false);
  assert.equal(sales.rail, 'instrumented_trial');
  const bio = dir.find(c => c.connector_id === 'biotech_lab');
  assert.equal(bio.verifiable, false);
  assert.equal(bio.rail, 'pi_referral');
  // No scopes or terms internals leak into the public directory.
  assert.ok(dir.every(c => !('scopes' in c) && !('terms_note' in c)));
});

// ---- evidence_meta weighting --------------------------------------------------------------

test('evidence_meta: ownership-verified + longitudinal weighs MORE than a pasted one-shot', () => {
  const owned = evidenceMetaFromTimeline({ connectorId: 'github', ownershipVerified: true, timestamps: spread(30, 120), now: Date.UTC(2026, 5, 1) });
  const pasted = buildEvidenceMeta({ connectorId: 'github', ownershipVerified: false, forensics: null });
  assert.ok(metaWeight(owned.meta) > metaWeight(pasted), 'ownership+history should outweigh a paste');
  assert.equal(owned.meta.ownership_verified, true);
  assert.equal(pasted.ownership_verified, false);
});

test('evidence_meta: a flagged (backfilled) timeline earns NO weight boost', () => {
  const dumped = evidenceMetaFromTimeline({ connectorId: 'github', ownershipVerified: true, timestamps: Array.from({ length: 12 }, (_, i) => Date.UTC(2026, 5, 1) - i * 60_000), now: Date.UTC(2026, 5, 1) });
  assert.ok(dumped.meta.backfill_flags.length > 0);
  assert.equal(metaWeight(dumped.meta), 1); // anomaly is never rewarded, even if "owned"
});

test('proof-connectors migration adds evidence_meta + a revocable connector_accounts table', async () => {
  const fs = await import('node:fs');
  const sql = fs.readFileSync('supabase/migrations/20260726370000_proof_connectors.sql', 'utf8');
  assert.match(sql, /add column if not exists evidence_meta jsonb/);
  assert.match(sql, /create table if not exists public\.connector_accounts/);
  assert.match(sql, /revoked_at timestamptz/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /notify pgrst/);
});
