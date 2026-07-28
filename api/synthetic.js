// Synthetic data, for testing the label pipeline before real trials exist.
//
// ── WHY THIS IS NEEDED ────────────────────────────────────────────────────────────────
// There are zero completed trials, so there is no way to watch a label appear end to end.
// Without that, the first time anyone learns whether the pipeline works is when a real trial
// completes — which is the worst possible moment to find a break.
//
// ── THE ISOLATION GUARANTEE ───────────────────────────────────────────────────────────
// Every record written here is tagged `synthetic`, and every read excludes it unless the
// caller passes includeSynthetic explicitly. Synthetic rows must never reach an employer
// surface, a metric, or a training run.
//
// The tag is on the ROW, not on a naming convention. A convention holds until someone forgets;
// a column can be filtered on with confidence, and a training run that accidentally includes
// fabricated outcomes produces a model that cannot be defended to anyone.

import { createClient } from '@supabase/supabase-js';

import { recordError } from './limits.js';

export const SYNTHETIC_VERSION = 'synthetic-1.0.0';

function serviceClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Refused in production unless explicitly switched on. The endpoint writes fabricated data;
// leaving it open on a live deployment is how a synthetic outcome ends up in a real metric.
export function isEnabled(env = process.env) {
  return env.NODE_ENV !== 'production' || env.SYNTHETIC_DATA_ENABLED === 'true';
}

// Accepts one object or an array, per the brief. Bounded so a malformed loop cannot write
// thousands of rows before anyone notices.
export function asBatch(body, max = 100) {
  const items = Array.isArray(body) ? body : [body];
  if (items.length > max) throw new Error(`At most ${max} records per call.`);
  return items.filter(Boolean);
}

export function syntheticStudent(input = {}) {
  return {
    display_name: String(input.name || 'Synthetic student').slice(0, 120),
    role: 'student',
    headline: String(input.headline || '').slice(0, 180) || null,
    skills: Array.isArray(input.skills) ? input.skills.slice(0, 20) : [],
    verticals: Array.isArray(input.verticals) ? input.verticals.slice(0, 6) : [],
    work_types: Array.isArray(input.workTypes) ? input.workTypes.slice(0, 6) : [],
    work_style: input.workStyle && typeof input.workStyle === 'object' ? input.workStyle : null,
    traits: Array.isArray(input.traits) ? input.traits.slice(0, 6) : [],
    synthetic: true,
  };
}

export function syntheticProject(input = {}) {
  return {
    title: String(input.title || 'Synthetic project').slice(0, 160),
    summary: String(input.summary || 'Generated for pipeline testing.').slice(0, 5000),
    status: 'open',
    visibility: 'private',            // never discoverable, whatever else happens
    desired_skills: Array.isArray(input.desiredSkills) ? input.desiredSkills.slice(0, 20) : [],
    estimated_hours: Number.isFinite(input.estimatedHours) ? input.estimatedHours : 20,
    synthetic: true,
  };
}

// The point of the whole endpoint: writes a completed outcome so a label can be watched
// appearing. Source is 'synthetic' and can never be anything else from this path.
export async function syntheticOutcome(db, input = {}) {
  const matchId = String(input.matchId || '').slice(0, 60);
  if (!matchId) throw new Error('matchId is required.');
  if (typeof input.accepted !== 'boolean') throw new Error('accepted must be true or false.');
  if (typeof input.wouldRequestAgain !== 'boolean') throw new Error('wouldRequestAgain must be true or false — it is the label.');

  // Written as events so it travels the same path a real trial does. Testing the pipeline by
  // inserting a label directly would test nothing.
  const rows = [
    { event_type: 'match_shown', match_id: matchId, features: input.featureVector || { synthetic: true }, meta: { synthetic: true } },
    { event_type: input.accepted ? 'deliverable_accepted' : 'deliverable_rejected', match_id: matchId, meta: { synthetic: true } },
    { event_type: 'closeout_rating', match_id: matchId, meta: { wouldRequestAgain: input.wouldRequestAgain, synthetic: true } },
  ];
  const { error } = await db.from('match_events').insert(rows);
  if (error) throw new Error(`Could not write the outcome: ${error.message}`);
  return { matchId, events: rows.length, expectedLabel: input.accepted && input.wouldRequestAgain ? 1 : 0 };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed.' }); }
  if (!isEnabled()) {
    return res.status(403).json({ ok: false, error: 'Synthetic data is switched off on this deployment. Set SYNTHETIC_DATA_ENABLED=true to use it.' });
  }
  const db = serviceClient();
  if (!db) return res.status(503).json({ ok: false, error: 'Not configured.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const kind = String(req.query?.kind || body.kind || '');

  try {
    if (kind === 'student') {
      const rows = asBatch(body.records || body.record).map(syntheticStudent);
      const { error } = await db.from('member_profiles').insert(rows);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, created: rows.length, kind });
    }
    if (kind === 'project') {
      const rows = asBatch(body.records || body.record).map(syntheticProject);
      const { error } = await db.from('member_projects').insert(rows);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, created: rows.length, kind });
    }
    if (kind === 'outcome') {
      const results = [];
      for (const record of asBatch(body.records || body.record)) results.push(await syntheticOutcome(db, record));
      return res.status(200).json({ ok: true, outcomes: results, kind,
        note: 'Run /api/labels-cron to materialise these into training_labels with source=synthetic.' });
    }
    return res.status(400).json({ ok: false, error: 'kind must be student, project, or outcome.' });
  } catch (error) {
    await recordError('synthetic', 'error', error?.message || 'unknown', { detail: { kind } });
    return res.status(400).json({ ok: false, error: String(error?.message || 'Could not write the record.') });
  }
}
