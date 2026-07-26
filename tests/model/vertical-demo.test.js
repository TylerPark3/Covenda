import test from 'node:test';
import assert from 'node:assert/strict';
import { BATCH_CATALOG, VERTICAL_DEMOS, demoForVertical, batchBySlug } from '../../api/batches.js';

test('every batch has its own demo — no vertical falls back to a generic tour', () => {
  for (const batch of BATCH_CATALOG) {
    assert.ok(VERTICAL_DEMOS[batch.slug], `${batch.slug} has no demo`);
    const demo = demoForVertical(batch.slug);
    assert.equal(demo.beats.length, 6, `${batch.slug} must walk the same six beats`);
    assert.ok(demo.company.length > 8, `${batch.slug} must name a concrete company type`);
    assert.ok(demo.need.length > 20, `${batch.slug} must state a real problem`);
  }
});

test('demos are labelled illustrative, never a case study', () => {
  for (const batch of BATCH_CATALOG) {
    const demo = demoForVertical(batch.slug);
    assert.equal(demo.illustrative, true);
  }
});

// The honesty rule has to survive into the demo: a batch with no API forensic must not have
// its walkthrough imply one.
test('human-rail batches describe a human rail in their evidence beat', () => {
  for (const batch of BATCH_CATALOG) {
    if ((batch.vetting.connectors || []).length) continue;
    const demo = demoForVertical(batch.slug);
    const text = demo.beats.map(b => b.detail + ' ' + b.title).join(' ').toLowerCase();
    assert.match(text, /human rail|no api|cannot be verified remotely|supervisor|referral|walkthrough|defence/,
      `${batch.slug} is human-rail vetted but its demo never says so`);
  }
});

test('an unknown vertical returns null rather than a fabricated demo', () => {
  assert.equal(demoForVertical('crypto-moonshots'), null);
  assert.equal(demoForVertical(''), null);
});

test('demo names match the batch catalogue', () => {
  for (const batch of BATCH_CATALOG) {
    assert.equal(demoForVertical(batch.slug).name, batchBySlug(batch.slug).name);
  }
});

// The wedge is derived from the connector registry, not asserted in a comment — so if a
// connector ships or is pulled, the lead vertical moves with it.
test('the lead vertical is derived, and today it is software', async () => {
  const { leadVertical, verticalStrength, batchBySlug } = await import('../../api/batches.js');
  const lead = leadVertical();
  assert.equal(lead.slug, 'software-ai');
  assert.equal(lead.strength.ownershipVerified, true);
  assert.equal(lead.strength.historyForensic, true);
  // It must genuinely out-rank the others rather than being hardcoded first.
  const finance = verticalStrength(batchBySlug('accounting-finance'));
  assert.equal(finance.ownershipVerified, false, 'finance ownership is gated (Alpaca terms), so it cannot lead');
});

test('human-rail batches are identified as such, not quietly ranked', async () => {
  const { verticalStrength, batchBySlug } = await import('../../api/batches.js');
  assert.equal(verticalStrength(batchBySlug('healthcare-operations')).humanRailOnly, true);
  assert.equal(verticalStrength(batchBySlug('professional-services')).humanRailOnly, true);
  assert.equal(verticalStrength(batchBySlug('software-ai')).humanRailOnly, false);
});
