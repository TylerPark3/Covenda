import assert from 'node:assert/strict';
import test from 'node:test';

import { createCheckoutSession, StripeNotConfiguredError } from '../api/stripe-checkout.js';
import { createVerificationSession } from '../api/stripe-identity.js';
import { isAdult, recordIdentityVerification, recordStripePurchase } from '../api/stripe-webhook.js';

// A minimal fake Stripe client that captures the args createCheckoutSession sends.
function fakeStripe() {
  const calls = [];
  return {
    calls,
    checkout: { sessions: { create: async (args) => { calls.push(args); return { id: 'cs_test_123', url: 'https://checkout.stripe.test/cs_test_123' }; } } },
  };
}

const member = { user: { id: 'user-1' } };

test('checkout charges the bundle price in cents and stamps identity in metadata', async () => {
  const stripe = fakeStripe();
  const result = await createCheckoutSession({ member, credits: 500, origin: 'https://covenda.app', env: { STRIPE_SECRET_KEY: 'sk_test' }, stripe });
  assert.equal(result.url, 'https://checkout.stripe.test/cs_test_123');
  const args = stripe.calls[0];
  // 500 credits -> $475 bundle -> 47500 cents. Never trust the raw credit number for price.
  assert.equal(args.line_items[0].price_data.unit_amount, 47500);
  assert.equal(args.client_reference_id, 'user-1');
  assert.equal(args.metadata.userId, 'user-1');
  assert.equal(args.metadata.credits, '500');
});

test('checkout allows any in-range amount and applies the volume tier', async () => {
  const stripe = fakeStripe();
  // 750 credits: >=500 so 5% off -> $712.50 -> 71250 cents.
  await createCheckoutSession({ member, credits: 750, origin: 'https://covenda.app', env: { STRIPE_SECRET_KEY: 'sk_test' }, stripe });
  assert.equal(stripe.calls[0].line_items[0].price_data.unit_amount, 71250);
  assert.equal(stripe.calls[0].metadata.credits, '750');
});

test('checkout rejects an out-of-range credit amount', async () => {
  await assert.rejects(
    () => createCheckoutSession({ member, credits: 10, origin: 'https://covenda.app', env: { STRIPE_SECRET_KEY: 'sk_test' }, stripe: fakeStripe() }),
    /Choose between 50 and/,
  );
  await assert.rejects(
    () => createCheckoutSession({ member, credits: 250000, origin: 'https://covenda.app', env: { STRIPE_SECRET_KEY: 'sk_test' }, stripe: fakeStripe() }),
    /Choose between 50 and/,
  );
});

test('checkout throws StripeNotConfiguredError when the secret key is absent', async () => {
  await assert.rejects(
    () => createCheckoutSession({ member, credits: 500, origin: 'https://covenda.app', env: {}, stripe: fakeStripe() }),
    (error) => error instanceof StripeNotConfiguredError,
  );
});

// A fake supabase that records inserts and can be told to fail with a unique violation.
function fakeSupabase({ failWith } = {}) {
  const inserts = [];
  return {
    inserts,
    from() { return this; },
    insert(row) { inserts.push(row); return { error: failWith || null }; },
  };
}

test('a paid session grants the bundle credits, re-deriving amount from the table', async () => {
  const supabase = fakeSupabase();
  const session = { id: 'cs_test_abc', metadata: { userId: 'user-9', credits: '1000' } };
  const result = await recordStripePurchase(session, supabase);
  assert.deepEqual(result, { ok: true });
  const row = supabase.inserts[0];
  assert.equal(row.user_id, 'user-9');
  assert.equal(row.entry_type, 'purchase');
  assert.equal(row.credits, 1000);
  assert.equal(row.external_ref, 'cs_test_abc');
  assert.match(row.note, /\$900/); // 1000 credits is the $900 bundle
});

test('a first purchase also grants a one-time welcome promo, keyed per user', async () => {
  const supabase = fakeSupabase();
  await recordStripePurchase({ id: 'cs_test_promo', metadata: { userId: 'user-9', credits: '500' } }, supabase);
  const promo = supabase.inserts.find(r => r.entry_type === 'promo');
  assert.ok(promo, 'expected a promo ledger entry');
  assert.equal(promo.credits, 50);
  assert.equal(promo.external_ref, 'first-purchase-promo:user-9'); // idempotency key = one promo per account
});

test('a duplicate session is treated as success, not an error', async () => {
  const supabase = fakeSupabase({ failWith: { message: 'duplicate key value violates unique constraint' } });
  const result = await recordStripePurchase({ id: 'cs_test_abc', metadata: { userId: 'user-9', credits: '1000' } }, supabase);
  assert.deepEqual(result, { ok: true, duplicate: true });
});

test('an unrecognised amount grants nothing', async () => {
  const supabase = fakeSupabase();
  // Below the minimum → out of range → grant nothing.
  const result = await recordStripePurchase({ id: 'cs_test_bad', metadata: { userId: 'user-9', credits: '10' } }, supabase);
  assert.deepEqual(result, { ok: false, reason: 'unrecognised-session' });
  assert.equal(supabase.inserts.length, 0);
});

// ---- Stripe Identity (driver's-license / ID check) ----

function fakeIdentityStripe() {
  const calls = [];
  return {
    calls,
    identity: { verificationSessions: { create: async (args) => { calls.push(args); return { id: 'vs_test_1', url: 'https://verify.stripe.test/vs_test_1' }; } } },
  };
}

// A profiles fake that records the update payload and which row it targeted.
function fakeProfiles() {
  const updates = [];
  return {
    updates,
    from() { return this; },
    update(row) { this._row = row; return this; },
    eq(col, val) { updates.push({ row: this._row, col, val }); return { error: null }; },
  };
}

const nowYear = new Date().getUTCFullYear();

test('identity verification opens a document check stamped with the member id', async () => {
  const stripe = fakeIdentityStripe();
  const result = await createVerificationSession({ member, origin: 'https://covenda.app', env: { STRIPE_SECRET_KEY: 'sk_test' }, stripe });
  assert.equal(result.url, 'https://verify.stripe.test/vs_test_1');
  const args = stripe.calls[0];
  assert.equal(args.type, 'document');
  assert.equal(args.metadata.userId, 'user-1');
  assert.equal(args.return_url, 'https://covenda.app/portal.html?identity=submitted');
});

test('identity verification throws StripeNotConfiguredError without a secret key', async () => {
  await assert.rejects(
    () => createVerificationSession({ member, origin: 'https://covenda.app', env: {}, stripe: fakeIdentityStripe() }),
    (error) => error instanceof StripeNotConfiguredError,
  );
});

test('isAdult is true for an adult DOB and false for a minor or unknown', () => {
  assert.equal(isAdult({ day: 1, month: 1, year: nowYear - 20 }), true);
  assert.equal(isAdult({ day: 1, month: 1, year: nowYear - 10 }), false);
  assert.equal(isAdult(null), false);
});

test('a verified adult session marks the profile verified and 18+', async () => {
  const supabase = fakeProfiles();
  const session = { id: 'vs_1', metadata: { userId: 'user-5' }, verified_outputs: { dob: { day: 1, month: 1, year: nowYear - 25 } } };
  const result = await recordIdentityVerification(session, supabase);
  assert.deepEqual(result, { ok: true, adult: true });
  const { row, col, val } = supabase.updates[0];
  assert.equal(col, 'user_id');
  assert.equal(val, 'user-5');
  assert.equal(row.identity_verified, true);
  assert.equal(row.identity_18plus, true);
  assert.equal(row.identity_session_id, 'vs_1');
});

test('a verified under-18 session is verified but not payout-eligible', async () => {
  const supabase = fakeProfiles();
  const session = { id: 'vs_2', metadata: { userId: 'user-6' }, verified_outputs: { dob: { day: 1, month: 1, year: nowYear - 15 } } };
  const result = await recordIdentityVerification(session, supabase);
  assert.deepEqual(result, { ok: true, adult: false });
  assert.equal(supabase.updates[0].row.identity_verified, true);
  assert.equal(supabase.updates[0].row.identity_18plus, false);
});

test('an identity session with no member id changes nothing', async () => {
  const supabase = fakeProfiles();
  const result = await recordIdentityVerification({ id: 'vs_3', metadata: {} }, supabase);
  assert.deepEqual(result, { ok: false, reason: 'unrecognised-session' });
  assert.equal(supabase.updates.length, 0);
});

test('the webhook rejects a request with a bad signature', async () => {
  const stripe = { webhooks: { constructEvent() { throw new Error('No signatures found matching the expected signature'); } } };
  const handler = (await import('../api/stripe-webhook.js')).default;
  let status = 0; let payload = null;
  const req = { method: 'POST', headers: { 'stripe-signature': 'bad' }, [Symbol.asyncIterator]: async function* () { yield Buffer.from('{}'); } };
  const res = { setHeader() {}, status(code) { status = code; return this; }, json(body) { payload = body; return this; } };
  await handler(req, res, { env: { STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: 'whsec_test' }, stripe });
  assert.equal(status, 400);
  assert.match(payload.error, /Signature verification failed/);
});
