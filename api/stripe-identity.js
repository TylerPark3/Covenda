import Stripe from 'stripe';

import { authorizeMember } from './portal.js';
import { StripeNotConfiguredError } from './stripe-checkout.js';

// Identity verification. The student is sent to Stripe Identity's hosted flow to photograph
// a government ID + take a selfie. Covenda never sees or stores the document — Stripe verifies
// it and, when done, fires the identity.verification_session.verified webhook. We only ever
// learn the RESULT (verified? 18+?). This is what unlocks the "Identity verified" badge and
// payout eligibility.

function baseUrl(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || '').trim() || (host.startsWith('localhost') ? 'http' : 'https');
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) throw new Error('Invalid host.');
  return `${proto}://${host}`;
}

// Build (but do not send) a verification session. Injectable stripe client keeps it testable.
export async function createVerificationSession({ member, origin, env = process.env, stripe }) {
  if (!env.STRIPE_SECRET_KEY) throw new StripeNotConfiguredError();
  const client = stripe || new Stripe(env.STRIPE_SECRET_KEY.trim());
  const session = await client.identity.verificationSessions.create({
    type: 'document',
    // metadata.userId is how the webhook knows whose profile to mark verified — never the body.
    metadata: { userId: member.user.id },
    options: { document: { require_matching_selfie: true } },
    return_url: `${origin}/portal.html?identity=submitted`,
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
  try { parseBody(req); } catch { return res.status(400).json({ ok: false, error: 'Invalid request.' }); }
  try {
    const result = await createVerificationSession({ member, origin: baseUrl(req), env: dependencies.env || process.env, stripe: dependencies.stripe });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) return res.status(503).json({ ok: false, code: 'STRIPE_NOT_CONFIGURED', error: error.message });
    console.error(JSON.stringify({ level: 'error', message: 'Identity session failed', type: error?.type, code: error?.code, detail: String(error?.detail?.message || error?.detail || error?.message || '').slice(0, 300) }));
    return res.status(502).json({ ok: false, error: (error && error.message) || 'Could not start identity verification.' });
  }
}
