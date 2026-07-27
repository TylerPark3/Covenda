// Paying students, for real.
//
// A payout request currently records an intent and then an operator arranges the transfer by
// hand. That is honest for a founder-led pilot and it is the first thing that breaks: it does
// not scale past a handful of students, it has no audit trail beyond a note, and "we'll sort
// it out" is a bad promise to make to someone who already did the work.
//
// Stripe Connect closes that. The student onboards once through Stripe's hosted flow —
// Covenda never touches a bank number, which is why the payout table deliberately stores a
// method and a handle rather than account details — and afterwards a payout is a transfer.
//
// ── WHAT THIS MODULE IS ───────────────────────────────────────────────────────────────
// The rules, kept pure. Every decision about whether a payout MAY happen lives here so it
// can be tested without a Stripe account; the API layer does the calls.

export const PAYOUTS_VERSION = 'payouts-1.0.0';

// Connect onboarding is not instant and it can stall. A student who is mid-onboarding needs
// to know that, not see a silent failure when they request money.
export const ACCOUNT_STATES = ['none', 'pending', 'restricted', 'ready'];

export function accountState(account = null) {
  if (!account) return { state: 'none', canReceive: false, message: 'Set up payouts before requesting one. It takes a couple of minutes and Covenda never sees your bank details.' };

  const chargesOk = account.payouts_enabled === true;
  const due = (account.requirements?.currently_due || []).length;
  const pastDue = (account.requirements?.past_due || []).length;

  if (chargesOk && !pastDue) {
    return { state: 'ready', canReceive: true, message: 'Payouts are set up.' };
  }
  if (pastDue) {
    return {
      state: 'restricted', canReceive: false,
      message: 'Stripe needs something from you before it can pay out. Finish the details it asks for.',
    };
  }
  return {
    state: 'pending', canReceive: false,
    message: due
      ? 'Stripe is still verifying you. This usually takes a few minutes; occasionally a day.'
      : 'Stripe is still verifying you.',
  };
}

// A payout must never exceed what the ledger says is owed. The ledger is the source of truth;
// a stale balance in a UI is not, so the amount is re-checked here against the number the
// caller passes from a fresh read.
export function checkPayout({ credits, balance, account, alreadyOpen = false } = {}) {
  const amount = Math.round(Number(credits) || 0);
  if (amount <= 0) return { ok: false, reason: 'Enter how many credits you want to withdraw.' };
  if (!Number.isFinite(Number(balance))) return { ok: false, reason: 'We could not read your balance. Try again in a moment.' };
  if (amount > Number(balance)) {
    return { ok: false, reason: `You have ${balance} credits. Ask for that or less.` };
  }
  if (alreadyOpen) {
    return { ok: false, reason: 'You already have a payout in progress. It has to settle before you request another.' };
  }
  const acct = accountState(account);
  if (!acct.canReceive) return { ok: false, reason: acct.message, accountState: acct.state };
  return { ok: true, amount, accountState: acct.state };
}

// 1 credit = $1, stated in one place so the API and the UI cannot disagree about it.
export const CENTS_PER_CREDIT = 100;

export function creditsToCents(credits) {
  const n = Math.round(Number(credits) || 0);
  return Math.max(0, n) * CENTS_PER_CREDIT;
}

// Stripe retries webhooks, and a transfer that runs twice pays twice. Every transfer carries
// a key derived from the payout request, so a retry is a no-op rather than a second payment.
export function transferIdempotencyKey(payoutRequestId) {
  const id = String(payoutRequestId || '').trim();
  if (!id) throw new Error('A transfer needs the payout request it belongs to.');
  return `covenda-payout-${id}`;
}

// What a student is told while money is moving. Vague states are how people end up emailing
// to ask whether they have been paid.
export function payoutStatusLabel(row = {}) {
  const map = {
    requested: { label: 'Requested', detail: 'Covenda is releasing it. You will see it land in your account.' },
    paid: { label: 'Sent', detail: 'On its way to your bank. Stripe typically settles in 2–3 business days.' },
    cancelled: { label: 'Cancelled', detail: 'This request was cancelled. The credits are still yours.' },
  };
  return map[row.status] || { label: row.status || 'Unknown', detail: '' };
}

// Whether Connect is usable on this deployment at all. Without it the manual path stays, and
// the copy should say which one a student is on rather than implying an automated transfer
// that is not going to happen.
export function payoutsMode(env = {}) {
  const connect = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_CONNECT_ENABLED === 'true');
  return {
    mode: connect ? 'connect' : 'manual',
    automated: connect,
    note: connect
      ? 'Payouts run through Stripe. Set up once, then withdrawals are automatic.'
      : 'Payouts are arranged by hand right now — request one and Covenda will contact you to settle it.',
  };
}
