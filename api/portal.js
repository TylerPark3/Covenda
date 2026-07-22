import { createClient } from '@supabase/supabase-js';

import { supabaseConfiguration } from './submissions.js';

const MEMBER_ROLES = new Set(['student', 'company', 'university']);
const PROJECT_VISIBILITY = new Set(['private', 'members', 'open']);
// Fixed taxonomies shared with the marketing site (BATCHES industries + work types).
// The vertical project-matcher reads these exact strings, so onboarding must write them verbatim.
export const VERTICALS = new Set(['Accounting & finance', 'Software & AI', 'Healthcare operations', 'Consumer & retail', 'Professional services', 'Not sure yet — show me everything']);
export const WORK_TYPES = new Set(['Research', 'Data & spreadsheets', 'Operations', 'QA & testing', 'Writing & documentation']);
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

// Keep only values that exactly match a fixed taxonomy (verticals / work types).
function cleanTaxonomy(value, allowed, maxItems = 8) {
  return cleanList(value, maxItems).filter(item => allowed.has(item));
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
  if (!profile) return { user, profile: null, projects: [], opportunities: [], applications: [], studentDirectory: [], intakes, messages: [], verifiedCount: 0 };

  if (profile.role === 'student') {
    const [projects, opportunities, applications] = await Promise.all([
      checked(supabase.from('member_projects').select('*').eq('assigned_student_user_id', user.id).order('updated_at', { ascending: false }).limit(50)),
      checked(supabase.from('member_projects').select('*').eq('status', 'open').in('visibility', ['members', 'open']).order('created_at', { ascending: false }).limit(50)),
      checked(supabase.from('project_applications').select('*').eq('student_user_id', user.id).order('updated_at', { ascending: false }).limit(100)),
    ]);
    const projectIds = projects.map(project => project.id);
    const messages = projectIds.length
      ? await checked(supabase.from('project_messages').select('*').in('project_id', projectIds).order('created_at', { ascending: true }).limit(500))
      : [];
    const verifiedCount = projects.filter(project => project.status === 'complete').length;
    const rankedOpportunities = rankOpportunities(opportunities, profile);
    const matchedCount = rankedOpportunities.filter(project => project.matched).length;
    return { user, profile, projects, opportunities: rankedOpportunities, applications, studentDirectory: [], intakes, messages, verifiedCount, matchedCount };
  }

  const projects = await checked(supabase.from('member_projects').select('*').eq('owner_user_id', user.id).order('updated_at', { ascending: false }).limit(100));
  const projectIds = projects.map(project => project.id);
  const applications = projectIds.length
    ? await checked(supabase.from('project_applications').select('*').in('project_id', projectIds).order('updated_at', { ascending: false }).limit(200))
    : [];
  const studentDirectory = profile.role === 'company'
    ? await checked(supabase.from('member_profiles').select('user_id,display_name,school_name,headline,bio,skills,graduation_year,updated_at').eq('role', 'student').eq('portfolio_visibility', 'members').order('updated_at', { ascending: false }).limit(100))
    : [];
  const messages = projectIds.length
    ? await checked(supabase.from('project_messages').select('*').in('project_id', projectIds).order('created_at', { ascending: true }).limit(500))
    : [];
  const verifiedCount = projects.filter(project => project.status === 'complete').length;
  return { user, profile, projects, opportunities: [], applications, studentDirectory, intakes, messages, verifiedCount };
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
  // Additive onboarding/matching fields — only written when the caller supplies them,
  // so the existing profile modal keeps saving even before the migration is applied.
  if (input.verticals !== undefined) row.verticals = cleanTaxonomy(input.verticals, VERTICALS);
  if (input.workTypes !== undefined) row.work_types = cleanTaxonomy(input.workTypes, WORK_TYPES);
  if (input.avatarUrl !== undefined) row.avatar_url = cleanText(input.avatarUrl, 500) || null;
  return checked(supabase.from('member_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single(), null);
}

function cleanAttachments(value) {
  return (Array.isArray(value) ? value : []).slice(0, 6).map(item => ({
    name: cleanText(item?.name, 120),
    blobUrl: /^https:\/\//i.test(item?.blobUrl || '') ? cleanText(item.blobUrl, 600) : '',
    contentType: cleanText(item?.contentType, 100),
    sizeBytes: Number.isFinite(item?.sizeBytes) ? Math.max(0, Math.min(item.sizeBytes, 50_000_000)) : 0,
  })).filter(item => item.blobUrl);
}

// The AI brief originates from our own intake endpoint, but the client could tamper with
// it, so re-bound every field and re-whitelist the taxonomy before it is stored.
function sanitizeBrief(brief) {
  const list = (value, max) => (Array.isArray(value) ? value.map(item => cleanText(item, 300)).filter(Boolean).slice(0, max) : []);
  return {
    summary: cleanText(brief.summary, 1_200),
    structuredProblem: cleanText(brief.structuredProblem, 3_000),
    candidateDeliverables: list(brief.candidateDeliverables, 5),
    suggestedVerticals: cleanTaxonomy(brief.suggestedVerticals, VERTICALS),
    suggestedWorkTypes: cleanTaxonomy(brief.suggestedWorkTypes, WORK_TYPES),
    safetyFlags: list(brief.safetyFlags, 8),
    safeToPost: brief.safeToPost === true,
  };
}

// Rank open opportunities so ones matching the student's verticals/work types come
// first, each tagged `matched` for the "Matched to your vertical" badge. A student who
// picked "Not sure yet — show me everything" matches every vertical.
export function rankOpportunities(opportunities, profile) {
  const profileVerticals = new Set(profile?.verticals || []);
  const profileWorkTypes = new Set(profile?.work_types || []);
  const everything = profileVerticals.has('Not sure yet — show me everything');
  const isMatch = project => {
    const verticals = project.verticals || [];
    const workTypes = project.work_types || [];
    const verticalMatch = everything || verticals.some(value => profileVerticals.has(value));
    const workTypeMatch = workTypes.some(value => profileWorkTypes.has(value));
    return Boolean((verticals.length && verticalMatch) || (workTypes.length && workTypeMatch));
  };
  return (opportunities || [])
    .map(project => ({ ...project, matched: isMatch(project) }))
    .sort((a, b) => Number(b.matched) - Number(a.matched));
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
  // Additive intake/targeting fields — only written when supplied, so the simple project
  // modal keeps working even before the targeting migration is applied.
  if (input.verticals !== undefined) row.verticals = cleanTaxonomy(input.verticals, VERTICALS);
  if (input.workTypes !== undefined) row.work_types = cleanTaxonomy(input.workTypes, WORK_TYPES);
  if (input.problemText !== undefined) row.problem_text = cleanText(input.problemText, 8_000) || null;
  if (input.consultBooked !== undefined) row.consult_booked = input.consultBooked === true;
  if (input.budgetCents !== undefined) row.budget_cents = Number.isFinite(input.budgetCents) ? Math.max(0, Math.min(Math.round(input.budgetCents), 100_000_00)) : null;
  if (input.attachments !== undefined) row.attachments = cleanAttachments(input.attachments);
  if (input.aiBrief && typeof input.aiBrief === 'object') row.ai_brief = sanitizeBrief(input.aiBrief);
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

export async function sendProjectMessage(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) throw new Error('Choose a valid project conversation.');
  const body = cleanText(input.message, 4_000);
  if (!body) throw new Error('Enter a message before sending.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,assigned_student_user_id').eq('id', projectId).maybeSingle(),
    null,
  );
  const hasAccess = project && (project.owner_user_id === member.user.id || project.assigned_student_user_id === member.user.id);
  if (!hasAccess) throw new Error('This project conversation is not available to your account.');
  const row = { project_id: projectId, author_user_id: member.user.id, body };
  return checked(member.supabase.from('project_messages').insert(row).select('*').single(), null);
}

const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

// Close-the-loop transitions. Every one re-reads the project and verifies the caller
// is the owner (company/university) or the assigned student before writing, and
// enforces the status state-machine server-side so no step can be skipped or replayed.

export async function acceptApplication(member, input) {
  const applicationId = cleanText(input.applicationId, 50);
  if (!PROJECT_ID_PATTERN.test(applicationId)) throw new Error('Choose a valid application.');
  const application = await checked(
    member.supabase.from('project_applications').select('id,project_id,student_user_id,status').eq('id', applicationId).maybeSingle(),
    null,
  );
  if (!application) throw new Error('This application is no longer available.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,status').eq('id', application.project_id).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can accept an applicant.');
  if (!['open', 'matched'].includes(project.status)) throw new Error('This project is not open for accepting an applicant.');
  const now = new Date().toISOString();
  const accepted = await checked(
    member.supabase.from('project_applications').update({ status: 'accepted', updated_at: now }).eq('id', applicationId).select('*').single(),
    null,
  );
  // Assign the student and move the project into progress.
  await checked(
    member.supabase.from('member_projects').update({ assigned_student_user_id: application.student_user_id, status: 'in_progress', updated_at: now }).eq('id', project.id).select('id').single(),
    null,
  );
  // Decline the remaining live applications so the pipeline is unambiguous (leave withdrawn ones as-is).
  await checked(
    member.supabase.from('project_applications').update({ status: 'declined', updated_at: now }).eq('project_id', project.id).neq('id', applicationId).neq('status', 'withdrawn').select('id'),
    [],
  );
  return accepted;
}

export async function submitDeliverable(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const summary = cleanText(input.deliverable, 4_000);
  if (summary.length < 10) throw new Error('Describe your work in at least 10 characters.');
  const rawLinks = Array.isArray(input.deliverableLinks) ? input.deliverableLinks : cleanText(input.deliverableLinks, 2_000).split(/[\n,]/);
  const links = [...new Set(rawLinks.map(link => cleanText(link, 500)).filter(link => /^https?:\/\//i.test(link)))].slice(0, 10);
  const project = await checked(
    member.supabase.from('member_projects').select('id,assigned_student_user_id,status').eq('id', projectId).maybeSingle(),
    null,
  );
  if (!project || project.assigned_student_user_id !== member.user.id) throw new Error('Only the assigned student can submit work for this project.');
  if (!['in_progress', 'review'].includes(project.status)) throw new Error('This project is not ready for a deliverable yet.');
  const body = links.length ? `${summary}\n\nLinks:\n${links.map(link => `- ${link}`).join('\n')}` : summary;
  const now = new Date().toISOString();
  // Clear any prior revision note so a stale "changes requested" message does not linger after resubmission.
  return checked(
    member.supabase.from('member_projects').update({ deliverable: body, status: 'review', deliverable_submitted_at: now, review_note: null, updated_at: now }).eq('id', projectId).select('*').single(),
    null,
  );
}

export async function reviewDeliverable(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const decision = input.decision === 'accept' ? 'accept' : input.decision === 'revise' ? 'revise' : '';
  if (!decision) throw new Error('Choose accept or request changes.');
  const note = cleanText(input.note, 2_000);
  if (decision === 'revise' && !note) throw new Error('Add a note so the student knows what to revise.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,status').eq('id', projectId).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can review a deliverable.');
  if (project.status !== 'review') throw new Error('This project has no submitted deliverable to review.');
  const now = new Date().toISOString();
  const patch = decision === 'accept'
    ? { status: 'complete', completed_at: now, review_note: note || null, updated_at: now }
    : { status: 'in_progress', review_note: note, updated_at: now };
  return checked(member.supabase.from('member_projects').update(patch).eq('id', projectId).select('*').single(), null);
}

function portalFailure(error) {
  if (error instanceof PortalOperationalError) return { status: 503, code: error.code, message: error.publicMessage };
  const message = cleanText(error?.message, 2_000);
  if (/member_profiles|member_projects|project_applications|project_messages|submissions|schema cache|relation .* does not exist/i.test(message)) {
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
    if (req.method === 'POST' && input.action === 'send-message') return res.status(201).json({ ok: true, message: await sendProjectMessage(member, input) });
    if (req.method === 'POST' && input.action === 'accept-application') return res.status(200).json({ ok: true, application: await acceptApplication(member, input) });
    if (req.method === 'POST' && input.action === 'submit-deliverable') return res.status(200).json({ ok: true, project: await submitDeliverable(member, input) });
    if (req.method === 'POST' && input.action === 'review-deliverable') return res.status(200).json({ ok: true, project: await reviewDeliverable(member, input) });
    return res.status(400).json({ ok: false, error: 'Unknown portal action.' });
  } catch (error) {
    const expected = error instanceof SyntaxError || /^(Enter|Choose|Only|Account|This|Please|Add|Describe|A refresh)/.test(error?.message || '');
    if (expected) return res.status(400).json({ ok: false, code: 'PORTAL_INPUT_INVALID', error: error.message });
    const failure = portalFailure(error);
    console.error(JSON.stringify({ level: 'error', message: 'Portal API failed', route: '/api/portal', method: req.method, requestId: cleanText(req.headers['x-vercel-id'], 200) || null, code: failure.code, error: cleanText(error?.cause?.message || error?.message || error, 2_000), durationMs: Date.now() - startedAt }));
    return res.status(failure.status).json({ ok: false, code: failure.code, error: failure.message });
  }
}
