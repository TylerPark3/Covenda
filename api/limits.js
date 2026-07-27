// Rate limiting and error recording.
//
// ── WHY THE COUNTER IS IN POSTGRES ────────────────────────────────────────────────────
// Serverless functions share no memory. An in-process counter resets on every cold start and
// is per-instance besides, so it would cap nothing while looking like it capped something —
// which is worse than no limiter, because you would stop worrying about it.
//
// ── WHAT THIS IS ACTUALLY PROTECTING ──────────────────────────────────────────────────
// Cost, not abuse. `/api/resume-interview` calls the Anthropic API on every upload. Without a
// cap, one signed-in account re-uploading the same file runs up a bill with no ceiling. The
// limits below are set where a real person would never notice them and a loop would.
//
// ── FAILING OPEN, DELIBERATELY ────────────────────────────────────────────────────────
// If the limiter itself is broken or un-migrated, requests are ALLOWED. A limiter that takes
// the product down when its own table is missing has caused more damage than the abuse it
// was guarding against. The failure is recorded instead.

import { createClient } from '@supabase/supabase-js';

export const LIMITS_VERSION = 'limits-1.0.0';

// windowSeconds, max. Chosen so a person never hits them and a script does.
export const LIMITS = {
  'resume-interview': { windowSeconds: 3600, max: 10 },   // costs money per call
  'upload-token': { windowSeconds: 3600, max: 40 },       // a long session might retake a lot
  'media-sign': { windowSeconds: 3600, max: 200 },        // one per play, generous
  'exercise-file': { windowSeconds: 3600, max: 60 },
};

function serviceClient(env = process.env, createImpl = createClient) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createImpl(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Floors `now` to the start of the current window, so every instance agrees which bucket a
// request belongs to without any coordination between them.
export function windowStart(now, windowSeconds) {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now / ms) * ms).toISOString();
}

export async function checkLimit(action, subject, { env = process.env, now = Date.now(), client = null } = {}) {
  const rule = LIMITS[action];
  if (!rule || !subject) return { allowed: true, skipped: 'no rule' };

  const supabase = client || serviceClient(env);
  if (!supabase) return { allowed: true, skipped: 'not configured' };

  try {
    const { data, error } = await supabase.rpc('bump_rate_limit', {
      p_subject: String(subject).slice(0, 200),
      p_action: action,
      p_window_start: windowStart(now, rule.windowSeconds),
    });
    if (error) throw new Error(error.message);
    const count = Number(data) || 0;
    if (count > rule.max) {
      const resetIn = rule.windowSeconds - Math.floor((now % (rule.windowSeconds * 1000)) / 1000);
      return { allowed: false, count, max: rule.max, resetIn };
    }
    return { allowed: true, count, max: rule.max, remaining: Math.max(0, rule.max - count) };
  } catch (error) {
    // Fail open. A broken limiter must not become an outage.
    console.warn(JSON.stringify({ level: 'warn', message: 'Rate limit check failed, allowing', action, error: String(error?.message || error) }));
    return { allowed: true, skipped: 'limiter unavailable' };
  }
}

// Records a failure somewhere queryable. console.error goes to Vercel logs and dies there, so
// the first anyone hears of a recurring failure is a user reporting it.
//
// Never records a request body. A log that quietly accumulates user data is a breach waiting
// to be found.
export async function recordError(route, kind, message, { detail = {}, userId = null, env = process.env, client = null } = {}) {
  const line = { level: 'error', route, kind, message: String(message).slice(0, 500) };
  console.error(JSON.stringify(line));

  const supabase = client || serviceClient(env);
  if (!supabase) return { stored: false };
  try {
    const { error } = await supabase.from('error_events').insert({
      route: String(route).slice(0, 120),
      kind: String(kind).slice(0, 40),
      message: String(message).slice(0, 500),
      detail: safeDetail(detail),
      user_id: userId,
    });
    if (error) throw new Error(error.message);
    return { stored: true };
  } catch (error) {
    // Recording a failure must never itself fail the request.
    console.warn(JSON.stringify({ level: 'warn', message: 'Could not store error event', error: String(error?.message || error) }));
    return { stored: false };
  }
}

// Only scalars, only shallow, and nothing that looks like a credential or an address.
const FORBIDDEN = /token|secret|key|password|authorization|cookie|email|phone/i;
export function safeDetail(detail) {
  const out = {};
  for (const [k, v] of Object.entries(detail || {})) {
    if (FORBIDDEN.test(k)) continue;
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      out[k] = typeof v === 'string' ? v.slice(0, 200) : v;
    }
  }
  return out;
}

// The 429 body, written so a person reading it knows what to do.
export function limitResponse(res, verdict, what) {
  const minutes = Math.max(1, Math.ceil((verdict.resetIn || 3600) / 60));
  return res.status(429).json({
    ok: false,
    error: `That is more ${what} than we allow in an hour. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    retryAfterSeconds: verdict.resetIn,
  });
}
