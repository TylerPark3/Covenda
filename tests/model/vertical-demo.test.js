import test from 'node:test';
import assert from 'node:assert/strict';
import { BATCH_CATALOG, VERTICALS_BASE, VERTICAL_DEMOS, demoForVertical, verticalStrength } from '../../api/batches.js';

// Demos are per VERTICAL — vetting is a property of the industry, so every specialisation
// inside it walks the same rails.
test('every vertical has its own demo — none falls back to a generic tour', () => {
  for (const slug of Object.keys(VERTICALS_BASE)) {
    assert.ok(VERTICAL_DEMOS[slug], `${slug} has no demo`);
    const demo = demoForVertical(slug);
    assert.equal(demo.beats.length, 6, `${slug} must walk the same six beats`);
    assert.ok(demo.company.length > 8, `${slug} must name a concrete company type`);
    assert.ok(demo.need.length > 20, `${slug} must state a real problem`);
  }
});

test('demos are labelled illustrative, never a case study', () => {
  for (const slug of Object.keys(VERTICALS_BASE)) {
    assert.equal(demoForVertical(slug).illustrative, true);
  }
});

// The honesty rule has to survive into the demo: a batch with no API forensic must not have
// its walkthrough imply one.
test('expert-vetted verticals describe that rail in their evidence beat', () => {
  for (const [slug, base] of Object.entries(VERTICALS_BASE)) {
    if ((base.vetting.connectors || []).length) continue;
    const demo = demoForVertical(slug);
    const text = demo.beats.map(b => b.detail + ' ' + b.title).join(' ').toLowerCase();
    assert.match(text, /expert-vetted|human rail|no api|cannot be verified remotely|supervisor|referral|walkthrough|defence/,
      `${slug} is expert-vetted but its demo never says so`);
  }
});

test('an unknown vertical returns null rather than a fabricated demo', () => {
  assert.equal(demoForVertical('crypto-moonshots'), null);
  assert.equal(demoForVertical(''), null);
});

test('demo names match the vertical they belong to', () => {
  for (const [slug, base] of Object.entries(VERTICALS_BASE)) {
    assert.equal(demoForVertical(slug).name, base.vertical);
  }
});

// The wedge is derived from the connector registry, not asserted in a comment — so if a
// connector ships or is pulled, the lead vertical moves with it.
test('the lead vertical is derived, and today it is software', async () => {
  const { leadVertical, verticalStrength, VERTICALS_BASE: BASE } = await import('../../api/batches.js');
  const lead = leadVertical();
  assert.equal(lead.slug, 'software-ai');
  assert.equal(lead.strength.ownershipVerified, true);
  assert.equal(lead.strength.historyForensic, true);
  // It must genuinely out-rank the others rather than being hardcoded first.
  const finance = verticalStrength(BASE['accounting-finance']);
  assert.equal(finance.ownershipVerified, false, 'finance ownership is gated (Alpaca terms), so it cannot lead');
});

test('expert-vetted verticals are identified as such, not quietly ranked', async () => {
  const { verticalStrength, VERTICALS_BASE: BASE } = await import('../../api/batches.js');
  assert.equal(verticalStrength(BASE['healthcare-operations']).humanRailOnly, true);
  assert.equal(verticalStrength(BASE['professional-services']).humanRailOnly, true);
  assert.equal(verticalStrength(BASE['software-ai']).humanRailOnly, false);
});
