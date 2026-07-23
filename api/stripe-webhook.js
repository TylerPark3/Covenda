import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { CREDIT_BUNDLES } from './portal.js';
import { supabaseConfiguration } from './submissions.js';

// Stripe -> Covenda. This is the ONLY place a real credit purchase is granted, so it is
// gated three ways: Stripe's signature proves the request is really from Stripe (not a
// forged "payment succeeded"); the amount is re-derived from our own bundle table, never
// trusted from the event; and the Stripe session id is written as external_ref under a
// unique index, so a retried webhook can never grant twice.

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function serviceClient(env, createSupabaseClient = createClient) {
  const configuration = supabaseConfiguration(env);
  return createSupabaseClient(configuration.url, configuration.secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

// Adult if born on or before (today − 18 years). dob is Stripe's { day, month, year }.
export function isAdult(dob) {
  if (!dob || !dob.year) return false;
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
  const born = new Date(Date.UTC(dob.year, (dob.month || 1) - 1, dob.day || 1));
  return born <= cutoff;
}

// A verified identity session: mark the profile verified and record whether they are 18+.
// We store only the result — never the document. Idempotent (re-running just re-sets the
// same flags). If the event lacks verified_outputs (Stripe redacts them by default), we
// retrieve the session with expand to read the date of birth for the 18+ check.
export async function recordIdentityVerification(session, supabase, { stripe } = {}) {
  const userId = session?.metadata?.userId;
  if (!userId) return { ok: false, reason: 'unrecognised-session' };
  let dob = session?.verified_outputs?.dob;
  if (!dob && stripe) {
    try {
      const full = await stripe.identity.verificationSessions.retrieve(session.id, { expand: ['verified_outputs'] });
      dob = full?.verified_outputs?.dob;
    } catch { /* fall through: verified, but treat as unknown age (not 18+) until re-checked */ }
  }
  const adult = isAdult(dob);
  const { error } = await supabase.from('member_profiles').update({
    identity_verified: true,
    identity_verified_at: new Date().toISOString(),
    identity_18plus: adult,
    identity_session_id: session.id,
  }).eq('user_id', userId);
  if (error) throw error;
  return { ok: true, adult };
}

// Insert the purchase, idempotently. Testable in isolation from Stripe.
export async function recordStripePurchase(session, supabase) {
  const userId = session?.metadata?.userId;
  const credits = Math.round(Number(session?.metadata?.credits) || 0);
  if (!userId || !CREDIT_BUNDLES.has(credits)) return { ok: false, reason: 'unrecognised-session' };
  const priceUsd = CREDIT_BUNDLES.get(credits);
  const { error } = await supabase.from('credit_ledger').insert({
    user_id: userId,
    entry_type: 'purchase',
    credits,
    note: `Card purchase · ${credits} credits · $${priceUsd}`,
    external_ref: session.id,
  });
  // A unique-violation on external_ref means this session was already processed — that is
  // success from the caller's view (Stripe just retried), not an error.
  if (error) {
    if (/duplicate key|unique|already exists|23505/i.test(String(error.message || error))) return { ok: true, duplicate: true };
    throw error;
  }
  return { ok: true };
}

export default async function handler(req, res, dependencies = {}) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed.' }); }
  const env = dependencies.env || process.env;
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ ok: false, error: 'Stripe webhook is not configured.' });

  let event;
  try {
    // Trim both secrets: a pasted trailing space/newline would otherwise silently break the
    // HMAC signature check (every real event would 400) or the auth header.
    const stripe = dependencies.stripe || new Stripe(env.STRIPE_SECRET_KEY.trim());
    const body = await rawBody(req);
    event = stripe.webhooks.constructEvent(body, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET.trim());
  } catch (error) {
    // A bad or missing signature is the forgery case — refuse it.
    return res.status(400).json({ ok: false, error: `Signature verification failed: ${(error && error.message) || 'unknown'}` });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const supabase = dependencies.supabase || serviceClient(env);
      await recordStripePurchase(event.data.object, supabase);
    } else if (event.type === 'identity.verification_session.verified') {
      const supabase = dependencies.supabase || serviceClient(env);
      const stripe = dependencies.stripe || new Stripe(env.STRIPE_SECRET_KEY.trim());
      await recordIdentityVerification(event.data.object, supabase, { stripe });
    }
    // Acknowledge every event type so Stripe stops retrying; we only act on the ones we handle.
    return res.status(200).json({ received: true });
  } catch (error) {
    // A real failure to write — return 500 so Stripe retries later (idempotency makes that safe).
    console.error(JSON.stringify({ level: 'error', message: 'Stripe webhook processing failed', type: event?.type, error: String(error?.message || error).slice(0, 300) }));
    return res.status(500).json({ ok: false, error: 'Webhook processing failed.' });
  }
}
