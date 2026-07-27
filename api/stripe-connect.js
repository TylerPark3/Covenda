// Student payout accounts, via Stripe Connect.
//
// Onboarding runs in Stripe's hosted flow, which is the reason to use Connect at all: the
// student's bank details never touch Covenda, so a leak here cannot become a financial-data
// breach. We keep the account ID and a derived state, nothing else.
//
// Degrades rather than breaks. If Connect is not configured the manual path stays and the
// copy says so — promising an automated transfer that cannot happen is a bad promise to make
// to someone who already did the work.

import { createClient } from '@supabase/supabase-js';
import { accountState, payoutsMode } from './payouts.js';

function serviceClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Payouts are not configured on this deployment.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function memberFromRequest(req, supabase) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data?.user || null;
}

async function stripeCall(env, path, body, method = 'POST') {
  const params = new URLSearchParams();
  const walk = (obj, prefix = '') => {
    for (const [k, v] of Object.entries(obj || {})) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key);
      else if (v !== undefined && v !== null) params.append(key, String(v));
    }
  };
  walk(body);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'GET' ? undefined : params.toString(),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || 'Stripe rejected that request.');
  return json;
}

export default async function handler(req, res) {
  const env = process.env;
  const mode = payoutsMode(env);
  try {
    if (req.method === 'GET') {
      // Lets the portal say which path is live before offering anything.
      return res.status(200).json({ ok: true, ...mode });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    if (!mode.automated) {
      return res.status(503).json({ ok: false, ...mode, error: mode.note });
    }

    const supabase = serviceClient(env);
    const user = await memberFromRequest(req, supabase);
    if (!user) return res.status(401).json({ ok: false, error: 'Sign in first.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const profile = await supabase.from('member_profiles')
      .select('role,stripe_account_id').eq('user_id', user.id).maybeSingle();
    if (profile.data?.role !== 'student') {
      return res.status(403).json({ ok: false, error: 'Only student accounts receive payouts.' });
    }

    let accountId = profile.data?.stripe_account_id || null;

    if (body.action === 'start') {
      if (!accountId) {
        const account = await stripeCall(env, 'accounts', {
          type: 'express',
          email: user.email,
          capabilities: { transfers: { requested: true } },
          business_type: 'individual',
        });
        accountId = account.id;
        await supabase.from('member_profiles')
          .update({ stripe_account_id: accountId, stripe_account_state: 'pending' })
          .eq('user_id', user.id);
      }
      const origin = req.headers.origin || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
      const link = await stripeCall(env, 'account_links', {
        account: accountId,
        type: 'account_onboarding',
        refresh_url: `${origin}/portal.html?payouts=retry`,
        return_url: `${origin}/portal.html?payouts=done`,
      });
      return res.status(200).json({ ok: true, url: link.url });
    }

    if (body.action === 'status') {
      if (!accountId) return res.status(200).json({ ok: true, ...accountState(null) });
      const account = await stripeCall(env, `accounts/${accountId}`, {}, 'GET');
      const state = accountState(account);
      // Cached so the portal can render without a Stripe round-trip on every load.
      await supabase.from('member_profiles').update({
        stripe_payouts_enabled: state.canReceive,
        stripe_account_state: state.state,
        stripe_account_checked_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      return res.status(200).json({ ok: true, ...state });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action.' });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || 'Something went wrong.') });
  }
}
