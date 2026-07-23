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
    const stripe = dependencies.stripe || new Stripe(env.STRIPE_SECRET_KEY);
    const body = await rawBody(req);
    event = stripe.webhooks.constructEvent(body, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    // A bad or missing signature is the forgery case — refuse it.
    return res.status(400).json({ ok: false, error: `Signature verification failed: ${(error && error.message) || 'unknown'}` });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const supabase = dependencies.supabase || serviceClient(env);
      await recordStripePurchase(event.data.object, supabase);
    }
    // Acknowledge every event type so Stripe stops retrying; we only act on the one.
    return res.status(200).json({ received: true });
  } catch (error) {
    // A real failure to write — return 500 so Stripe retries later (idempotency makes that safe).
    console.error(JSON.stringify({ level: 'error', message: 'Stripe webhook processing failed', type: event?.type, error: String(error?.message || error).slice(0, 300) }));
    return res.status(500).json({ ok: false, error: 'Webhook processing failed.' });
  }
}
