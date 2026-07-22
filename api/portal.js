import { createClient } from '@supabase/supabase-js';

import { supabaseConfiguration } from './submissions.js';

const MEMBER_ROLES = new Set(['student', 'company', 'university']);
const PROJECT_VISIBILITY = new Set(['private', 'members', 'open']);
export const PROJECT_REQUEST_TYPES = new Set(['new_project', 'more_students', 'scope_change', 'revision', 'consult', 'question', 'specific_student']);
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

export function portalRedirectUrl(req, env = process.env) {
  const configured = cleanText(env.COVENDA_APP_URL || env.COVENDA_SITE_URL, 500);
  if (configured) {
    let url;
    try { url = new URL(configured); } catch { throw new PortalOperationalError('PORTAL_APP_URL_INVALID', 'COVENDA_APP_URL must be a complete https:// URL.'); }
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if ((url.protocol !== 'https:' && !local) || url.username || url.password) {
      throw new PortalOperationalError('PORTAL_APP_URL_INVALID', 'COVENDA_APP_URL must be a complete https:// URL.');
    }
    url.pathname = '/portal.html'; url.search = ''; url.hash = '';
    return url.toString();
  }
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
    options: { shouldCreateUser: true, emailRedirectTo: portalRedirectUrl(req, env) },
  });
  if (error) throw new PortalOperationalError('PORTAL_EMAIL_FAILED', 'Supabase could not send the sign-in link. Check the Auth logs and custom SMTP configuration.', error);
  return { accepted: true };
}

export async function requestGoogleLogin(req, { env = process.env, createSupabaseClient = createClient } = {}) {
  const supabase = publicClient(env, createSupabaseClient);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: portalRedirectUrl(req, env), skipBrowserRedirect: true },
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

function publicEndorsement(row) {
  return {
    referrerName: row.referrer_name,
    referrerType: row.referrer_type,
    referrerOrganization: row.referrer_organization,
    function: row.endorsed_function,
    note: row.endorsement_note,
    verifiedAt: row.updated_at,
  };
}

export function summarizeTalentNetwork(profiles = [], endorsements = [], completedProjects = [], approved = false) {
  const verifiedByEmail = new Map();
  for (const endorsement of endorsements) {
    const key = cleanEmail(endorsement.student_email);
    if (!key || endorsement.status !== 'verified') continue;
    const existing = verifiedByEmail.get(key) || [];
    existing.push(publicEndorsement(endorsement));
    verifiedByEmail.set(key, existing);
  }
  const workByStudent = new Map();
  for (const project of completedProjects) {
    if (!project.assigned_student_user_id || project.status !== 'complete') continue;
    const existing = workByStudent.get(project.assigned_student_user_id) || [];
    existing.push({ title: project.title, completedAt: project.completed_at });
    workByStudent.set(project.assigned_student_user_id, existing);
  }
  const schools = new Set(profiles.map(profile => cleanText(profile.school_name, 160)).filter(Boolean));
  const stats = {
    visibleStudents: profiles.length,
    verifiedReferrals: endorsements.filter(item => item.status === 'verified').length,
    schoolsRepresented: schools.size,
  };
  if (!approved) return { stats, directory: [] };
  const directory = profiles.map(profile => {
    const email = cleanEmail(profile.contact_email);
    const verifiedWork = workByStudent.get(profile.user_id) || [];
    return {
      user_id: profile.user_id,
      display_name: profile.display_name,
      school_name: profile.school_name,
      headline: profile.headline,
      bio: profile.bio,
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      verticals: Array.isArray(profile.verticals) ? profile.verticals : [],
      work_types: Array.isArray(profile.work_types) ? profile.work_types : [],
      graduation_year: profile.graduation_year,
      avatar_url: profile.avatar_url,
      updated_at: profile.updated_at,
      endorsements: verifiedByEmail.get(email) || [],
      verified_work: verifiedWork,
      verified_project_count: verifiedWork.length,
    };
  }).sort((a, b) => b.endorsements.length - a.endorsements.length || b.verified_project_count - a.verified_project_count || String(a.display_name).localeCompare(String(b.display_name)));
  return { stats, directory };
}

function partnerSourceEntries(sources = []) {
  const entries = [];
  for (const source of sources) {
    const details = source?.details && typeof source.details === 'object' ? source.details : {};
    const students = source.submission_type === 'university_partner' ? details.roster : details.endorsements;
    for (const student of Array.isArray(students) ? students : []) {
      const studentEmail = cleanEmail(student?.email);
      const studentName = cleanText(student?.name, 100);
      if (!studentEmail || !studentName) continue;
      entries.push({
        studentEmail,
        studentName,
        interest: cleanText(student?.interest || student?.function, 80),
        sourceReference: cleanText(source.reference, 40),
        sourceType: source.submission_type,
        sourceStatus: cleanText(source.status, 40),
        referredAt: source.created_at,
        sourceUpdatedAt: source.updated_at,
      });
    }
  }
  return entries;
}

export function summarizePartnerCohort(sources = [], profiles = [], projects = []) {
  const sourceEntries = partnerSourceEntries(sources);
  const latestByEmail = new Map();
  for (const entry of sourceEntries) {
    const existing = latestByEmail.get(entry.studentEmail);
    if (!existing || String(entry.sourceUpdatedAt || entry.referredAt || '') > String(existing.sourceUpdatedAt || existing.referredAt || '')) latestByEmail.set(entry.studentEmail, entry);
  }
  const profileByEmail = new Map(profiles.map(profile => [cleanEmail(profile.contact_email), profile]).filter(([email]) => email));
  const projectsByStudent = new Map();
  for (const project of projects) {
    if (!project.assigned_student_user_id) continue;
    const current = projectsByStudent.get(project.assigned_student_user_id) || [];
    current.push(project);
    projectsByStudent.set(project.assigned_student_user_id, current);
  }
  const students = [...latestByEmail.values()].map(entry => {
    const profile = profileByEmail.get(entry.studentEmail) || null;
    const studentProjects = profile ? projectsByStudent.get(profile.user_id) || [] : [];
    const completed = studentProjects.filter(project => project.status === 'complete');
    const active = studentProjects.filter(project => ['matched', 'in_progress', 'review'].includes(project.status));
    const projectStage = completed.length ? 'completed' : active.length ? 'active' : 'not_started';
    const activityDates = [entry.sourceUpdatedAt, entry.referredAt, profile?.updated_at, ...studentProjects.map(project => project.completed_at || project.updated_at)].filter(Boolean).sort();
    return {
      display_name: profile?.display_name || entry.studentName,
      user_id: profile?.user_id || null,
      headline: profile?.headline || entry.interest || null,
      avatar_url: profile?.avatar_url || null,
      source_reference: entry.sourceReference,
      referral_status: entry.sourceStatus === 'approved' ? 'verified' : entry.sourceStatus === 'declined' || entry.sourceStatus === 'archived' ? 'closed' : 'under_review',
      profile_status: profile ? 'live' : 'invited',
      project_stage: projectStage,
      active_project_count: active.length,
      completed_project_count: completed.length,
      last_activity_at: activityDates.at(-1) || null,
    };
  }).sort((a, b) => String(b.last_activity_at || '').localeCompare(String(a.last_activity_at || '')) || String(a.display_name).localeCompare(String(b.display_name)));
  const preferredSource = [...sources].sort((a, b) => Number(b.status === 'approved') - Number(a.status === 'approved') || String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0] || null;
  const preferredDetails = preferredSource?.details && typeof preferredSource.details === 'object' ? preferredSource.details : {};
  return {
    stats: {
      referredStudents: students.length,
      liveProfiles: students.filter(student => student.profile_status === 'live').length,
      activeProjects: students.reduce((sum, student) => sum + student.active_project_count, 0),
      completedProjects: students.reduce((sum, student) => sum + student.completed_project_count, 0),
    },
    students,
    referralCode: cleanText(preferredDetails.attributionCode, 40) || cleanText(preferredSource?.reference, 40) || null,
    referralStatus: preferredSource?.status || 'not_started',
  };
}

export async function loadPartnerCohort(member, profile) {
  if (profile?.role !== 'university' || !member.user.email) return null;
  const partnerEmail = cleanEmail(member.user.email);
  const sources = await checked(
    member.supabase.from('submissions')
      .select('reference,submission_type,status,details,created_at,updated_at')
      .eq('submitter_email', partnerEmail)
      .in('submission_type', ['university_partner', 'referrer_endorsement'])
      .order('updated_at', { ascending: false })
      .limit(50),
    [],
  );
  const studentEmails = [...new Set(partnerSourceEntries(sources).map(entry => entry.studentEmail))];
  const profiles = studentEmails.length
    ? await checked(
      member.supabase.from('member_profiles')
        .select('user_id,contact_email,display_name,headline,avatar_url,updated_at')
        .eq('role', 'student')
        .in('contact_email', studentEmails)
        .limit(200),
      [],
    )
    : [];
  const studentIds = profiles.map(student => student.user_id).filter(Boolean);
  const projects = studentIds.length
    ? await checked(
      member.supabase.from('member_projects')
        .select('assigned_student_user_id,title,status,updated_at,completed_at')
        .in('assigned_student_user_id', studentIds)
        .order('updated_at', { ascending: false })
        .limit(500),
      [],
    )
    : [];
  return summarizePartnerCohort(sources, profiles, projects);
}

async function loadTalentNetwork(member, profile) {
  if (profile.role !== 'company') return null;
  const request = member.user.email
    ? await checked(
      member.supabase.from('submissions')
        .select('reference,status,created_at,updated_at')
        .eq('submission_type', 'network_access_request')
        .eq('submitter_email', member.user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      null,
    )
    : null;
  const approved = request?.status === 'approved';
  const profiles = await checked(
    member.supabase.from('member_profiles').select('*').eq('role', 'student').eq('portfolio_visibility', 'members').order('updated_at', { ascending: false }).limit(200),
    [],
  );
  let endorsements = [];
  let schemaReady = true;
  try {
    endorsements = await checked(
      member.supabase.from('student_endorsements').select('*').eq('status', 'verified').order('updated_at', { ascending: false }).limit(500),
      [],
    );
  } catch (error) {
    if (/student_endorsements|schema cache|relation .* does not exist/i.test(error?.message || '')) schemaReady = false;
    else throw error;
  }
  const studentIds = approved ? profiles.map(item => item.user_id).filter(Boolean) : [];
  const completedProjects = studentIds.length
    ? await checked(
      member.supabase.from('member_projects').select('assigned_student_user_id,title,status,completed_at').in('assigned_student_user_id', studentIds).eq('status', 'complete').limit(500),
      [],
    )
    : [];
  const { stats, directory } = summarizeTalentNetwork(profiles, endorsements, completedProjects, approved);
  const status = approved ? 'approved' : request?.status === 'declined' ? 'declined' : request ? 'requested' : 'available';
  return {
    status,
    schemaReady,
    requestReference: request?.reference || null,
    requestedAt: request?.created_at || null,
    stats,
    directory,
  };
}

export async function loadMemberDashboard(member) {
  const { user, supabase } = member;

  const [profile, intakes] = await Promise.all([
    checked(
      supabase
        .from('member_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      null,
    ),
    loadMemberIntakes(member),
  ]);

  if (!profile) {
    return {
      user,
      profile: null,
      projects: [],
      opportunities: [],
      applications: [],
      studentDirectory: [],
      talentNetwork: null,
      partnerCohort: null,
      intakes,
      messages: [],
      projectRequests: [],
      verifiedCount: 0,
    };
  }

  if (profile.role === 'student') {
    const [projects, opportunities, applications, savedProjects] = await Promise.all([
      checked(
        supabase
          .from('member_projects')
          .select('*')
          .eq('assigned_student_user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50),
      ),
      checked(
        supabase
          .from('member_projects')
          .select('*')
          .eq('status', 'open')
          .in('visibility', ['members', 'open'])
          .order('created_at', { ascending: false })
          .limit(50),
      ),
      checked(
        supabase
          .from('project_applications')
          .select('*')
          .eq('student_user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(100),
      ),
      checked(
        supabase
          .from('saved_projects')
          .select('project_id')
          .eq('student_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200),
      ),
    ]);

    const projectIds = projects.map(project => project.id);

    const messages = projectIds.length
      ? await checked(
        supabase
          .from('project_messages')
          .select('*')
          .in('project_id', projectIds)
          .order('created_at', { ascending: true })
          .limit(500),
      )
      : [];

    const verifiedCount = projects.filter(
      project => project.status === 'complete',
    ).length;

    const rankedOpportunities = rankOpportunities(opportunities, profile, {
      completedProjects: verifiedCount,
    });
    const matchedCount = rankedOpportunities.filter(
      project => project.matched,
    ).length;

    const [walletBalance, creditLedger, payoutRequests] = await Promise.all([
      creditBalance(member),
      loadCreditLedger(member),
      loadPayoutRequests(member),
    ]);

    return {
      user,
      profile,
      projects,
      opportunities: rankedOpportunities,
      applications,
      studentDirectory: [],
      talentNetwork: null,
      partnerCohort: null,
      intakes,
      messages,
      projectRequests: [],
      verifiedCount,
      matchedCount,
      walletBalance,
      creditLedger,
      payoutRequests,
      savedProjectIds: savedProjects.map(item => item.project_id),
    };
  }

  const [projects, projectRequests] = await Promise.all([
    checked(
      supabase
        .from('member_projects')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(100),
    ),
    checked(
      supabase
        .from('project_requests')
        .select('*')
        .eq('requester_user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(100),
    ),
  ]);

  const projectIds = projects.map(project => project.id);

  const applications = projectIds.length
    ? await checked(
      supabase
        .from('project_applications')
        .select('*')
        .in('project_id', projectIds)
        .order('updated_at', { ascending: false })
        .limit(200),
    )
    : [];

  const talentNetwork = await loadTalentNetwork(member, profile);
  const studentDirectory = talentNetwork?.directory || [];
  const partnerCohort = await loadPartnerCohort(member, profile);

  const messages = projectIds.length
    ? await checked(
      supabase
        .from('project_messages')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: true })
        .limit(500),
    )
    : [];

  const verifiedCount = projects.filter(
    project => project.status === 'complete',
  ).length;

  const [walletBalance, creditLedger] = await Promise.all([
    creditBalance(member),
    loadCreditLedger(member),
  ]);

  return {
    user,
    profile,
    projects,
    opportunities: [],
    applications,
    studentDirectory,
    talentNetwork,
    partnerCohort,
    intakes,
    messages,
    verifiedCount,
    walletBalance,
    creditLedger,
    projectRequests,
  };
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
    contact_email: user.email || null,
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
  try {
    return await checked(supabase.from('member_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single(), null);
  } catch (error) {
    if (!/contact_email|schema cache/i.test(error?.message || '')) throw error;
    delete row.contact_email;
    return checked(supabase.from('member_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single(), null);
  }
}

export async function requestTalentNetworkAccess(member, input) {
  const profile = await checked(
    member.supabase.from('member_profiles').select('role,display_name,organization_name').eq('user_id', member.user.id).maybeSingle(),
    null,
  );
  if (profile?.role !== 'company') throw new Error('Only company accounts can request Trusted Talent access.');
  if (!member.user.email) throw new Error('Account email is required before requesting access.');
  const reason = cleanText(input.reason, 1_000);
  if (reason.length < 10) throw new Error('Describe the kind of student talent your company needs.');
  const rolesNeeded = cleanList(input.rolesNeeded, 12);
  const hiringTimeline = cleanText(input.hiringTimeline, 120);
  const existing = await checked(
    member.supabase.from('submissions')
      .select('reference,status,created_at,updated_at')
      .eq('submission_type', 'network_access_request')
      .eq('submitter_email', member.user.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    null,
  );
  if (existing && !['declined', 'archived'].includes(existing.status)) return existing;
  const now = new Date().toISOString();
  const reference = `NET-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
  const organizationName = cleanText(profile.organization_name, 160) || 'Company member';
  const row = {
    reference,
    submission_type: 'network_access_request',
    status: 'received',
    source: 'covenda-web',
    revision_of: null,
    submitter_name: cleanText(profile.display_name, 120),
    submitter_email: member.user.email,
    organization_name: organizationName,
    summary: `Trusted Talent access request · ${rolesNeeded.join(', ') || 'general talent discovery'}.`,
    ready_count: null,
    readiness_total: null,
    details: {
      contact: { name: profile.display_name, email: member.user.email, company: organizationName, role: 'Company member' },
      reason,
      rolesNeeded,
      hiringTimeline,
      stage: 'access_requested',
    },
    readiness: null,
    consent: true,
    created_at: now,
    updated_at: now,
  };
  return checked(member.supabase.from('submissions').insert(row).select('reference,status,created_at,updated_at').single(), null);
}

// ---- Credits. 1 credit = $1. Public posts are free; a hyper-narrow (vertical +
// work-type + referred students) post costs a reach fee. The platform fee is 10% of the
// listed amount charged ON TOP, so the student always receives the full listed amount.
export const REACH_FEE_TARGETED = 25;
export const PLATFORM_FEE_RATE = 0.10;
// Payments are stubbed in v1: bundles record what the company *would* pay, and the
// discount lives in the price, not in extra credits (1 credit stays $1 of value).
export const CREDIT_BUNDLES = new Map([[100, 100], [500, 475], [1000, 900]]);

// Pure cost model — the UI, the server, and the tests all read from this one function.
export function projectCreditCost(creditsListed, targeting) {
  const listed = Math.max(0, Math.round(Number(creditsListed) || 0));
  const reachFee = targeting === 'targeted' ? REACH_FEE_TARGETED : 0;
  const platformFee = Math.round(listed * PLATFORM_FEE_RATE);
  return { listed, reachFee, platformFee, total: listed + reachFee + platformFee };
}

// The ledger is the only source of truth for a balance. Pilot volumes are small enough
// to sum in the API; if this grows, move it to a Postgres aggregate/RPC.
export async function creditBalance(member, userId = member.user.id) {
  const rows = await checked(member.supabase.from('credit_ledger').select('credits').eq('user_id', userId), []);
  return rows.reduce((sum, row) => sum + (Number(row.credits) || 0), 0);
}

export async function loadCreditLedger(member, limit = 50) {
  return checked(
    member.supabase.from('credit_ledger').select('*').eq('user_id', member.user.id).order('created_at', { ascending: false }).limit(limit),
    [],
  );
}

function operatorEmails(env) {
  return cleanText(env.COVENDA_ADMIN_EMAILS, 4_000).toLowerCase().split(/[,\s]+/).filter(Boolean);
}

// Granting credits without charging is a production footgun, so it is off unless the
// deployment explicitly enables it or the caller is a listed operator.
export async function buyCredits(member, input, env = process.env) {
  const enabled = env.COVENDA_CREDIT_GRANTS_ENABLED === 'true' || operatorEmails(env).includes(member.user.email || '');
  if (!enabled) throw new Error('This deployment does not have credit purchases enabled yet.');
  const bundle = Math.round(Number(input.credits) || 0);
  if (!CREDIT_BUNDLES.has(bundle)) throw new Error('Choose one of the available credit bundles.');
  const priceUsd = CREDIT_BUNDLES.get(bundle);
  await checked(
    member.supabase.from('credit_ledger').insert({
      user_id: member.user.id,
      entry_type: 'purchase',
      credits: bundle,
      note: `Stubbed purchase · ${bundle} credits · $${priceUsd}`,
    }).select('id').single(),
    null,
  );
  return { balance: await creditBalance(member) };
}

// ---- Payouts. A student's balance is money Covenda owes them; a request makes that
// obligation explicit and auditable until real payment rails exist. ----
const PAYOUT_METHODS = new Set(['PayPal', 'Zelle', 'Bank transfer', 'Other']);

// We never want bank/card numbers in the database. Reject anything that looks like a raw
// account or card number rather than quietly storing it.
export function looksLikeAccountNumber(value) {
  const digits = String(value || '').replace(/[\s-]/g, '');
  return /^\d{8,}$/.test(digits);
}

export async function loadPayoutRequests(member) {
  return checked(
    member.supabase.from('payout_requests').select('*').eq('user_id', member.user.id).order('requested_at', { ascending: false }).limit(20),
    [],
  );
}

export async function requestPayout(member, input) {
  const credits = Math.round(Number(input.credits) || 0);
  if (credits <= 0) throw new Error('Enter how many credits you want paid out.');
  const balance = await creditBalance(member);
  if (credits > balance) throw new Error(`This payout is larger than your balance of ${balance} credits.`);
  const method = cleanText(input.method, 40);
  if (!PAYOUT_METHODS.has(method)) throw new Error('Choose how you would like to be paid.');
  const handle = cleanText(input.handle, 160);
  if (!handle) throw new Error('Add the email or handle Covenda should send the payment to.');
  if (looksLikeAccountNumber(handle)) throw new Error('Please share an email or handle instead of an account number — Covenda will arrange the transfer with you directly.');
  const open = await checked(
    member.supabase.from('payout_requests').select('id').eq('user_id', member.user.id).eq('status', 'requested').maybeSingle(),
    null,
  );
  if (open) throw new Error('You already have a payout request awaiting review.');
  return checked(
    member.supabase.from('payout_requests').insert({ user_id: member.user.id, credits, method, handle }).select('*').single(),
    null,
  );
}

export async function cancelPayoutRequest(member, input) {
  const id = cleanText(input.requestId, 50);
  if (!PROJECT_ID_PATTERN.test(id)) throw new Error('Choose a valid payout request.');
  const request = await checked(member.supabase.from('payout_requests').select('id,user_id,status').eq('id', id).maybeSingle(), null);
  if (!request || request.user_id !== member.user.id) throw new Error('Only the requesting student can cancel this payout.');
  if (request.status !== 'requested') throw new Error('This payout request has already been resolved.');
  return checked(
    member.supabase.from('payout_requests').update({ status: 'cancelled', resolved_at: new Date().toISOString() }).eq('id', id).select('*').single(),
    null,
  );
}

// Operator-only. Marking a payout paid debits the ledger and closes the request in one
// transaction, so a student is never shown as paid without the ledger agreeing.
export async function fulfilPayout(member, input, env = process.env) {
  if (!operatorEmails(env).includes(member.user.email || '')) throw new Error('Only a Covenda operator can settle payouts.');
  const id = cleanText(input.requestId, 50);
  if (!PROJECT_ID_PATTERN.test(id)) throw new Error('Choose a valid payout request.');
  const settled = await checked(
    member.supabase.rpc('fulfil_payout_request', { p_request_id: id, p_operator_id: member.user.id, p_note: cleanText(input.note, 500) || null }),
    null,
  );
  return Array.isArray(settled) ? settled[0] : settled;
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

function sanitizePacketDraft(value = {}) {
  const draft = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    title: cleanText(draft.title, 160),
    summary: cleanText(draft.summary, 5_000),
    deliverable: cleanText(draft.deliverable, 2_000),
    acceptanceCriteria: cleanText(draft.acceptanceCriteria, 4_000),
    safeInputs: cleanText(draft.safeInputs, 4_000),
    desiredSkills: cleanList(draft.desiredSkills),
    verticals: cleanTaxonomy(draft.verticals, VERTICALS),
    workTypes: cleanTaxonomy(draft.workTypes, WORK_TYPES),
    credits: Math.max(0, Math.min(100_000, Math.round(Number(draft.credits) || 0))),
    targetDate: /^\d{4}-\d{2}-\d{2}$/.test(draft.targetDate || '') ? draft.targetDate : null,
  };
}

export async function createProjectRequest(member, input) {
  const profile = await checked(
    member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(),
    null,
  );
  if (!profile || !['company', 'university'].includes(profile.role)) {
    throw new Error('Only company and university accounts can request project work.');
  }
  const requestType = cleanText(input.requestType, 40);
  if (!PROJECT_REQUEST_TYPES.has(requestType)) throw new Error('Choose a valid request type.');
  const requestBody = cleanText(input.body, 8_000);
  if (requestBody.length < 10) throw new Error('Describe what you need in at least 10 characters.');

  const projectId = cleanText(input.projectId, 50);
  if (projectId) {
    if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid related project.');
    const project = await checked(
      member.supabase.from('member_projects').select('id,owner_user_id').eq('id', projectId).maybeSingle(),
      null,
    );
    if (!project || project.owner_user_id !== member.user.id) throw new Error('Choose a project owned by this workspace.');
  }

  const now = new Date().toISOString();
  const row = {
    requester_user_id: member.user.id,
    related_project_id: projectId || null,
    project_id: null,
    request_type: requestType,
    body: requestBody,
    attachments: cleanAttachments(input.attachments),
    status: 'submitted',
    ai_brief: input.aiBrief && typeof input.aiBrief === 'object' ? sanitizeBrief(input.aiBrief) : {},
    packet_draft: sanitizePacketDraft(input.packetDraft),
    created_at: now,
    updated_at: now,
  };
  return checked(member.supabase.from('project_requests').insert(row).select('*').single(), null);
}

// Rank open opportunities so ones matching the student's verticals/work types come
// first, each tagged `matched` for the "Matched to your vertical" badge. A student who
// picked "Not sure yet — show me everything" matches every vertical.
export const PROJECT_FIT_WEIGHTS = Object.freeze({ vertical: 32, workType: 28, skills: 28, experience: 12 });

function normalizedSet(values) {
  return new Set((Array.isArray(values) ? values : []).map(value => cleanText(value, 80).toLowerCase()).filter(Boolean));
}

function fitLabel(value) {
  return cleanText(value, 80).replace(/\b\w/g, letter => letter.toUpperCase());
}

// This score describes one project/student pairing. It is intentionally transparent,
// uses only work-relevant inputs, and never reads school, name, photo, age, or another
// protected/proxy attribute. Unknown fields are omitted instead of counting against a student.
export function calculateProjectFit(project, profile, context = {}) {
  const profileVerticals = normalizedSet(profile?.verticals);
  const projectVerticals = normalizedSet(project?.verticals);
  const profileWorkTypes = normalizedSet(profile?.work_types);
  const projectWorkTypes = normalizedSet(project?.work_types);
  const profileSkills = normalizedSet(profile?.skills);
  const projectSkills = normalizedSet(project?.desired_skills);
  const everything = profileVerticals.has('not sure yet — show me everything');
  const overlap = (left, right) => [...left].filter(value => right.has(value));
  const verticalMatches = everything ? [...projectVerticals] : overlap(profileVerticals, projectVerticals);
  const workTypeMatches = overlap(profileWorkTypes, projectWorkTypes);
  const skillMatches = overlap(profileSkills, projectSkills);
  let available = 0;
  let earned = 0;
  const reasons = [];

  if (profileVerticals.size && projectVerticals.size) {
    available += PROJECT_FIT_WEIGHTS.vertical;
    if (verticalMatches.length) {
      earned += PROJECT_FIT_WEIGHTS.vertical;
      reasons.push(everything ? 'Open to this industry' : fitLabel(verticalMatches[0]));
    }
  }
  if (profileWorkTypes.size && projectWorkTypes.size) {
    available += PROJECT_FIT_WEIGHTS.workType;
    if (workTypeMatches.length) {
      earned += PROJECT_FIT_WEIGHTS.workType;
      reasons.push(fitLabel(workTypeMatches[0]));
    }
  }
  if (profileSkills.size && projectSkills.size) {
    available += PROJECT_FIT_WEIGHTS.skills;
    const share = Math.min(1, skillMatches.length / Math.max(1, Math.min(3, projectSkills.size)));
    earned += Math.round(PROJECT_FIT_WEIGHTS.skills * share);
    if (skillMatches.length) reasons.push(`Skills: ${skillMatches.slice(0, 2).map(fitLabel).join(', ')}`);
  }
  if (Number(context.completedProjects) > 0) {
    available += PROJECT_FIT_WEIGHTS.experience;
    earned += PROJECT_FIT_WEIGHTS.experience;
    reasons.push('Completed Covenda work');
  }

  const score = available ? Math.round(earned / available * 100) : 0;
  return {
    score,
    matched: verticalMatches.length > 0 || workTypeMatches.length > 0 || skillMatches.length > 0,
    reasons: [...new Set(reasons)].slice(0, 4),
    features: {
      verticalMatches: verticalMatches.length,
      workTypeMatches: workTypeMatches.length,
      skillMatches: skillMatches.length,
      completedProjects: Math.max(0, Math.min(100, Number(context.completedProjects) || 0)),
    },
  };
}

export function rankOpportunities(opportunities, profile, context = {}) {
  return (opportunities || [])
    .map(project => {
      const fit = calculateProjectFit(project, profile, context);
      return { ...project, matched: fit.matched, fit_score: fit.score, fit_reasons: fit.reasons, fit_features: fit.features };
    })
    .sort((a, b) => b.fit_score - a.fit_score || String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

const CLIENT_MATCH_EVENTS = new Set(['surfaced', 'viewed']);

async function studentFitContext(member, projectId) {
  const [profile, project, completed] = await Promise.all([
    checked(member.supabase.from('member_profiles').select('*').eq('user_id', member.user.id).maybeSingle(), null),
    checked(member.supabase.from('member_projects').select('*').eq('id', projectId).maybeSingle(), null),
    checked(member.supabase.from('member_projects').select('id').eq('assigned_student_user_id', member.user.id).eq('status', 'complete').limit(100), []),
  ]);
  if (profile?.role !== 'student') throw new Error('Only student accounts can use project discovery.');
  if (!project || project.status !== 'open' || !['members', 'open'].includes(project.visibility)) throw new Error('This project is not available in discovery.');
  return { profile, project, fit: calculateProjectFit(project, profile, { completedProjects: completed.length }) };
}

async function appendMatchEvent(member, projectId, eventType, fit = null, studentUserId = member.user.id) {
  const row = {
    project_id: projectId,
    student_user_id: studentUserId,
    event_type: eventType,
    features: fit?.features || {},
    fit_score: Number.isFinite(fit?.score) ? fit.score : null,
    fit_reasons: fit?.reasons || [],
  };
  return checked(member.supabase.from('match_events').insert(row).select('id,event_type,created_at').single(), null);
}

async function appendMatchEventSafely(member, projectId, eventType, fit = null, studentUserId = member.user.id) {
  try {
    await appendMatchEvent(member, projectId, eventType, fit, studentUserId);
  } catch (error) {
    // Instrumentation must never turn a successful application, review, or payout
    // transition into an apparent failure that a member might repeat.
    console.warn(JSON.stringify({ level:'warn', message:'Match event was not recorded', eventType, projectId, error:cleanText(error?.message, 500) }));
  }
}

export async function recordMatchEvent(member, input) {
  const projectId = cleanText(input.projectId, 50);
  const eventType = cleanText(input.eventType, 30);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  if (!CLIENT_MATCH_EVENTS.has(eventType)) throw new Error('Choose a valid discovery event.');
  const { fit } = await studentFitContext(member, projectId);
  return appendMatchEvent(member, projectId, eventType, fit);
}

export async function toggleSavedProject(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  await studentFitContext(member, projectId);
  const saved = input.saved === true;
  if (saved) {
    const existing = await checked(member.supabase.from('saved_projects').select('project_id').eq('student_user_id', member.user.id).eq('project_id', projectId).maybeSingle(), null);
    if (!existing) await checked(member.supabase.from('saved_projects').insert({ student_user_id: member.user.id, project_id: projectId }).select('project_id').single(), null);
  } else {
    await checked(member.supabase.from('saved_projects').delete().eq('student_user_id', member.user.id).eq('project_id', projectId).select('project_id'), []);
  }
  return { projectId, saved };
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

  // Credits: charge the reach fee and hold escrow (listed + platform fee) at post time.
  const priced = input.creditsListed !== undefined;
  const targeting = input.targeting === 'targeted' ? 'targeted' : 'public';
  const cost = projectCreditCost(input.creditsListed, targeting);
  if (priced) {
    const balance = await creditBalance(member);
    if (balance < cost.total) {
      throw new Error(`This project needs ${cost.total} credits (${cost.listed} listed + ${cost.platformFee} platform fee + ${cost.reachFee} reach fee) but your balance is ${balance}.`);
    }
    row.credits_listed = cost.listed;
    row.targeting = targeting;
    row.credits_held = cost.listed;
    row.platform_fee_credits = cost.platformFee;
  }

  const project = await checked(member.supabase.from('member_projects').insert(row).select('*').single(), null);

  if (priced && project?.id) {
    const entries = [];
    if (cost.reachFee > 0) {
      // Both sides of the reach fee, so member balances and platform revenue reconcile.
      entries.push({ user_id: member.user.id, entry_type: 'reach_fee', credits: -cost.reachFee, project_id: project.id, note: 'Hyper-narrow reach fee' });
      entries.push({ user_id: null, entry_type: 'reach_fee', credits: cost.reachFee, project_id: project.id, note: 'Hyper-narrow reach fee' });
    }
    if (cost.listed + cost.platformFee > 0) {
      entries.push({ user_id: member.user.id, entry_type: 'escrow_hold', credits: -(cost.listed + cost.platformFee), project_id: project.id, note: `Escrow: ${cost.listed} listed + ${cost.platformFee} platform fee` });
    }
    if (entries.length) await checked(member.supabase.from('credit_ledger').insert(entries).select('id'), []);
  }
  return project;
}

export async function applyToProject(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) throw new Error('Choose a valid project.');
  const profile = await checked(member.supabase.from('member_profiles').select('*').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'student') throw new Error('Only student accounts can apply to projects.');
  const project = await checked(member.supabase.from('member_projects').select('*').eq('id', projectId).maybeSingle(), null);
  if (!project || project.status !== 'open' || !['members', 'open'].includes(project.visibility)) throw new Error('This project is not accepting applications.');
  const existing = await checked(
    member.supabase.from('project_applications').select('*').eq('project_id', projectId).eq('student_user_id', member.user.id).maybeSingle(),
    null,
  );
  if (existing) return existing;
  const row = { project_id: projectId, student_user_id: member.user.id, note: cleanText(input.note, 2_000) || null, updated_at: new Date().toISOString() };
  const application = await checked(member.supabase.from('project_applications').insert(row).select('*').single(), null);
  const completed = await checked(member.supabase.from('member_projects').select('id').eq('assigned_student_user_id', member.user.id).eq('status', 'complete').limit(100), []);
  await appendMatchEventSafely(member, projectId, 'applied', calculateProjectFit(project, profile, { completedProjects: completed.length }));
  return application;
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
  const declined = await checked(
    member.supabase.from('project_applications').update({ status: 'declined', updated_at: now }).eq('project_id', project.id).neq('id', applicationId).neq('status', 'withdrawn').select('id,student_user_id'),
    [],
  );
  await appendMatchEventSafely(member, project.id, 'accepted', null, application.student_user_id);
  for (const item of declined) await appendMatchEventSafely(member, project.id, 'declined', null, item.student_user_id);
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
  const updated = await checked(
    member.supabase.from('member_projects').update({ deliverable: body, status: 'review', deliverable_submitted_at: now, review_note: null, updated_at: now }).eq('id', projectId).select('*').single(),
    null,
  );
  await appendMatchEventSafely(member, projectId, 'submitted');
  return updated;
}

export async function reviewDeliverable(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const decision = input.decision === 'accept' ? 'accept' : input.decision === 'revise' ? 'revise' : '';
  if (!decision) throw new Error('Choose accept or request changes.');
  const note = cleanText(input.note, 2_000);
  if (decision === 'revise' && !note) throw new Error('Add a note so the student knows what to revise.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,assigned_student_user_id,status').eq('id', projectId).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can review a deliverable.');
  if (project.status !== 'review') throw new Error('This project has no submitted deliverable to review.');
  const now = new Date().toISOString();

  if (decision === 'revise') {
    // No credit movement — the escrow stays held while the student reworks it.
    const revised = await checked(
      member.supabase.from('member_projects').update({ status: 'in_progress', review_note: note, updated_at: now }).eq('id', projectId).select('*').single(),
      null,
    );
    if (project.assigned_student_user_id) await appendMatchEventSafely(member, projectId, 'revision_requested', null, project.assigned_student_user_id);
    return revised;
  }

  // Accepting settles money, so the ledger writes and the status change must commit
  // together. The database function does both under a row lock; if it fails, nothing
  // moves and the project stays in review rather than completing unpaid.
  if (note) {
    await checked(member.supabase.from('member_projects').update({ review_note: note, updated_at: now }).eq('id', projectId).select('id').single(), null);
  }
  const released = await checked(member.supabase.rpc('release_project_escrow', { p_project_id: projectId, p_owner_id: member.user.id }), null);
  if (project.assigned_student_user_id) await appendMatchEventSafely(member, projectId, 'completed', null, project.assigned_student_user_id);
  return Array.isArray(released) ? released[0] : released;
}

// Capture the business outcome of accepted work. This records whether a project became
// a longer engagement or placement; it never moves credits or charges a fee.
const CONVERSION_OUTCOMES = new Set(['none', 'continued', 'interview', 'internship', 'full_time', 'referred_on']);
export async function recordConversion(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const outcome = cleanText(input.outcome, 40);
  if (!CONVERSION_OUTCOMES.has(outcome)) throw new Error('Choose what the project led to.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,status').eq('id', projectId).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can record an outcome.');
  if (project.status !== 'complete') throw new Error('You can record an outcome once the work is accepted.');
  const now = new Date().toISOString();
  return checked(
    member.supabase.from('member_projects').update({
      conversion_outcome: outcome,
      conversion_note: cleanText(input.note, 500) || null,
      conversion_recorded_at: now,
      updated_at: now,
    }).eq('id', projectId).select('*').single(),
    null,
  );
}

// Cancelling before completion returns the held escrow to the company. Same atomicity
// requirement as the release, so it also runs as a database function.
export async function cancelProject(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,assigned_student_user_id,status').eq('id', projectId).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can cancel a project.');
  if (['complete', 'archived'].includes(project.status)) throw new Error('This project is already finished.');
  const refunded = await checked(member.supabase.rpc('refund_project_escrow', { p_project_id: projectId, p_owner_id: member.user.id }), null);
  if (project.assigned_student_user_id) await appendMatchEventSafely(member, projectId, 'cancelled', null, project.assigned_student_user_id);
  return Array.isArray(refunded) ? refunded[0] : refunded;
}

function portalFailure(error) {
  if (error instanceof PortalOperationalError) return { status: 503, code: error.code, message: error.publicMessage };
  const message = cleanText(error?.message, 2_000);
  if (/member_profiles|member_projects|project_requests|project_applications|project_messages|student_endorsements|saved_projects|match_events|submissions|schema cache|relation .* does not exist/i.test(message)) {
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
    if (req.method === 'POST' && input.action === 'create-request') return res.status(201).json({ ok: true, request: await createProjectRequest(member, input) });
    if (req.method === 'POST' && input.action === 'create-project') return res.status(400).json({ ok: false, error: 'Covenda scopes and packages every request before students see it. Use Request work instead.' });
    if (req.method === 'POST' && input.action === 'apply') return res.status(201).json({ ok: true, application: await applyToProject(member, input) });
    if (req.method === 'POST' && input.action === 'match-event') return res.status(201).json({ ok: true, event: await recordMatchEvent(member, input) });
    if (req.method === 'POST' && input.action === 'toggle-save') return res.status(200).json({ ok: true, ...(await toggleSavedProject(member, input)) });
    if (req.method === 'POST' && input.action === 'send-message') return res.status(201).json({ ok: true, message: await sendProjectMessage(member, input) });
    if (req.method === 'POST' && input.action === 'accept-application') return res.status(200).json({ ok: true, application: await acceptApplication(member, input) });
    if (req.method === 'POST' && input.action === 'submit-deliverable') return res.status(200).json({ ok: true, project: await submitDeliverable(member, input) });
    if (req.method === 'POST' && input.action === 'review-deliverable') return res.status(200).json({ ok: true, project: await reviewDeliverable(member, input) });
    if (req.method === 'POST' && input.action === 'record-conversion') return res.status(200).json({ ok: true, project: await recordConversion(member, input) });
    if (req.method === 'POST' && input.action === 'buy-credits') return res.status(200).json({ ok: true, ...(await buyCredits(member, input, dependencies.env || process.env)) });
    if (req.method === 'POST' && input.action === 'request-network-access') return res.status(201).json({ ok: true, request: await requestTalentNetworkAccess(member, input) });
    if (req.method === 'POST' && input.action === 'cancel-project') return res.status(200).json({ ok: true, project: await cancelProject(member, input) });
    if (req.method === 'POST' && input.action === 'request-payout') return res.status(201).json({ ok: true, payout: await requestPayout(member, input) });
    if (req.method === 'POST' && input.action === 'cancel-payout') return res.status(200).json({ ok: true, payout: await cancelPayoutRequest(member, input) });
    if (req.method === 'POST' && input.action === 'fulfil-payout') return res.status(200).json({ ok: true, payout: await fulfilPayout(member, input, dependencies.env || process.env) });
    return res.status(400).json({ ok: false, error: 'Unknown portal action.' });
  } catch (error) {
    const expected = error instanceof SyntaxError || /^(Enter|Choose|Only|Account|This|Please|Add|Describe|A refresh)/.test(error?.message || '');
    if (expected) return res.status(400).json({ ok: false, code: 'PORTAL_INPUT_INVALID', error: error.message });
    const failure = portalFailure(error);
    console.error(JSON.stringify({ level: 'error', message: 'Portal API failed', route: '/api/portal', method: req.method, requestId: cleanText(req.headers['x-vercel-id'], 200) || null, code: failure.code, error: cleanText(error?.cause?.message || error?.message || error, 2_000), durationMs: Date.now() - startedAt }));
    return res.status(failure.status).json({ ok: false, code: failure.code, error: failure.message });
  }
}
