// Nightly label materialisation, and the readiness report that answers "when can the
// re-ranker actually run".
//
// Without this, events accumulate and never become labels: `ml.js` would sit gated forever
// while trials completed all around it. This is the job that closes the loop.

import { createClient } from '@supabase/supabase-js';

import { scorerGate } from './hardening.js';
import { materializeLabels } from './match-events.js';

function serviceClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Only real_trial rows count toward the gate. Founder ratings are judgement and synthetic
// rows are plumbing; pooling either into the count would open the gate on a number that
// does not mean what it says.
export async function labelReadiness(db) {
  const { data, error } = await db.from('training_labels')
    .select('label, source').eq('source', 'real_trial');
  if (error) return { ready: false, reason: error.message, have: 0 };

  const rows = data || [];
  const positives = rows.filter(r => r.label === 1).length;
  const gate = scorerGate(rows.length);
  return {
    ...gate,
    positives,
    negatives: rows.length - positives,
    // A set that is all one class teaches nothing however large it gets.
    balanced: positives > 0 && positives < rows.length,
    blockers: [
      !gate.ready ? `${gate.needed - gate.have} more completed trials with a close-out rating` : null,
      positives === 0 && rows.length > 0 ? 'no positive outcomes yet — nothing to learn from' : null,
      positives === rows.length && rows.length > 0 ? 'no negative outcomes yet — the model cannot separate' : null,
    ].filter(Boolean),
  };
}

export default async function handler(req, res) {
  // Vercel cron sends this header; a stray public request must not be able to run the job.
  const isCron = req.headers['x-vercel-cron'] || req.headers.authorization === `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!isCron && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ ok: false, error: 'Not authorised.' });
  }
  const db = serviceClient();
  if (!db) return res.status(503).json({ ok: false, error: 'Not configured.' });

  try {
    const written = await materializeLabels(db);
    const readiness = await labelReadiness(db);
    return res.status(200).json({ ok: true, ...written, readiness });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'Label materialisation failed', error: String(error?.message || error) }));
    return res.status(500).json({ ok: false, error: 'Materialisation failed.' });
  }
}
