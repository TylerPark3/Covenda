import { createClient } from '@supabase/supabase-js';

import { supabaseConfiguration } from './submissions.js';

const ADMIN_STATUSES = new Set(['received', 'reviewing', 'needs_information', 'packet_proposed', 'approval_pending', 'approved', 'declined', 'archived']);
const linkBuckets = new Map();

function text(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\0/g, '').trim().slice(0, maxLength) : '';
}

function email(value) {
  const clean = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : '';
}

function body(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return req.body || {};
}

function allowedEmails(env) {
  return new Set(text(env.COVENDA_ADMIN_EMAILS, 4_000).split(',').map(item => email(item)).filter(Boolean));
}

function serverClient(env, createSupabaseClient) {
  const configuration = supabaseConfiguration(env);
  if (!configuration) throw new Error('Admin storage is not configured.');
  return createSupabaseClient(configuration.url, configuration.secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function bearerToken(req) {
  const match = /^Bearer\s+(.+)$/i.exec(text(req.headers.authorization, 8_000));
  return match?.[1] || '';
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function redirectUrl(req) {
  const host = text(req.headers['x-forwarded-host'] || req.headers.host, 300);
  const protocol = text(req.headers['x-forwarded-proto'], 10) || (host.startsWith('localhost') ? 'http' : 'https');
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) throw new Error('Invalid redirect host.');
  return `${protocol}://${host}/admin.html`;
}

function linkRateLimited(req, address) {
  const now = Date.now();
  const ip = text(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown', 200).split(',')[0].trim();
  const key = `${ip}:${address}`;
  const recent = (linkBuckets.get(key) || []).filter(timestamp => now - timestamp < 10 * 60 * 1_000);
  recent.push(now);
  linkBuckets.set(key, recent);
  return recent.length > 3;
}

export async function authorizeAdmin(req, {
  env = process.env,
  createSupabaseClient = createClient,
} = {}) {
  const token = bearerToken(req);
  if (!token) return null;
  const allowlist = allowedEmails(env);
  if (!allowlist.size) throw new Error('Admin allowlist is not configured.');
  const supabase = serverClient(env, createSupabaseClient);
  const { data, error } = await supabase.auth.getUser(token);
  const userEmail = email(data?.user?.email);
  if (error || !data?.user?.id || !allowlist.has(userEmail)) return null;
  return { id: data.user.id, email: userEmail, supabase };
}

export async function requestAdminLink(address, req, {
  env = process.env,
  createSupabaseClient = createClient,
} = {}) {
  const cleanEmail = email(address);
  if (!cleanEmail) throw new Error('Enter a valid operator email.');
  if (linkRateLimited(req, cleanEmail)) throw new Error('Please wait before requesting another sign-in link.');
  const allowlist = allowedEmails(env);
  if (!allowlist.size) throw new Error('Admin allowlist is not configured.');
  if (!allowlist.has(cleanEmail)) return { sent: true };
  const supabase = serverClient(env, createSupabaseClient);
  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: false, emailRedirectTo: redirectUrl(req) },
  });
  if (error) throw new Error('The sign-in email could not be sent.');
  return { sent: true };
}

export async function listAdminSubmissions(supabase) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function updateAdminSubmission(supabase, input) {
  const reference = text(input.reference, 40).toUpperCase();
  const status = text(input.status, 40);
  if (!/^(EMP|STU|CALL|UNI)-[A-Z0-9]{6,20}$/.test(reference) || !ADMIN_STATUSES.has(status)) {
    throw new Error('Choose a valid submission and status.');
  }
  const { data, error } = await supabase
    .from('submissions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('reference', reference)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });

  try {
    if (req.method === 'POST') {
      const input = body(req);
      if (input.action !== 'request-link') return res.status(400).json({ ok: false, error: 'Unknown action.' });
      await requestAdminLink(input.email, req, dependencies);
      return res.status(200).json({ ok: true, message: 'If this address is authorized, a sign-in link is on its way.' });
    }

    if (!['GET', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }

    const admin = await authorizeAdmin(req, dependencies);
    if (!admin) return res.status(401).json({ ok: false, error: 'Operator authentication is required.' });

    if (req.method === 'GET') {
      const submissions = await listAdminSubmissions(admin.supabase);
      return res.status(200).json({ ok: true, operator: { email: admin.email }, submissions });
    }

    const submission = await updateAdminSubmission(admin.supabase, body(req));
    return res.status(200).json({ ok: true, submission });
  } catch (error) {
    const expected = error instanceof SyntaxError || /^(Enter|Choose|Please|Unknown)/.test(error?.message || '');
    if (!expected) console.error('Admin API failed', error);
    return res.status(expected ? 400 : 503).json({ ok: false, error: expected ? error.message : 'The operator inbox is temporarily unavailable.' });
  }
}
