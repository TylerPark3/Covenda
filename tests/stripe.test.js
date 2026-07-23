import assert from 'node:assert/strict';
import test from 'node:test';

import { createCheckoutSession, StripeNotConfiguredError } from '../api/stripe-checkout.js';
import { recordStripePurchase } from '../api/stripe-webhook.js';

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

test('checkout rejects an off-menu credit amount', async () => {
  await assert.rejects(
    () => createCheckoutSession({ member, credits: 750, origin: 'https://covenda.app', env: { STRIPE_SECRET_KEY: 'sk_test' }, stripe: fakeStripe() }),
    /Choose one of the available credit bundles/,
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

test('a duplicate session is treated as success, not an error', async () => {
  const supabase = fakeSupabase({ failWith: { message: 'duplicate key value violates unique constraint' } });
  const result = await recordStripePurchase({ id: 'cs_test_abc', metadata: { userId: 'user-9', credits: '1000' } }, supabase);
  assert.deepEqual(result, { ok: true, duplicate: true });
});

test('an unrecognised amount grants nothing', async () => {
  const supabase = fakeSupabase();
  const result = await recordStripePurchase({ id: 'cs_test_bad', metadata: { userId: 'user-9', credits: '333' } }, supabase);
  assert.deepEqual(result, { ok: false, reason: 'unrecognised-session' });
  assert.equal(supabase.inserts.length, 0);
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
