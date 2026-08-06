// The fortnightly batch review.
//
// batch-churn.js has held the policy since it was written and nothing ever ran it, so a batch
// admitted in March still lists members who have done nothing since — on a list a company pays
// to open. The list IS the product, so a list that never turns over stops meaning anything.
//
// This is a REPORT, not an execution. It computes who the policy would remove and records it;
// an operator confirms. Automatic removal from a cohort someone was told they were in is the
// kind of thing that should require a human to press the button, at least until the policy has
// been watched running for a few cycles.

import { createClient } from '@supabase/supabase-js';

import { reviewBatch, CHURN_POLICY, removalMessage } from './batch-churn.js';
import { recordError } from './limits.js';
import { rejectUnauthorisedCron } from './cron-auth.js';

function serviceClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Activity is read from what a member actually did, never from a login timestamp — being
// logged in is not participation, and treating it as such would remove the wrong people.
export async function gatherMembers(db, batchId) {
  const { data: admitted } = await db.from('batch_applications')
    .select('student_user_id, created_at, reviewed_at')
    .eq('batch_id', batchId).eq('status', 'accepted');
  if (!admitted?.length) return [];

  const ids = admitted.map(a => a.student_user_id);
  const [{ data: projects }, { data: events }] = await Promise.all([
    db.from('member_projects').select('assigned_student_user_id,status,updated_at').in('assigned_student_user_id', ids),
    db.from('match_events').select('student_user_id,created_at').in('student_user_id', ids),
  ]);

  return admitted.map(a => {
    const mine = (projects || []).filter(p => p.assigned_student_user_id === a.student_user_id);
    const acts = (events || []).filter(e => e.student_user_id === a.student_user_id).map(e => e.created_at);
    const last = [...acts, ...mine.map(p => p.updated_at)].sort().pop() || a.reviewed_at || a.created_at;
    return {
      userId: a.student_user_id,
      admittedAt: a.reviewed_at || a.created_at,
      lastActiveAt: last,
      completed: mine.filter(p => p.status === 'complete').length,
      inTrial: mine.some(p => ['matched', 'in_progress', 'review'].includes(p.status)),
    };
  });
}

export default async function handler(req, res) {
  if (rejectUnauthorisedCron(req, res)) return;
  const db = serviceClient();
  if (!db) return res.status(503).json({ ok: false, error: 'Not configured.' });

  try {
    const { data: batches } = await db.from('batches').select('id,name,capacity').eq('status', 'open');
    const reports = [];

    for (const batch of batches || []) {
      const members = await gatherMembers(db, batch.id);
      if (!members.length) continue;

      const { data: waiting } = await db.from('batch_applications')
        .select('id').eq('batch_id', batch.id).eq('status', 'waitlisted');

      const result = reviewBatch(members, {
        capacity: batch.capacity || members.length,
        waitlisted: (waiting || []).length,
      });

      // Recorded, not executed. Nobody is removed by a cron job.
      if (result.removals?.length) {
        await db.from('error_events').insert({
          route: 'batch-review',
          kind: 'degraded',
          message: `${batch.name}: ${result.removals.length} member(s) meet the removal policy`,
          detail: { batchId: batch.id, count: result.removals.length, warned: result.warnings?.length || 0 },
        });
      }
      reports.push({
        batch: batch.name,
        reviewed: members.length,
        wouldRemove: (result.removals || []).map(r => ({ userId: r.userId, reason: removalMessage(r) })),
        warnings: (result.warnings || []).length,
      });
    }
    return res.status(200).json({ ok: true, policy: CHURN_POLICY, reports, executed: false });
  } catch (error) {
    await recordError('batch-review', 'error', error?.message || 'unknown');
    return res.status(500).json({ ok: false, error: 'Review failed.' });
  }
}
