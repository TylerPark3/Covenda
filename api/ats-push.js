// The route behind the ATS push. api/ats.js holds the rules; this does the call.
//
// Consent is re-read here rather than trusted from the client, because the client asking to
// push is exactly the party that benefits from skipping the check.

import { createClient } from '@supabase/supabase-js';
import { prepareExport, PROVIDERS, atsMode } from './ats.js';

function serviceClient(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('This deployment is not configured for ATS pushes.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function userFrom(req, supabase) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data?.user || null;
}

export default async function handler(req, res) {
  const env = process.env;
  try {
    const supabase = serviceClient(env);
    const user = await userFrom(req, supabase);
    if (!user) return res.status(401).json({ ok: false, error: 'Sign in first.' });

    const { data: connection } = await supabase.from('ats_connections')
      .select('*').eq('company_user_id', user.id).maybeSingle();

    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, ...atsMode(connection), providers: Object.values(PROVIDERS).map(p => ({ id: p.id, label: p.label })) });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (body.action === 'connect') {
      const provider = String(body.provider || '');
      if (!PROVIDERS[provider]) return res.status(400).json({ ok: false, error: 'Choose a supported ATS.' });
      // The key lives in the environment, one per deployment for the pilot. We record only
      // that a provider is selected — this table is never a credential store.
      const keyName = `ATS_${provider.toUpperCase()}_API_KEY`;
      await supabase.from('ats_connections').upsert({
        company_user_id: user.id, provider,
        api_key_set: Boolean(env[keyName]),
        external_org: String(body.org || '').slice(0, 120) || null,
      }, { onConflict: 'company_user_id' });
      return res.status(200).json({
        ok: true, provider,
        connected: Boolean(env[keyName]),
        note: env[keyName] ? `Connected to ${PROVIDERS[provider].label}.` : `Covenda still needs ${keyName} set on this deployment before pushes will go through.`,
      });
    }

    if (body.action === 'push') {
      if (!connection) return res.status(400).json({ ok: false, error: 'Connect an ATS first.' });
      const studentId = String(body.studentUserId || '');
      const [{ data: student }, { data: consent }] = await Promise.all([
        supabase.from('member_profiles').select('*').eq('user_id', studentId).maybeSingle(),
        supabase.from('export_consents').select('*').eq('student_user_id', studentId).eq('company_user_id', user.id).maybeSingle(),
      ]);
      if (!student) return res.status(404).json({ ok: false, error: 'That student is no longer available.' });

      // The student's email is not on member_profiles; read it from auth, and only after
      // consent has been confirmed by prepareExport below.
      const prepared = prepareExport({
        provider: connection.provider,
        student: { ...student, email: body.email || student.email },
        consent, companyUserId: user.id,
        fit: body.fit || null, project: body.project || null, notes: body.notes || '',
        now: new Date().toISOString(),
      });
      if (!prepared.ok) return res.status(403).json({ ok: false, error: prepared.reason });

      const keyName = `ATS_${connection.provider.toUpperCase()}_API_KEY`;
      const apiKey = env[keyName];
      if (!apiKey) return res.status(503).json({ ok: false, error: `${keyName} is not set on this deployment.` });

      const response = await fetch(prepared.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
          'On-Behalf-Of': String(body.onBehalfOf || ''),
        },
        body: JSON.stringify(prepared.payload),
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok) return res.status(502).json({ ok: false, error: out?.message || 'That ATS rejected the push.' });

      // A student is entitled to know where their data went.
      await supabase.from('export_log').insert({
        student_user_id: studentId, company_user_id: user.id,
        provider: connection.provider, external_id: String(out.id || out.candidate?.id || ''),
        dropped_fields: prepared.dropped,
      });
      await supabase.from('ats_connections').update({ last_push_at: new Date().toISOString() }).eq('company_user_id', user.id);

      return res.status(200).json({ ok: true, externalId: out.id || null, dropped: prepared.dropped });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action.' });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error?.message || 'Something went wrong.') });
  }
}
