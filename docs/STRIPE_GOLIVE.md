# Stripe go-live checklist — Covenda credit purchases

This is the money-**in** path only: a company buys credits with a card on Stripe's
hosted Checkout page, and the webhook grants the credits. Payouts to students
(money-**out**) are still handled manually via payout requests — nothing here
touches that.

**Good news:** going live needs **no code changes**. The client just redirects to
Stripe's hosted page (no publishable key / Stripe.js involved), the price is
generated server-side per bundle (no Price IDs to recreate), and the webhook grants
credits idempotently. Live-mode is purely a Stripe-dashboard + Vercel-env change.

Bundles charged (server-side, `api/stripe-checkout.js`): **100 credits → $100 ·
500 → $475 · 1,000 → $900**. New accounts also get a one-time **+50 credit** welcome
bonus on their first purchase.

---

## Before you flip the switch

- [ ] **Activate the live Stripe account.** In the Stripe dashboard, complete
  business details, identity, and **add a bank account for payouts** (Stripe won't
  release live funds without it). Account: `acct_1P2U6FKdv9H7Smpi` ("Covenda").
  You'll know it's done when the dashboard stops showing an "activate/complete your
  account" banner.
- [ ] **Decide on the welcome bonus.** `PROMO_CREDITS = 50` grants real credits (=$50
  of platform value) on a first purchase. Fine to keep, but know it's live money-
  equivalent. To change it, edit `PROMO_CREDITS` in `api/stripe-webhook.js`.

## Switch test → live

Do these together — a live secret key with a test webhook secret (or vice-versa)
means payments succeed but **credits never get granted**.

1. [ ] **Toggle the dashboard to Live mode** (top-left switch), then go to
  **Developers → API keys** and copy the **live** Secret key (`sk_live_…`).
2. [ ] In **Vercel → Project → Settings → Environment Variables**, set
  **`STRIPE_SECRET_KEY`** to the `sk_live_…` value (Production scope).
3. [ ] **Create a live webhook endpoint.** Still in Live mode: **Developers →
  Webhooks → Add endpoint**.
   - URL: `https://covenda.app/api/stripe-webhook`
   - Events to send: **`checkout.session.completed`**
     (add **`identity.verification_session.verified`** too *only if* you later turn
     on Stripe Identity via `COVENDA_IDENTITY_ENABLED`).
4. [ ] Open the new endpoint, reveal its **Signing secret** (`whsec_…`), and set
  **`STRIPE_WEBHOOK_SECRET`** in Vercel to that value (Production scope). This is the
  **live** endpoint's secret — different from the test one.
5. [ ] **Confirm `COVENDA_CREDIT_GRANTS_ENABLED` is NOT `true`** in Production. That
  flag grants credits *without charging* (a pilot/stub path) — it must be off in
  live so credits can only be minted by a real Stripe payment.
6. [ ] **Redeploy** so Vercel picks up the new env vars (push any commit to `main`,
  or hit Redeploy in the Vercel dashboard). Env-var changes don't apply until a
  redeploy.

## Verify live (one real transaction)

7. [ ] Sign in to covenda.app as a **company** account, open **Wallet → Buy credits**,
  and purchase the smallest bundle with a **real card** (you can refund yourself
  after). You should be redirected to Stripe, then back to
  `/portal.html?wallet=paid`.
8. [ ] **Confirm the credits landed.** The Wallet balance + ledger should show the
  purchase within a few seconds (that's the webhook firing). If the balance does
  **not** update, the webhook secret is wrong — re-check step 4.
9. [ ] In Stripe (Live): the **Payment** shows as succeeded, and the **webhook
  endpoint** shows a `checkout.session.completed` delivery with a **200** response.
  A non-200 there is the thing to debug (see below).
10. [ ] **Refund** your test purchase in the Stripe dashboard if you want the money
   back. (Note: a Stripe refund does **not** auto-remove the granted credits — if
   you need to claw those back, adjust the ledger manually.)

## If something's off

- **Paid but no credits:** almost always the webhook secret. The webhook is the
  *only* place credits are granted, and it rejects any event whose signature doesn't
  match `STRIPE_WEBHOOK_SECRET`. Check the endpoint's deliveries in Stripe (Live) and
  the `/api/stripe-webhook` errors in **Vercel → Logs**.
- **"Checkout could not start" / 503:** `STRIPE_SECRET_KEY` isn't set (or the app
  wasn't redeployed after setting it).
- **Retries / duplicates:** safe by design — each Checkout session id is written once
  under a unique index (`credit_ledger_external_ref_unique`), so a retried webhook
  can't grant twice.

## What this does NOT cover

- **Payouts to students** are still manual (payout requests → you arrange the
  transfer). Automating that with Stripe Connect/Payouts is a separate project.
- **Sales tax / invoicing**, **Stripe Radar** rules, and **dispute/chargeback**
  handling are left at Stripe defaults — revisit once volume is real.
- **Stripe Identity** (ID verification) stays gated behind `COVENDA_IDENTITY_ENABLED`
  and is independent of this money-in flow.
