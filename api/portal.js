import { createClient } from '@supabase/supabase-js';

import { supabaseConfiguration } from './submissions.js';

const MEMBER_ROLES = new Set(['student', 'company', 'university']);
const PROJECT_VISIBILITY = new Set(['private', 'members', 'open']);
const emailBuckets = new Map();

export class PortalOperationalError extends Error {
  constructor(code, publicMessage, cause = null) {
    super(publicMessage, cause ? { cause } : undefined);
    this.name = 'PortalOperationalError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\0/g, '').trim().slice(0, maxLength) : '';
}

function cleanEmail(value) {
  const result = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : '';
}

function cleanList(value, maxItems = 20) {
  const items = Array.isArray(value) ? value : cleanText(value, 1_000).split(',');
  return [...new Set(items.map(item => cleanText(item, 80)).filter(Boolean))].slice(0, maxItems);
}

function parseBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  return req.body || {};
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

function portalRedirectUrl(req) {
  const host = cleanText(req.headers['x-forwarded-host'] || req.headers.host, 300);
  const protocol = cleanText(req.headers['x-forwarded-proto'], 10) || (host.startsWith('localhost') ? 'http' : 'https');
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) throw new Error('Invalid redirect host.');
  return `${protocol}://${host}/portal.html`;
}

function publicConfiguration(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new PortalOperationalError(
      'PORTAL_AUTH_NOT_CONFIGURED',
      'Member sign-in is not configured for this deployment. Confirm the Supabase URL and publishable key in Vercel, then redeploy.',
    );
  }
  return { url, key };
}

function publicClient(env, createSupabaseClient) {
  const { url, key } = publicConfiguration(env);
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function serviceClient(env, createSupabaseClient) {
  try {
    const configuration = supabaseConfiguration(env);
    return createSupabaseClient(configuration.url, configuration.secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  } catch (error) {
    throw new PortalOperationalError(
      'PORTAL_DATABASE_NOT_CONFIGURED',
      'The member portal is missing its server-only Supabase configuration. Confirm SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel, then redeploy.',
      error,
    );
  }
}

function bearerToken(req) {
  return /^Bearer\s+(.+)$/i.exec(cleanText(req.headers.authorization, 8_000))?.[1] || '';
}

function rateLimited(req, address) {
  const now = Date.now();
  const ip = cleanText(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown', 200).split(',')[0].trim();
  const key = `${ip}:${address}`;
  const recent = (emailBuckets.get(key) || []).filter(timestamp => now - timestamp < 10 * 60_000);
  recent.push(now);
  emailBuckets.set(key, recent);
  return recent.length > 4;
}

export async function requestMemberLink(address, req, { env = process.env, createSupabaseClient = createClient } = {}) {
  const email = cleanEmail(address);
  if (!email) throw new Error('Enter a valid email address.');
  if (rateLimited(req, email)) throw new Error('Please wait before requesting another sign-in link.');
  const supabase = publicClient(env, createSupabaseClient);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: portalRedirectUrl(req) },
  });
  if (error) throw new PortalOperationalError('PORTAL_EMAIL_FAILED', 'Supabase could not send the sign-in link. Check the Auth logs and custom SMTP configuration.', error);
  return { accepted: true };
}

export async function requestGoogleLogin(req, { env = process.env, createSupabaseClient = createClient } = {}) {
  const supabase = publicClient(env, createSupabaseClient);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: portalRedirectUrl(req), skipBrowserRedirect: true },
  });
  if (error || !data?.url) throw new PortalOperationalError('PORTAL_GOOGLE_FAILED', 'Google sign-in could not start. Confirm the Google provider and redirect URLs in Supabase Auth.', error);
  return { url: data.url };
}

export async function memberAuthReadiness({ env = process.env, fetchImpl = fetch } = {}) {
  const { url, key } = publicConfiguration(env);
  try {
    const response = await fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return { googleConfigured: null };
    const settings = await response.json();
    return { googleConfigured: settings?.external?.google === true };
  } catch {
    return { googleConfigured: null };
  }
}

async function refreshSession(refreshToken, { env = process.env, createSupabaseClient = createClient } = {}) {
  const token = cleanText(refreshToken, 8_000);
  if (!token) throw new Error('A refresh token is required.');
  const supabase = publicClient(env, createSupabaseClient);
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: token });
  if (error || !data?.session?.access_token) throw new Error('Your session has ended. Sign in again.');
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  };
}

export async function authorizeMember(req, dependencies = {}) {
  const token = bearerToken(req);
  if (!token) return null;
  const supabase = serviceClient(dependencies.env || process.env, dependencies.createSupabaseClient || createClient);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { user: { id: data.user.id, email: cleanEmail(data.user.email), metadata: data.user.user_metadata || {} }, supabase };
}

async function checked(query, fallback = []) {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? fallback;
}

export async function loadMemberIntakes(member) {
  if (!member.user.email) return [];
  return checked(
    member.supabase
      .from('submissions')
      .select('reference,submission_type,status,summary,organization_name,created_at,updated_at')
      .eq('submitter_email', member.user.email)
      .order('created_at', { ascending: false })
      .limit(100),
  );
}

export async function loadMemberDashboard(member) {
  const { user, supabase } = member;
  const [profile, intakes] = await Promise.all([
    checked(supabase.from('member_profiles').select('*').eq('user_id', user.id).maybeSingle(), null),
    loadMemberIntakes(member),
  ]);
  if (!profile) return { user, profile: null, projects: [], opportunities: [], applications: [], studentDirectory: [], intakes };

  if (profile.role === 'student') {
    const [projects, opportunities, applications] = await Promise.all([
      checked(supabase.from('member_projects').select('*').eq('assigned_student_user_id', user.id).order('updated_at', { ascending: false }).limit(50)),
      checked(supabase.from('member_projects').select('*').eq('status', 'open').in('visibility', ['members', 'open']).order('created_at', { ascending: false }).limit(50)),
      checked(supabase.from('project_applications').select('*').eq('student_user_id', user.id).order('updated_at', { ascending: false }).limit(100)),
    ]);
    return { user, profile, projects, opportunities, applications, studentDirectory: [], intakes };
  }

  const projects = await checked(supabase.from('member_projects').select('*').eq('owner_user_id', user.id).order('updated_at', { ascending: false }).limit(100));
  const projectIds = projects.map(project => project.id);
  const applications = projectIds.length
    ? await checked(supabase.from('project_applications').select('*').in('project_id', projectIds).order('updated_at', { ascending: false }).limit(200))
    : [];
  const studentDirectory = profile.role === 'company'
    ? await checked(supabase.from('member_profiles').select('user_id,display_name,school_name,headline,bio,skills,graduation_year,updated_at').eq('role', 'student').eq('portfolio_visibility', 'members').order('updated_at', { ascending: false }).limit(100))
    : [];
  return { user, profile, projects, opportunities: [], applications, studentDirectory, intakes };
}

export async function saveMemberProfile(member, input) {
  const { user, supabase } = member;
  const role = cleanText(input.role, 20);
  if (!MEMBER_ROLES.has(role)) throw new Error('Choose Student, Company, or University.');
  const displayName = cleanText(input.displayName, 120);
  if (!displayName) throw new Error('Enter your name.');

  const existing = await checked(supabase.from('member_profiles').select('role').eq('user_id', user.id).maybeSingle(), null);
  if (existing?.role && existing.role !== role) throw new Error('Account roles cannot be changed from this screen. Contact Covenda support.');
  const graduationYear = input.graduationYear ? Number(input.graduationYear) : null;
  if (graduationYear && (!Number.isInteger(graduationYear) || graduationYear < 2020 || graduationYear > 2100)) throw new Error('Enter a valid graduation year.');

  const row = {
    user_id: user.id,
    role,
    display_name: displayName,
    organization_name: cleanText(input.organizationName, 160) || null,
    school_name: cleanText(input.schoolName, 160) || null,
    headline: cleanText(input.headline, 180) || null,
    bio: cleanText(input.bio, 2_000) || null,
    skills: cleanList(input.skills),
    graduation_year: graduationYear,
    portfolio_visibility: input.portfolioVisibility === 'private' ? 'private' : 'members',
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  };
  return checked(supabase.from('member_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single(), null);
}

export async function createMemberProject(member, input) {
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (!profile || !['company', 'university'].includes(profile.role)) throw new Error('Only company and university accounts can create projects.');
  const title = cleanText(input.title, 160);
  const summary = cleanText(input.summary, 5_000);
  if (title.length < 3) throw new Error('Enter a project title.');
  if (summary.length < 10) throw new Error('Describe the project in at least 10 characters.');
  const visibility = PROJECT_VISIBILITY.has(input.visibility) ? input.visibility : 'private';
  const row = {
    owner_user_id: member.user.id,
    title,
    summary,
    deliverable: cleanText(input.deliverable, 2_000) || null,
    status: visibility === 'private' ? 'draft' : 'open',
    visibility,
    desired_skills: cleanList(input.desiredSkills),
    target_date: /^\d{4}-\d{2}-\d{2}$/.test(input.targetDate || '') ? input.targetDate : null,
    updated_at: new Date().toISOString(),
  };
  return checked(member.supabase.from('member_projects').insert(row).select('*').single(), null);
}

export async function applyToProject(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) throw new Error('Choose a valid project.');
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'student') throw new Error('Only student accounts can apply to projects.');
  const project = await checked(member.supabase.from('member_projects').select('id,status,visibility').eq('id', projectId).maybeSingle(), null);
  if (!project || project.status !== 'open' || !['members', 'open'].includes(project.visibility)) throw new Error('This project is not accepting applications.');
  const existing = await checked(
    member.supabase.from('project_applications').select('*').eq('project_id', projectId).eq('student_user_id', member.user.id).maybeSingle(),
    null,
  );
  if (existing) return existing;
  const row = { project_id: projectId, student_user_id: member.user.id, note: cleanText(input.note, 2_000) || null, updated_at: new Date().toISOString() };
  return checked(member.supabase.from('project_applications').insert(row).select('*').single(), null);
}

function portalFailure(error) {
  if (error instanceof PortalOperationalError) return { status: 503, code: error.code, message: error.publicMessage };
  const message = cleanText(error?.message, 2_000);
  if (/member_profiles|member_projects|project_applications|submissions|schema cache|relation .* does not exist/i.test(message)) {
    return { status: 503, code: 'PORTAL_SCHEMA_MISSING', message: 'Member sign-in worked, but the portal tables are not available. Apply the newest Supabase migration to the same project used by Vercel.' };
  }
  return { status: 503, code: 'PORTAL_UNAVAILABLE', message: 'The member portal is temporarily unavailable. Check the newest /api/portal entry in Vercel Runtime Logs.' };
}

export default async function handler(req, res, dependencies = {}) {
  const startedAt = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });

  try {
    if (req.method === 'POST') {
      const input = parseBody(req);
      if (input.action === 'request-link') {
        await requestMemberLink(input.email, req, dependencies);
        return res.status(200).json({ ok: true, message: 'Check your inbox for a secure Covenda sign-in link.' });
      }
      if (input.action === 'auth-readiness') return res.status(200).json({ ok: true, ...(await memberAuthReadiness(dependencies)) });
      if (input.action === 'google-login') return res.status(200).json({ ok: true, ...(await requestGoogleLogin(req, dependencies)) });
      if (input.action === 'refresh-session') return res.status(200).json({ ok: true, ...(await refreshSession(input.refreshToken, dependencies)) });
    }

    if (!['GET', 'PATCH', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }
    const member = await authorizeMember(req, dependencies);
    if (!member) return res.status(401).json({ ok: false, error: 'Member authentication is required.' });
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await loadMemberDashboard(member)) });

    const input = parseBody(req);
    if (req.method === 'PATCH' && input.action === 'save-profile') return res.status(200).json({ ok: true, profile: await saveMemberProfile(member, input) });
    if (req.method === 'POST' && input.action === 'create-project') return res.status(201).json({ ok: true, project: await createMemberProject(member, input) });
    if (req.method === 'POST' && input.action === 'apply') return res.status(201).json({ ok: true, application: await applyToProject(member, input) });
    return res.status(400).json({ ok: false, error: 'Unknown portal action.' });
  } catch (error) {
    const expected = error instanceof SyntaxError || /^(Enter|Choose|Only|Account|This|Please|A refresh)/.test(error?.message || '');
    if (expected) return res.status(400).json({ ok: false, code: 'PORTAL_INPUT_INVALID', error: error.message });
    const failure = portalFailure(error);
    console.error(JSON.stringify({ level: 'error', message: 'Portal API failed', route: '/api/portal', method: req.method, requestId: cleanText(req.headers['x-vercel-id'], 200) || null, code: failure.code, error: cleanText(error?.cause?.message || error?.message || error, 2_000), durationMs: Date.now() - startedAt }));
    return res.status(failure.status).json({ ok: false, code: failure.code, error: failure.message });
  }
}
