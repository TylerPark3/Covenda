import { createClient } from '@supabase/supabase-js';

import { supabaseConfiguration } from './submissions.js';
import { sendPartnerDigests } from './digest.js';
import { notifyMember, batchDecisionEmail } from './notify.js';

const ADMIN_STATUSES = new Set(['received', 'reviewing', 'needs_information', 'packet_proposed', 'approval_pending', 'approved', 'declined', 'archived']);
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
    options: { shouldCreateUser: false, emailRedirectTo: redirectUrl(req) },
  });
  if (error) {
    throw magicLinkOperationalError(error);
  }
  return { accepted: true, delivery: 'requested' };
}

// Type-the-code sign-in: immune to email link-scanners that consume single-use magic links.
// Supabase sends the same OTP as both a link and a 6-digit code; verifyOtp exchanges the typed
// code for a session. Server-mediated so the browser needs no Supabase JS (admin CSP is strict).
export async function verifyAdminCode(address, code, {
  env = process.env,
  createSupabaseClient = createClient,
} = {}) {
  const cleanEmail = email(address);
  if (!cleanEmail) throw new Error('Enter a valid operator email.');
  const cleanCode = text(code, 12).replace(/\D/g, '');
  if (cleanCode.length < 6) throw new Error('Enter the 6-digit code from your email.');
  const allowlist = allowedEmails(env);
  if (!allowlist.size) {
    throw new AdminOperationalError(
      'ADMIN_ALLOWLIST_MISSING',
      'Admin access is not configured for this deployment. Add a non-empty COVENDA_ADMIN_EMAILS value in Vercel, then redeploy.',
    );
  }
  const supabase = passwordlessClient(env, createSupabaseClient);
  const { data, error } = await supabase.auth.verifyOtp({ email: cleanEmail, token: cleanCode, type: 'email' });
  if (error) throw new Error('That code is invalid or has expired. Request a new one.');
  const token = data?.session?.access_token;
  const returnedEmail = email(data?.user?.email || data?.session?.user?.email);
  if (!token || !returnedEmail || !allowlist.has(returnedEmail)) throw new Error('This account is not an authorized operator.');
  return { accessToken: token };
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

// §6 slice B: the operator's view of company brokered requests. Degrades to [] if the
// project_requests table isn't migrated yet, so the inbox never breaks.
export async function listAdminRequests(supabase) {
  const { data, error } = await supabase.from('project_requests').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return [];
  const requests = Array.isArray(data) ? data : [];
  const companyIds = [...new Set(requests.map(r => r.company_user_id).filter(Boolean))];
  if (!companyIds.length) return requests;
  const { data: profiles } = await supabase.from('member_profiles').select('user_id,display_name,organization_name').in('user_id', companyIds);
  const byId = new Map((profiles || []).map(p => [p.user_id, p]));
  return requests.map(r => ({ ...r, company: byId.get(r.company_user_id) || null }));
}

const REQUEST_STATUSES = new Set(['submitted', 'in_packaging', 'packaged', 'declined', 'closed']);
export async function updateAdminRequest(supabase, input, operatorEmail = '') {
  const id = text(input.id, 50);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) throw new Error('Choose a valid request.');
  const changes = { updated_at: new Date().toISOString() };
  if (Object.hasOwn(input, 'status')) {
    const status = text(input.status, 40);
    if (!REQUEST_STATUSES.has(status)) throw new Error('Choose a valid request status.');
    changes.status = status;
  }
  if (Object.hasOwn(input, 'resolution_note')) {
    if (typeof input.resolution_note !== 'string') throw new Error('Enter a valid resolution note.');
    const note = text(input.resolution_note, 2_001);
    if (note.length > 2_000) throw new Error('Keep the resolution note under 2,000 characters.');
    changes.resolution_note = note || null;
  }
  if (Object.keys(changes).length === 1) throw new Error('Choose a change to save.');
  const { data, error } = await supabase.from('project_requests').update(changes).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

// §13 slice 2: operator batch management. All degrade to [] if the batches tables aren't
// migrated yet, so the inbox never breaks before the migration is applied.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const BATCH_TIERS = new Set(['open', 'elite']);
const BATCH_STATUSES = new Set(['draft', 'open', 'reviewing', 'closed', 'archived']);
const BATCH_APP_STATUSES = new Set(['submitted', 'reviewing', 'accepted', 'waitlisted', 'declined']);

export async function listAdminBatches(supabase) {
  const { data, error } = await supabase.from('batches').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return [];
  const batches = Array.isArray(data) ? data : [];
  if (!batches.length) return batches;
  const batchIds = batches.map(b => b.id);
  const { data: apps } = await supabase
    .from('batch_applications')
    .select('*')
    .in('batch_id', batchIds)
    .order('created_at', { ascending: false });
  const applications = Array.isArray(apps) ? apps : [];
  const studentIds = [...new Set(applications.map(a => a.student_user_id).filter(Boolean))];
  let byStudent = new Map();
  if (studentIds.length) {
    const { data: profiles } = await supabase
      .from('member_profiles')
      .select('user_id,display_name,headline,school_name,verticals,work_types,skills')
      .in('user_id', studentIds);
    byStudent = new Map((profiles || []).map(p => [p.user_id, p]));
  }
  const appsByBatch = new Map();
  for (const app of applications) {
    const withStudent = { ...app, student: byStudent.get(app.student_user_id) || null };
    if (!appsByBatch.has(app.batch_id)) appsByBatch.set(app.batch_id, []);
    appsByBatch.get(app.batch_id).push(withStudent);
  }
  return batches.map(b => ({ ...b, applications: appsByBatch.get(b.id) || [] }));
}

export async function createBatch(supabase, input, operatorEmail = '') {
  const name = text(input.name, 160);
  if (!name || name.length < 1) throw new Error('Enter a batch name.');
  const tier = text(input.tier, 20) || 'open';
  if (!BATCH_TIERS.has(tier)) throw new Error('Choose a valid tier.');
  const status = text(input.status, 20) || 'open';
  if (!BATCH_STATUSES.has(status)) throw new Error('Choose a valid status.');
  const record = { name, tier, status };
  const discipline = text(input.discipline, 160);
  if (discipline) record.discipline = discipline;
  const partnerOrg = text(input.partner_org ?? input.partnerOrg, 160);
  if (partnerOrg) record.partner_org = partnerOrg;
  const season = text(input.season, 60);
  if (season) record.season = season;
  const description = text(input.description, 2_000);
  if (description) record.description = description;
  if (input.capacity !== undefined && input.capacity !== null && input.capacity !== '') {
    const capacity = Number(input.capacity);
    if (!Number.isInteger(capacity) || capacity < 0) throw new Error('Enter a whole number for capacity, or leave it blank.');
    record.capacity = capacity;
  }
  if (input.access_credits !== undefined && input.access_credits !== null && input.access_credits !== '') {
    const accessCredits = Number(input.access_credits);
    if (!Number.isInteger(accessCredits) || accessCredits < 0) throw new Error('Enter a whole number of credits for access price, or leave it blank.');
    record.access_credits = accessCredits;
  }
  const { data, error } = await supabase.from('batches').insert(record).select('*').single();
  if (error) throw error;
  return { ...data, applications: [] };
}

export async function updateBatch(supabase, input, operatorEmail = '') {
  const id = text(input.id, 50);
  if (!UUID_PATTERN.test(id)) throw new Error('Choose a valid batch.');
  const status = text(input.status, 20);
  if (!BATCH_STATUSES.has(status)) throw new Error('Choose a valid status.');
  const { data, error } = await supabase
    .from('batches')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function reviewBatchApplication(supabase, input, operatorEmail = '') {
  const id = text(input.id, 50);
  if (!UUID_PATTERN.test(id)) throw new Error('Choose a valid application.');
  const status = text(input.status, 20);
  if (!BATCH_APP_STATUSES.has(status)) throw new Error('Choose a valid application status.');
  // reviewed_by is a uuid FK to auth.users; operators are allowlist-based (no auth row), so we
  // record only reviewed_at and leave reviewed_by null rather than force a type mismatch.
  const changes = { status, reviewed_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('batch_applications')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  // Best-effort: on a terminal decision, tell the student. Never blocks the review.
  if (data && ['accepted', 'waitlisted', 'declined'].includes(status) && data.student_user_id) {
    let batchName = '';
    try { const { data: batch } = await supabase.from('batches').select('name').eq('id', data.batch_id).maybeSingle(); batchName = batch?.name || ''; } catch { batchName = ''; }
    await notifyMember(supabase, {
      toUserId: data.student_user_id,
      idempotencyKey: `covenda-batch-${data.id}-${status}`,
      build: ({ to, from, portalUrl }) => batchDecisionEmail({ to, from, batchName, decision: status, portalUrl }),
    });
  }
  return data;
}

// §B operator analytics. Pure aggregation of the credit ledger into money-in / platform-revenue /
// paid-to-students, so the dashboard math is testable in isolation.
export function summarizeLedger(rows = []) {
  let purchased = 0, platformRevenue = 0, toStudents = 0;
  for (const row of rows) {
    const credits = Number(row?.credits) || 0;
    if (row?.entry_type === 'purchase') purchased += credits;
    // user_id null = Covenda platform revenue (reach fees, platform fees, batch access).
    if (row?.user_id == null && credits > 0) platformRevenue += credits;
    // Credits released from escrow to a student (their earnings).
    if (row?.entry_type === 'escrow_release' && row?.user_id != null && credits > 0) toStudents += credits;
  }
  return { purchased, platformRevenue, toStudents };
}

// §B+ / GTM Move 5: willingness-to-pay metrics that become the sales case study. Pure so the
// funnel math is testable. Repeat rate is the metric that answers willingness-to-pay definitively.
export function caseStudyMetrics(completedProjects = [], { applications = 0, accepted = 0 } = {}) {
  const byCompany = new Map();
  let creditsSum = 0, creditsN = 0;
  for (const p of completedProjects) {
    if (p?.owner_user_id) byCompany.set(p.owner_user_id, (byCompany.get(p.owner_user_id) || 0) + 1);
    const c = Number(p?.credits_listed);
    if (Number.isFinite(c) && c > 0) { creditsSum += c; creditsN += 1; }
  }
  const companiesWithDelivery = byCompany.size;
  const repeatCompanies = [...byCompany.values()].filter(n => n >= 2).length;
  return {
    delivered: completedProjects.length,
    acceptanceRate: applications ? Math.round((accepted / applications) * 100) : 0,
    repeatRate: companiesWithDelivery ? Math.round((repeatCompanies / companiesWithDelivery) * 100) : 0,
    avgDeliveredCredits: creditsN ? Math.round(creditsSum / creditsN) : 0,
  };
}

async function countRows(supabase, table, apply) {
  try {
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    if (apply) query = apply(query);
    const { count, error } = await query;
    return error ? 0 : (count || 0);
  } catch { return 0; }
}

// Real operator metrics. Every number is a live count/sum; anything unmigrated degrades to 0 so
// the dashboard renders honest zeros rather than breaking.
// A6 wedge metric (pure, testable): Repeat Company Project Rate — of companies with >=1
// accepted (complete) project, what share came back for a second? The single best early
// signal that the premium promise is real. rows = [{ owner_user_id }] of completed projects.
export function repeatCompanyRate(rows) {
  const byOwner = new Map();
  for (const row of rows || []) {
    const id = row?.owner_user_id;
    if (!id) continue;
    byOwner.set(id, (byOwner.get(id) || 0) + 1);
  }
  const withOne = byOwner.size;
  const withTwo = [...byOwner.values()].filter(n => n >= 2).length;
  return { companiesWithOne: withOne, companiesWithRepeat: withTwo, rate: withOne ? withTwo / withOne : 0 };
}

export async function loadAdminMetrics(supabase) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [
    submissions, profiles, applications, accepted, projects, completed,
    activeBatches, pendingPayouts,
    wkSubmissions, wkApplications, wkCompleted,
    matchedProjects,
  ] = await Promise.all([
    countRows(supabase, 'submissions'),
    countRows(supabase, 'member_profiles'),
    countRows(supabase, 'project_applications'),
    countRows(supabase, 'project_applications', q => q.eq('status', 'accepted')),
    countRows(supabase, 'member_projects'),
    countRows(supabase, 'member_projects', q => q.eq('status', 'complete')),
    countRows(supabase, 'batches', q => q.in('status', ['open', 'reviewing'])),
    countRows(supabase, 'payout_requests', q => q.eq('status', 'requested')),
    countRows(supabase, 'submissions', q => q.gte('created_at', weekAgo)),
    countRows(supabase, 'project_applications', q => q.gte('created_at', weekAgo)),
    countRows(supabase, 'member_projects', q => q.eq('status', 'complete').gte('updated_at', weekAgo)),
    countRows(supabase, 'member_projects', q => q.not('assigned_student_user_id', 'is', null)),
  ]);
  let ledgerRows = [];
  try {
    const { data } = await supabase.from('credit_ledger').select('credits,entry_type,user_id').limit(10_000);
    ledgerRows = Array.isArray(data) ? data : [];
  } catch { ledgerRows = []; }
  let completedProjectRows = [];
  try {
    const { data } = await supabase.from('member_projects').select('owner_user_id, credits_listed').eq('status', 'complete').limit(5000);
    completedProjectRows = Array.isArray(data) ? data : [];
  } catch { completedProjectRows = []; }
  return {
    funnel: { submissions, profiles, applications, accepted, projects, completed },
    thisWeek: { submissions: wkSubmissions, applications: wkApplications, completed: wkCompleted },
    credits: summarizeLedger(ledgerRows),
    batches: { active: activeBatches },
    payouts: { pending: pendingPayouts },
    caseStudy: caseStudyMetrics(completedProjectRows, { applications, accepted }),
    // A6 wedge metrics: north star = accepted work ÷ matched projects; primary early metric =
    // companies that came back for a second accepted project.
    matchQuality: {
      matched: matchedProjects,
      completed,
      successRate: matchedProjects ? completed / matchedProjects : 0,
      repeat: repeatCompanyRate(completedProjectRows),
    },
  };
}

// Packet-first intake (GTM Move 1): companies the operator can send a scoped packet to.
export async function listAdminCompanies(supabase) {
  const { data, error } = await supabase
    .from('member_profiles')
    .select('user_id, display_name, organization_name')
    .in('role', ['company', 'university'])
    .order('updated_at', { ascending: false })
    .limit(200);
  return error ? [] : (data || []);
}

export async function createPacket(supabase, input, operatorEmail = '') {
  const companyUserId = text(input.companyUserId, 50);
  if (!UUID_PATTERN.test(companyUserId)) throw new Error('Choose a company.');
  const { data: profile } = await supabase.from('member_profiles').select('role').eq('user_id', companyUserId).maybeSingle();
  if (!profile || !['company', 'university'].includes(profile.role)) throw new Error('Packets can only be sent to company accounts.');
  const title = text(input.title, 160);
  if (!title) throw new Error('Enter a packet title.');
  const deliverable = text(input.deliverable, 2_000);
  if (!deliverable) throw new Error('Describe the deliverable.');
  const price = Math.round(Number(input.credits) || 0);
  if (!Number.isInteger(price) || price < 0 || price > 100_000) throw new Error('Enter a valid price in credits (0–100,000).');
  const record = {
    owner_user_id: companyUserId,
    title,
    summary: text(input.summary, 5_000) || deliverable,
    deliverable,
    acceptance_criteria: text(input.acceptance, 2_000) || null,
    credits_listed: price,
    credits_held: 0,
    status: 'proposed',
    visibility: 'private',
    proposed_by: email(operatorEmail) || null,
    target_date: /^\d{4}-\d{2}-\d{2}$/.test(input.targetDate || '') ? input.targetDate : null,
  };
  const { data, error } = await supabase.from('member_projects').insert(record).select('*').single();
  if (error) throw error;
  return data;
}

// Member management: list accounts (auth users joined to their profile) so the operator can
// review and, if needed, remove them. Degrades to [] if the admin API is unavailable.
export async function listAdminUsers(supabase) {
  let users = [];
  try {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
    users = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
  } catch { return []; }
  if (!users.length) return [];
  const ids = users.map(u => u.id).filter(Boolean);
  let byId = new Map();
  try {
    const { data: profiles } = await supabase.from('member_profiles').select('user_id, display_name, organization_name, role').in('user_id', ids);
    byId = new Map((profiles || []).map(p => [p.user_id, p]));
  } catch { byId = new Map(); }
  return users.map(u => {
    const p = byId.get(u.id) || {};
    return {
      id: u.id,
      email: u.email || '',
      role: p.role || null,
      name: p.display_name || p.organization_name || '',
      created_at: u.created_at || '',
    };
  });
}

// Delete a member account (cascades their app data via FK on delete). Operator can't delete self.
// Hard delete first; if the DB blocks it, fall back to a soft delete (bans the account so it can
// no longer sign in) so the operator's action still takes effect. Surfaces the real error if both
// fail, instead of a generic 503.
export async function deleteAdminUser(supabase, input, operatorEmail = '') {
  const userId = text(input.userId, 50);
  if (!UUID_PATTERN.test(userId)) throw new Error('Choose a valid user.');
  let targetEmail = '';
  try { const { data } = await supabase.auth.admin.getUserById(userId); targetEmail = email(data?.user?.email); } catch { targetEmail = ''; }
  if (targetEmail && operatorEmail && targetEmail === email(operatorEmail)) throw new Error('Please pick another account — you cannot delete your own operator account.');
  const hard = await supabase.auth.admin.deleteUser(userId);
  if (!hard?.error) return { deleted: userId, mode: 'removed' };
  const soft = await supabase.auth.admin.deleteUser(userId, true);
  if (!soft?.error) return { deleted: userId, mode: 'disabled' };
  const detail = String(hard.error?.message || hard.error || 'unknown error').slice(0, 300);
  throw new Error(`Please try again — deleting this member failed: ${detail}`);
}

// Operator project management: list every member project, and permanently delete one.
export async function listAdminProjects(supabase) {
  const { data, error } = await supabase
    .from('member_projects')
    .select('id,title,status,owner_user_id,credits_listed,credits_held,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(500);
  return error ? [] : (data || []);
}

// Delete a project. project_applications + project_messages cascade via FK ON DELETE CASCADE,
// so this one delete removes the whole conversation/application trail with it. Irreversible.
export async function deleteAdminProject(supabase, input) {
  const projectId = text(input.projectId, 50);
  if (!UUID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const { error } = await supabase.from('member_projects').delete().eq('id', projectId);
  if (error) throw new Error(`Please try again — deleting this project failed: ${String(error?.message || error).slice(0, 200)}`);
  return { deleted: projectId };
}

function adminFailure(error) {
  if (error instanceof AdminOperationalError) {
    return { status: 503, code: error.code, message: error.publicMessage };
  }
  const internalMessage = text(error?.message, 2_000);
  if (/submissions|schema cache|permission denied|relation .* does not exist/i.test(internalMessage)) {
    return {
      status: 503,
      code: 'ADMIN_SUBMISSIONS_UNAVAILABLE',
      message: 'The admin login worked, but Supabase could not use public.submissions. Apply the newest pending inbox migrations and confirm the Vercel Supabase variables point to the same project.',
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
    if (req.method === 'POST') {
      const input = body(req);
      if (input.action === 'request-link') {
        const result = await requestAdminLink(input.email, req, dependencies);
        const requestId = adminRequestId(req);
        logAdminLinkRequest(req, result, requestId, startedAt);
        return res.status(200).json({
          ok: true,
          requestId,
          message: 'If this address is authorized, a sign-in link + code is on its way.',
        });
      }
      if (input.action === 'verify-code') {
        const result = await verifyAdminCode(input.email, input.code, dependencies);
        return res.status(200).json({ ok: true, accessToken: result.accessToken });
      }
      // Every other POST action mutates operator data and requires an authenticated operator.
      const operator = await authorizeAdmin(req, dependencies);
      if (!operator) return res.status(401).json({ ok: false, error: 'Operator authentication is required.' });
      if (input.action === 'create-batch') {
        return res.status(201).json({ ok: true, batch: await createBatch(operator.supabase, input, operator.email) });
      }
      if (input.action === 'create-packet') {
        return res.status(201).json({ ok: true, packet: await createPacket(operator.supabase, input, operator.email) });
      }
      if (input.action === 'partner-digests') {
        // Operator-triggered. send:false is a dry-run preview; send:true only mails when Resend
        // + COVENDA_DIGEST_ENABLED are configured (enforced inside sendPartnerDigests).
        const digest = await sendPartnerDigests(operator.supabase, { env: process.env, send: input.send === true });
        return res.status(200).json({ ok: true, digest });
      }
      return res.status(400).json({ ok: false, error: 'Unknown action.' });
    }

    if (!['GET', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }

    const admin = await authorizeAdmin(req, dependencies);
    if (!admin) return res.status(401).json({ ok: false, error: 'Operator authentication is required.' });

    if (req.method === 'GET') {
      const [submissions, requests, batches, metrics, companies, users, projects] = await Promise.all([
        listAdminSubmissions(admin.supabase), listAdminRequests(admin.supabase), listAdminBatches(admin.supabase), loadAdminMetrics(admin.supabase), listAdminCompanies(admin.supabase), listAdminUsers(admin.supabase), listAdminProjects(admin.supabase),
      ]);
      return res.status(200).json({ ok: true, operator: { email: admin.email }, submissions, requests, batches, metrics, companies, users, projects });
    }

    const patchInput = body(req);
    if (patchInput.action === 'update-request') {
      return res.status(200).json({ ok: true, request: await updateAdminRequest(admin.supabase, patchInput, admin.email) });
    }
    if (patchInput.action === 'update-batch') {
      return res.status(200).json({ ok: true, batch: await updateBatch(admin.supabase, patchInput, admin.email) });
    }
    if (patchInput.action === 'review-batch-application') {
      return res.status(200).json({ ok: true, application: await reviewBatchApplication(admin.supabase, patchInput, admin.email) });
    }
    if (patchInput.action === 'delete-user') {
      return res.status(200).json({ ok: true, result: await deleteAdminUser(admin.supabase, patchInput, admin.email) });
    }
    if (patchInput.action === 'delete-project') {
      return res.status(200).json({ ok: true, result: await deleteAdminProject(admin.supabase, patchInput) });
    }
    const submission = await updateAdminSubmission(admin.supabase, patchInput, admin.email);
    return res.status(200).json({ ok: true, submission });
  } catch (error) {
    const expected = error instanceof SyntaxError || /^(Enter|Choose|Keep|Please|Unknown)/.test(error?.message || '');
    if (expected) return res.status(400).json({ ok: false, code: 'ADMIN_INPUT_INVALID', error: error.message });
    const failure = adminFailure(error);
    logAdminFailure(req, error, failure, startedAt);
    return res.status(failure.status).json({ ok: false, code: failure.code, error: failure.message });
  }
}
