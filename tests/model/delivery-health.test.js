import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deliveryConfig, recordDelivery } from '../../api/notify.js';

// The failure this exists for is silence: with no key, every send returns not-configured and
// the product behaves normally. The first anyone learns is a company saying they never heard.
test('a missing key is reported as a consequence, not a config note', () => {
  const h = deliveryConfig({});
  assert.equal(h.configured, false);
  assert.deepEqual(h.missing, ['RESEND_API_KEY', 'COVENDA_NOTIFICATION_FROM']);
  assert.match(h.consequence, /never told/, '"not configured" reads as minor; this is not minor');
});

test('a fully configured deployment reports clean', () => {
  const h = deliveryConfig({ RESEND_API_KEY: 'x', COVENDA_NOTIFICATION_FROM: 'a@b.c' });
  assert.equal(h.configured, true);
  assert.equal(h.consequence, null);
  assert.deepEqual(h.missing, []);
});

test('a partial configuration is still broken', () => {
  const h = deliveryConfig({ RESEND_API_KEY: 'x' });
  assert.equal(h.configured, false);
  assert.deepEqual(h.missing, ['COVENDA_NOTIFICATION_FROM']);
});

test('a successful send is not logged as a failure', async () => {
  const rows = [];
  const db = { from: () => ({ insert: async r => { rows.push(r); return { error: null }; } }) };
  await recordDelivery(db, { event: 'submitted', result: { sent: true } });
  assert.equal(rows.length, 0);
});

// Someone choosing not to receive email is not a delivery problem.
test('an opt-out is never counted as a failure', async () => {
  const rows = [];
  const db = { from: () => ({ insert: async r => { rows.push(r); return { error: null }; } }) };
  await recordDelivery(db, { event: 'submitted', result: { sent: false, reason: 'opted-out' } });
  assert.equal(rows.length, 0);
});

test('a real failure is recorded with its reason and no message body', async () => {
  const rows = [];
  const db = { from: () => ({ insert: async r => { rows.push(r); return { error: null }; } }) };
  await recordDelivery(db, { event: 'submitted', result: { sent: false, reason: 'not-configured' }, toUserId: 'u1' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].detail.reason, 'not-configured');
  assert.equal(rows[0].kind, 'degraded');
  assert.ok(!JSON.stringify(rows[0]).includes('@'), 'no recipient address is stored');
});

test('recording a failure never throws into the caller', async () => {
  const db = { from: () => ({ insert: async () => { throw new Error('table gone'); } }) };
  const r = await recordDelivery(db, { event: 'x', result: { sent: false, reason: 'boom' } });
  assert.equal(r.logged, false, 'a broken log must not break a send path');
});

test('every notification in the portal records its outcome', () => {
  const portal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const sends = (portal.match(/await notifyMember\(/g) || []).length;
  const records = (portal.match(/await recordDelivery\(/g) || []).length;
  assert.equal(records, sends, `${sends} sends but ${records} recorded`);
});

test('the admin panel separates configured from actually working', () => {
  const admin = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
  assert.match(admin, /failuresLast7Days/);
  // Configured with a bouncing from-address is configured and still delivering nothing.
  assert.match(admin, /healthy: config\.configured && failures\.length === 0/);
});
