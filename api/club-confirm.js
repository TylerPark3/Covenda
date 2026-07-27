// The officer-facing confirmation route.
//
// No session, no account. A club officer is a volunteer with a one-year term; asking them to
// sign up in order to vouch for a member is where this feature would quietly die. The student
// sends them a single-use link, and this endpoint reads it and records the decision.
//
// The token is therefore the entire credential, which is why it is CSPRNG-generated,
// single-use, expiring, and why a confirmation requires the officer to put a name to it.

import { createClient } from '@supabase/supabase-js';
import { resolveClubConfirmation, decideClubConfirmation } from './portal.js';

function serviceClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Confirmation is not configured on this deployment.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function handler(req, res) {
  try {
    const supabase = serviceClient();

    if (req.method === 'GET') {
      const token = new URL(req.url, 'http://localhost').searchParams.get('token');
      const record = await resolveClubConfirmation(supabase, token);
      if (!record) return res.status(404).json({ ok: false, error: 'That confirmation link is not valid.' });
      // Never echo the token back, and never expose the student's user id.
      return res.status(200).json({
        ok: true,
        usable: record.usable,
        reason: record.reason || null,
        club: record.club ? { name: record.club.name, school: record.club.school } : null,
        studentName: record.studentName || null,
        studentSchool: record.studentSchool || null,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const result = await decideClubConfirmation(supabase, body);
      return res.status(200).json({ ok: true, ...result });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || 'Something went wrong.') });
  }
}
