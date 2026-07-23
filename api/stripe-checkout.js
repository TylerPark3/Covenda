import Stripe from 'stripe';

import { authorizeMember, CREDIT_BUNDLES } from './portal.js';

// Money in: a company/university buys a credit bundle. Stripe Checkout hosts the card
// form, so Covenda never touches card data. Credits are NOT granted here — they are
// granted only when Stripe confirms payment via the webhook (see api/stripe-webhook.js),
// so a session that is never paid grants nothing.

export class StripeNotConfiguredError extends Error {
  constructor() { super('Card payments are not enabled yet.'); this.name = 'StripeNotConfiguredError'; }
}

function baseUrl(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || '').trim() || (host.startsWith('localhost') ? 'http' : 'https');
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) throw new Error('Invalid host.');
  return `${proto}://${host}`;
}

// Build (but do not send) the Checkout session. Injectable stripe client keeps it testable.
export async function createCheckoutSession({ member, credits, origin, env = process.env, stripe }) {
  const amount = Math.round(Number(credits) || 0);
  if (!CREDIT_BUNDLES.has(amount)) throw new Error('Choose one of the available credit bundles.');
  if (!env.STRIPE_SECRET_KEY) throw new StripeNotConfiguredError();
  const priceUsd = CREDIT_BUNDLES.get(amount);
  const client = stripe || new Stripe(env.STRIPE_SECRET_KEY);
  const session = await client.checkout.sessions.create({
    mode: 'payment',
    // client_reference_id + metadata are what the webhook trusts to credit the right
    // account for the right amount — never the (spoofable) request body.
    client_reference_id: member.user.id,
    metadata: { userId: member.user.id, credits: String(amount) },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: priceUsd * 100,
        product_data: { name: `${amount.toLocaleString()} Covenda credits` },
      },
    }],
    success_url: `${origin}/portal.html?wallet=paid`,
    cancel_url: `${origin}/portal.html?wallet=cancelled`,
  });
  return { url: session.url };
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return req.body || {};
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed.' }); }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });
  const member = await authorizeMember(req, dependencies);
  if (!member) return res.status(401).json({ ok: false, error: 'Member authentication is required.' });
  let body;
  try { body = parseBody(req); } catch { return res.status(400).json({ ok: false, error: 'Invalid request.' }); }
  try {
    const result = await createCheckoutSession({ member, credits: body.credits, origin: baseUrl(req), env: dependencies.env || process.env, stripe: dependencies.stripe });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) return res.status(503).json({ ok: false, code: 'STRIPE_NOT_CONFIGURED', error: error.message });
    const message = (error && error.message) || 'Could not start checkout.';
    const expected = /^Choose/.test(message);
    return res.status(expected ? 400 : 502).json({ ok: false, error: message });
  }
}
