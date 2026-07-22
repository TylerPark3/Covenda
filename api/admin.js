import { createClient } from '@supabase/supabase-js';

import { supabaseConfiguration } from './submissions.js';

const ADMIN_STATUSES = new Set(['received', 'reviewing', 'needs_information', 'packet_proposed', 'approval_pending', 'approved', 'declined', 'archived']);
const REQUEST_STATUSES = new Set(['submitted', 'in_packaging', 'packaged', 'declined', 'closed']);
const VERTICALS = new Set(['Accounting & finance', 'Software & AI', 'Healthcare operations', 'Consumer & retail', 'Professional services', 'Not sure yet — show me everything']);
const WORK_TYPES = new Set(['Research', 'Data & spreadsheets', 'Operations', 'QA & testing', 'Writing & documentation']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const linkBuckets = new Map();

export class AdminOperationalError extends Error {
  constructor(code, publicMessage, cause = null) {
    super(publicMessage, cause ? { cause } : undefined);
    this.name = 'AdminOperationalError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

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
  const hasUrl = Boolean(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSecret = Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasUrl) {
    throw new AdminOperationalError(
      'ADMIN_SUPABASE_URL_MISSING',
      'The admin inbox is missing its Supabase project URL. Confirm SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in Vercel, then redeploy.',
    );
  }
  if (!hasSecret) {
    throw new AdminOperationalError(
      'ADMIN_SUPABASE_SECRET_MISSING',
      'The admin inbox is missing its server-only Supabase key. Confirm SUPABASE_SECRET_KEY in Vercel, then redeploy.',
    );
  }
  const configuration = supabaseConfiguration(env);
  return createSupabaseClient(configuration.url, configuration.secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function passwordlessClient(env, createSupabaseClient) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY
    || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || env.SUPABASE_ANON_KEY
    || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) {
    throw new AdminOperationalError(
      'ADMIN_SUPABASE_URL_MISSING',
      'Magic-link login is missing its Supabase project URL. Confirm SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in Vercel, then redeploy.',
    );
  }
  if (!publishableKey) {
    throw new AdminOperationalError(
      'ADMIN_SUPABASE_PUBLISHABLE_KEY_MISSING',
      'Magic-link login is missing its Supabase publishable key. Confirm SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.',
    );
  }
  return createSupabaseClient(url, publishableKey, {
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

export function adminRedirectUrl(req, env = process.env) {
  const configured = text(env.COVENDA_ADMIN_URL || env.COVENDA_APP_URL || env.COVENDA_SITE_URL, 500);
  if (configured) {
    let url;
    try { url = new URL(configured); } catch { throw new AdminOperationalError('ADMIN_REDIRECT_URL_INVALID', 'COVENDA_APP_URL and COVENDA_ADMIN_URL must be complete https:// URLs.'); }
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if ((url.protocol !== 'https:' && !local) || url.username || url.password) {
      throw new AdminOperationalError('ADMIN_REDIRECT_URL_INVALID', 'COVENDA_APP_URL and COVENDA_ADMIN_URL must be complete https:// URLs.');
    }
    url.pathname = '/admin.html'; url.search = ''; url.hash = '';
    return url.toString();
  }
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

function magicLinkOperationalError(error) {
  const authCode = text(error?.code, 120);
  if (authCode === 'otp_disabled') {
    return new AdminOperationalError(
      'ADMIN_MAGIC_LINK_OTP_DISABLED',
      'The connected Supabase project rejected email OTP sign-in. Confirm this operator exists in the same Supabase project connected to Vercel and that Email sign-in is enabled there.',
      error,
    );
  }
  if (authCode === 'over_email_send_rate_limit' || authCode === 'over_request_rate_limit') {
    return new AdminOperationalError(
      'ADMIN_MAGIC_LINK_RATE_LIMITED',
      'Supabase temporarily rate-limited sign-in emails. Wait before requesting another link, or configure custom SMTP for production delivery.',
      error,
    );
  }
  if (authCode === 'email_address_not_authorized') {
    return new AdminOperationalError(
      'ADMIN_MAGIC_LINK_EMAIL_UNAUTHORIZED',
      'Supabase\'s default email service is not authorized to send to this address. Add the address to the Supabase organization team or configure custom SMTP.',
      error,
    );
  }
  if (authCode === 'email_provider_disabled') {
    return new AdminOperationalError(
      'ADMIN_MAGIC_LINK_EMAIL_DISABLED',
      'Email authentication is disabled in the Supabase project connected to Vercel. Enable the Email provider, then try again.',
      error,
    );
  }
  return new AdminOperationalError(
    'ADMIN_MAGIC_LINK_FAILED',
    'Supabase could not send the sign-in link. Confirm the operator exists in the same Supabase project connected to Vercel, then check that project\'s Auth logs for the latest /otp error.',
    error,
  );
}

export async function authorizeAdmin(req, {
  env = process.env,
  createSupabaseClient = createClient,
} = {}) {
  const token = bearerToken(req);
  if (!token) return null;
  const allowlist = allowedEmails(env);
  if (!allowlist.size) {
    throw new AdminOperationalError(
      'ADMIN_ALLOWLIST_MISSING',
      'Admin access is not configured for this deployment. Add a non-empty COVENDA_ADMIN_EMAILS value in Vercel, then redeploy.',
    );
  }
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
  if (!allowlist.size) {
    throw new AdminOperationalError(
      'ADMIN_ALLOWLIST_MISSING',
      'Admin access is not configured for this deployment. Add a non-empty COVENDA_ADMIN_EMAILS value in Vercel, then redeploy.',
    );
  }
  if (!allowlist.has(cleanEmail)) return { accepted: true, delivery: 'suppressed' };
  const supabase = passwordlessClient(env, createSupabaseClient);
  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: false, emailRedirectTo: adminRedirectUrl(req, env) },
  });
  if (error) {
    throw magicLinkOperationalError(error);
  }
  return { accepted: true, delivery: 'requested' };
}

function adminRequestId(req) {
  const vercelId = text(req.headers['x-vercel-id'], 200);
  if (vercelId) return vercelId.split('::').at(-1).slice(0, 80);
  return `local-${Date.now().toString(36)}`;
}

function logAdminLinkRequest(req, result, requestId, startedAt) {
  console.info(JSON.stringify({
    level: 'info',
    message: 'Admin sign-in request handled',
    route: '/api/admin',
    method: req.method,
    requestId,
    code: result.delivery === 'requested' ? 'ADMIN_LINK_REQUESTED' : 'ADMIN_LINK_SUPPRESSED',
    durationMs: Date.now() - startedAt,
  }));
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

export async function listAdminProjectRequests(supabase) {
  const { data, error } = await supabase
    .from('project_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function list(value, maxItems = 20, allowed = null) {
  const values = Array.isArray(value) ? value : text(value, 1_000).split(',');
  return [...new Set(values.map(item => text(item, 80)).filter(item => item && (!allowed || allowed.has(item))))].slice(0, maxItems);
}

function cleanPacket(value = {}) {
  const packet = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    title: text(packet.title, 160),
    summary: text(packet.summary, 5_000),
    deliverable: text(packet.deliverable, 2_000),
    acceptanceCriteria: text(packet.acceptanceCriteria, 4_000),
    safeInputs: text(packet.safeInputs, 4_000),
    credits: Math.max(0, Math.min(100_000, Math.round(Number(packet.credits) || 0))),
    verticals: list(packet.verticals, 8, VERTICALS),
    workTypes: list(packet.workTypes, 8, WORK_TYPES),
    desiredSkills: list(packet.desiredSkills),
    targetDate: /^\d{4}-\d{2}-\d{2}$/.test(packet.targetDate || '') ? packet.targetDate : null,
  };
}

async function requestById(supabase, requestId) {
  const id = text(requestId, 50);
  if (!UUID.test(id)) throw new Error('Choose a valid project request.');
  const { data, error } = await supabase.from('project_requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Choose a project request that still exists.');
  return data;
}

export async function saveProjectRequestPackaging(supabase, input, operatorEmail = '') {
  const request = await requestById(supabase, input.requestId);
  if (!['submitted', 'in_packaging'].includes(request.status)) throw new Error('Choose a request that is still being packaged.');
  const changes = {
    status: 'in_packaging',
    packet_draft: cleanPacket(input.packet),
    updated_at: new Date().toISOString(),
  };
  if (Object.hasOwn(input, 'operatorNote')) changes.operator_note = text(input.operatorNote, 2_000) || null;
  const { data, error } = await supabase.from('project_requests').update(changes).eq('id', request.id).select('*').single();
  if (error) throw error;
  return data;
}

export async function declineProjectRequest(supabase, input) {
  const request = await requestById(supabase, input.requestId);
  if (!['submitted', 'in_packaging'].includes(request.status)) throw new Error('Choose a request that is still being packaged.');
  const reason = text(input.reason, 2_000);
  if (reason.length < 10) throw new Error('Enter a clear decline reason for the requester.');
  const { data, error } = await supabase.from('project_requests').update({ status: 'declined', operator_note: reason, updated_at: new Date().toISOString() }).eq('id', request.id).select('*').single();
  if (error) throw error;
  return data;
}

export async function publishProjectRequest(supabase, input, operatorEmail = '') {
  const request = await requestById(supabase, input.requestId);
  if (!['submitted', 'in_packaging', 'packaged'].includes(request.status)) throw new Error('Choose a request that can be published.');
  const packet = cleanPacket(input.packet);
  if (packet.title.length < 3) throw new Error('Enter a packet title.');
  if (packet.summary.length < 10) throw new Error('Enter a packet summary.');
  if (packet.deliverable.length < 10) throw new Error('Define the useful deliverable.');
  if (packet.acceptanceCriteria.length < 10) throw new Error('Define fair acceptance criteria.');
  if (packet.safeInputs.length < 10) throw new Error('Define the safe inputs students may use.');
  if (packet.credits < 1) throw new Error('Choose a positive student credit amount.');
  const safety = input.safety && typeof input.safety === 'object' ? input.safety : {};
  const requiredChecks = ['clientRecords', 'pii', 'productionAccess', 'regulatedDecisions'];
  if (!requiredChecks.every(key => safety[key] === false)) {
    throw new Error('Clear every safety boundary before publishing this packet.');
  }
  const { data, error } = await supabase.rpc('publish_project_request', {
    p_request_id: request.id,
    p_operator_email: email(operatorEmail) || 'Covenda operator',
    p_title: packet.title,
    p_summary: packet.summary,
    p_deliverable: packet.deliverable,
    p_acceptance_criteria: packet.acceptanceCriteria,
    p_safe_inputs: packet.safeInputs,
    p_credits: packet.credits,
    p_verticals: packet.verticals,
    p_work_types: packet.workTypes,
    p_desired_skills: packet.desiredSkills,
    p_target_date: packet.targetDate,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function updateAdminSubmission(supabase, input, operatorEmail = '') {
  const reference = text(input.reference, 40).toUpperCase();
  if (!/^(EMP|STU|CALL|UNI)-[A-Z0-9]{6,20}$/.test(reference)) {
    throw new Error('Choose a valid submission.');
  }

  const changes = {};
  if (Object.hasOwn(input, 'status')) {
    const status = text(input.status, 40);
    if (!ADMIN_STATUSES.has(status)) throw new Error('Choose a valid submission status.');
    changes.status = status;
  }
  if (Object.hasOwn(input, 'internal_note')) {
    if (typeof input.internal_note !== 'string') throw new Error('Enter a valid internal note.');
    const internalNote = text(input.internal_note, 2_001);
    if (internalNote.length > 2_000) throw new Error('Keep the internal note under 2,000 characters.');
    changes.internal_note = internalNote;
  }
  if (Object.hasOwn(input, 'follow_up_at')) {
    if (input.follow_up_at === null || input.follow_up_at === '') {
      changes.follow_up_at = null;
    } else {
      const followUp = new Date(input.follow_up_at);
      if (Number.isNaN(followUp.getTime())) throw new Error('Choose a valid follow-up date and time.');
      changes.follow_up_at = followUp.toISOString();
    }
  }
  if (!Object.keys(changes).length) throw new Error('Choose a workflow change to save.');

  const reviewer = email(operatorEmail);
  if (reviewer) changes.reviewed_by = reviewer;
  changes.reviewed_at = new Date().toISOString();
  changes.updated_at = changes.reviewed_at;

  const { data, error } = await supabase
    .from('submissions')
    .update(changes)
    .eq('reference', reference)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

function adminFailure(error) {
  if (error instanceof AdminOperationalError) {
    return { status: 503, code: error.code, message: error.publicMessage };
  }
  const internalMessage = text(error?.message, 2_000);
  if (/submissions|project_requests|member_projects|credit_ledger|publish_project_request|schema cache|permission denied|relation .* does not exist/i.test(internalMessage)) {
    return {
      status: 503,
      code: 'ADMIN_SUBMISSIONS_UNAVAILABLE',
      message: 'The admin login worked, but the Covenda workflow tables are unavailable. Apply the newest pending Supabase migrations and confirm Vercel points to that same project.',
    };
  }
  return { status: 503, code: 'ADMIN_UNAVAILABLE', message: 'The operator inbox is temporarily unavailable. Check the newest /api/admin error in Vercel Runtime Logs.' };
}

function logAdminFailure(req, error, failure, startedAt) {
  console.error(JSON.stringify({
    level: 'error',
    message: 'Admin API failed',
    route: '/api/admin',
    method: req.method,
    requestId: text(req.headers['x-vercel-id'], 200) || null,
    code: failure.code,
    error: text(error?.cause?.message || error?.message || error, 2_000),
    durationMs: Date.now() - startedAt,
  }));
}

export default async function handler(req, res, dependencies = {}) {
  const startedAt = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });

  try {
    if (req.method === 'POST' && body(req).action === 'request-link') {
      const input = body(req);
      const result = await requestAdminLink(input.email, req, dependencies);
      const requestId = adminRequestId(req);
      logAdminLinkRequest(req, result, requestId, startedAt);
      return res.status(200).json({
        ok: true,
        requestId,
        message: 'If this address is authorized, a sign-in link is on its way.',
      });
    }

    if (!['GET', 'PATCH', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }

    const admin = await authorizeAdmin(req, dependencies);
    if (!admin) return res.status(401).json({ ok: false, error: 'Operator authentication is required.' });

    if (req.method === 'GET') {
      const [submissions, projectRequests] = await Promise.all([
        listAdminSubmissions(admin.supabase),
        listAdminProjectRequests(admin.supabase),
      ]);
      return res.status(200).json({ ok: true, operator: { email: admin.email }, submissions, projectRequests });
    }

    const input = body(req);
    if (req.method === 'PATCH') {
      const submission = await updateAdminSubmission(admin.supabase, input, admin.email);
      return res.status(200).json({ ok: true, submission });
    }
    if (input.action === 'save-packaging') return res.status(200).json({ ok: true, request: await saveProjectRequestPackaging(admin.supabase, input, admin.email) });
    if (input.action === 'decline-request') return res.status(200).json({ ok: true, request: await declineProjectRequest(admin.supabase, input) });
    if (input.action === 'publish-request') return res.status(200).json({ ok: true, project: await publishProjectRequest(admin.supabase, input, admin.email) });
    return res.status(400).json({ ok: false, error: 'Unknown action.' });
  } catch (error) {
    const expected = error instanceof SyntaxError || /^(Enter|Choose|Keep|Please|Unknown|Define|Clear|The requester)/.test(error?.message || '');
    if (expected) return res.status(400).json({ ok: false, code: 'ADMIN_INPUT_INVALID', error: error.message });
    const failure = adminFailure(error);
    logAdminFailure(req, error, failure, startedAt);
    return res.status(failure.status).json({ ok: false, code: failure.code, error: failure.message });
  }
}
