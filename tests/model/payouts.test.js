import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountState, checkPayout, creditsToCents, transferIdempotencyKey,
  payoutStatusLabel, payoutsMode, CENTS_PER_CREDIT,
} from '../../api/payouts.js';

const READY = { payouts_enabled: true, requirements: { currently_due: [], past_due: [] } };

// A student mid-onboarding needs to be told that, not shown a silent failure.
test('every onboarding state gets a message a student can act on', () => {
  assert.equal(accountState(null).state, 'none');
  assert.equal(accountState(READY).state, 'ready');
  assert.equal(accountState({ payouts_enabled: false, requirements: { currently_due: ['dob'], past_due: [] } }).state, 'pending');
  assert.equal(accountState({ payouts_enabled: false, requirements: { currently_due: [], past_due: ['id'] } }).state, 'restricted');
  for (const acct of [null, READY, { payouts_enabled: false, requirements: { currently_due: ['dob'], past_due: [] } }]) {
    assert.ok(accountState(acct).message.length > 10);
  }
});

test('only a ready account can receive', () => {
  assert.equal(accountState(READY).canReceive, true);
  assert.equal(accountState(null).canReceive, false);
  assert.equal(accountState({ payouts_enabled: false, requirements: { currently_due: [], past_due: ['id'] } }).canReceive, false);
});

// The ledger is the source of truth. A stale balance in a UI is not.
test('a payout cannot exceed the balance', () => {
  assert.equal(checkPayout({ credits: 50, balance: 200, account: READY }).ok, true);
  const over = checkPayout({ credits: 500, balance: 200, account: READY });
  assert.equal(over.ok, false);
  assert.match(over.reason, /You have 200 credits/);
});

test('zero and negative amounts are refused', () => {
  for (const credits of [0, -5, 'x']) {
    assert.equal(checkPayout({ credits, balance: 100, account: READY }).ok, false);
  }
});

test('a second payout cannot be queued while one is in progress', () => {
  const r = checkPayout({ credits: 10, balance: 100, account: READY, alreadyOpen: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /already have a payout in progress/);
});

test('an unverified account is told why rather than just refused', () => {
  const r = checkPayout({ credits: 10, balance: 100, account: null });
  assert.equal(r.ok, false);
  assert.equal(r.accountState, 'none');
  assert.match(r.reason, /never sees your bank details/);
});

// Stripe retries webhooks. A transfer that runs twice pays twice.
test('a transfer key is derived from the request, so a retry is a no-op', () => {
  assert.equal(transferIdempotencyKey('abc'), 'covenda-payout-abc');
  assert.equal(transferIdempotencyKey('abc'), transferIdempotencyKey('abc'));
  assert.notEqual(transferIdempotencyKey('abc'), transferIdempotencyKey('def'));
  assert.throws(() => transferIdempotencyKey(''), /needs the payout request/);
});

test('one credit is one dollar, defined in one place', () => {
  assert.equal(CENTS_PER_CREDIT, 100);
  assert.equal(creditsToCents(250), 25000);
  assert.equal(creditsToCents(-5), 0);
});

test('a student is told where their money is at each step', () => {
  assert.match(payoutStatusLabel({ status: 'paid' }).detail, /2–3 business days/);
  assert.match(payoutStatusLabel({ status: 'cancelled' }).detail, /credits are still yours/);
});

// Claiming automated payouts on a deployment that cannot make them is a promise to someone
// who already did the work.
test('the copy states which payout path is actually live', () => {
  const off = payoutsMode({});
  assert.equal(off.automated, false);
  assert.match(off.note, /arranged by hand/);

  const on = payoutsMode({ STRIPE_SECRET_KEY: 'sk_test', STRIPE_CONNECT_ENABLED: 'true' });
  assert.equal(on.automated, true);
  assert.match(on.note, /through Stripe/);

  // A key alone is not enough — Connect has to be explicitly switched on.
  assert.equal(payoutsMode({ STRIPE_SECRET_KEY: 'sk_test' }).automated, false);
});
