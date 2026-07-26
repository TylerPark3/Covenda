import { createClient } from '@supabase/supabase-js';

import { supabaseConfiguration } from './submissions.js';
import { notifyMember, notifyOperatorEvent, applicationReceivedEmail, applicationDecisionEmail, payoutRequestedEmail } from './notify.js';
import { parseRepoRef, fetchRepoData, analyzeRepo } from './github.js';
import { canonicalizeSkill } from './skills-taxonomy.js';
import { presentScore, normalizeAppeal } from './hardening.js';
import { BATCH_CATALOG, batchBrief, evaluateBatchAdmission, demoForVertical, batchesByVertical } from './batches.js';
import { VERIFICATION_TIERS, REFERRER_VALUE, CLUB_VERIFICATION_VERSION, evaluateClubVerification, memberStanding } from './clubs.js';
import { buildTalentRequirement, REQUIREMENT_VERTICALS, REQUIREMENT_WORK_TYPES } from './talent-profile.js';
import { checkSchoolEmail, checkCode, generateCode, verificationStanding, normaliseEmail } from './verification.js';
import { evidenceMetaFromTimeline } from './connectors.js';

const MEMBER_ROLES = new Set(['student', 'company', 'university']);
const PROJECT_VISIBILITY = new Set(['private', 'members', 'open']);
// Opportunity model (Stage-0 schema). The full enum ships in the DB; the MVP intake UI exposes
// only the first three so the pilot stays project-shaped, but the API accepts any valid value.
export const OPPORTUNITY_TYPES = new Set(['project', 'internship', 'part_time', 'research', 'apprenticeship', 'talent_pipeline', 'full_time']);
export const REFERRAL_REQUIREMENTS = new Set(['required', 'preferred', 'none']);
// Experience is expressed as job-relevant, EVIDENCE-observable thresholds — never degree/major
// (protected proxies, deliberately not collected or scored; see cleanTalentPrefs).
export const EXPERIENCE_REQUIREMENTS = new Set(['none', 'relevant_project', 'prior_internship', 'professional']);
export const TALENT_SOURCES = new Set(['open_network', 'university', 'professor', 'research_lab', 'team_club', 'student_referral', 'founder_referral']);

// Talent-acquisition preferences: a whitelisted, protected-proxy-free targeting object. We
// intentionally do NOT capture degree, major, school prestige, age, or location — those are
// protected attributes or proxies for them, and the fairness posture excludes them from
// scoring entirely. Only job-relevant, evidence-checkable signals are kept.
function cleanTalentPrefs(input) {
  const prefs = {};
  if (Array.isArray(input.talentSources)) {
    const sources = [...new Set(input.talentSources.filter(s => TALENT_SOURCES.has(s)))];
    if (sources.length) prefs.sources = sources.slice(0, TALENT_SOURCES.size);
  }
  if (input.availabilityHoursMin !== undefined && Number.isFinite(Number(input.availabilityHoursMin))) {
    prefs.availabilityHoursMin = Math.max(0, Math.min(40, Math.round(Number(input.availabilityHoursMin))));
  }
  return Object.keys(prefs).length ? prefs : null;
}
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
  const redirectTo = portalRedirectUrl(req);

  // Supabase's BUILT-IN mailer is the weak link: it is rate-limited to a handful of messages
  // an hour and fails outright until custom SMTP is configured in the dashboard, which is
  // where sign-in was dying. Resend is already wired for every other transactional email, so
  // when it is available we mint the magic link ourselves with the service role and send it
  // through Resend instead — no dashboard SMTP required, no per-hour ceiling.
  const sent = await sendMagicLinkViaResend(email, redirectTo, { env, createSupabaseClient });
  if (sent.ok) return { accepted: true, via: 'resend' };

  // Fall back to Supabase's own mailer when Resend is not configured.
  const supabase = publicClient(env, createSupabaseClient);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
  });
  if (error) {
    throw new PortalOperationalError(
      'PORTAL_EMAIL_FAILED',
      sent.reason === 'not-configured'
        ? 'Sign-in email is not configured. Set RESEND_API_KEY and COVENDA_NOTIFICATION_FROM, or configure custom SMTP in Supabase Auth.'
        : `Could not send the sign-in link (${sent.reason}).`,
      error,
    );
  }
  return { accepted: true, via: 'supabase' };
}

// Mint a magic link with the service role and deliver it via Resend. Never throws — the
// caller falls back to Supabase's mailer, so a Resend outage degrades rather than breaks.
async function sendMagicLinkViaResend(email, redirectTo, { env = process.env, createSupabaseClient = createClient } = {}) {
  try {
    const apiKey = env.RESEND_API_KEY;
    const from = env.COVENDA_NOTIFICATION_FROM;
    if (!apiKey || !from) return { ok: false, reason: 'not-configured' };

    const admin = serviceClient(env, createSupabaseClient);
    // 'magiclink' only mails existing users; 'signup' is used for new ones. Try magiclink
    // first and fall back, so a first-time member is not silently dropped.
    let link = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } });
    if (link.error) link = await admin.auth.admin.generateLink({ type: 'signup', email, options: { redirectTo } });
    const actionLink = link?.data?.properties?.action_link;
    if (link.error || !actionLink) return { ok: false, reason: String(link.error?.message || 'no-link').slice(0, 120) };

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: 'Your Covenda sign-in link',
      text: `Sign in to Covenda:\n\n${actionLink}\n\nThis link expires shortly and can be used once. If you did not request it, ignore this email.`,
      html: `<p>Sign in to Covenda:</p><p><a href="${actionLink}">Open Covenda</a></p>`
        + '<p><small>This link expires shortly and can be used once. If you did not request it, ignore this email.</small></p>',
    });
    if (error) return { ok: false, reason: String(error.message || error).slice(0, 120) };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error).slice(0, 120) };
  }
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

export async function loadMemberDashboard(member, env = process.env) {
  const { user, supabase } = member;
  // Whether the ID-verification feature is switched on for this deployment. Off by default so
  // the frontend hides the verify CTA (and real ID collection stays disabled) until it's
  // deliberately enabled — see the safety note in api/stripe-identity.js.
  const identityEnabled = env.COVENDA_IDENTITY_ENABLED === 'true';
  // AI-brief metering surface: whether it's on and what a generation costs (default 5 credits).
  const briefMeteringEnabled = env.COVENDA_BRIEF_METERING_ENABLED === 'true';
  const briefFee = Math.max(0, Math.round(Number(env.COVENDA_BRIEF_FEE) || 5));
  const [profile, intakes] = await Promise.all([
    checked(supabase.from('member_profiles').select('*').eq('user_id', user.id).maybeSingle(), null),
    loadMemberIntakes(member),
  ]);
  if (!profile) return { user, profile: null, projects: [], opportunities: [], applications: [], studentDirectory: [], intakes, messages: [], verifiedCount: 0, identityEnabled , briefMeteringEnabled, briefFee , platformFeeRate: PLATFORM_FEE_RATE };

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
    const positiveOutcomes = projects.filter(project => project.conversion_outcome && project.conversion_outcome !== 'none').length;
    const rankedOpportunities = rankOpportunities(opportunities, profile, { completedCount: verifiedCount, positiveOutcomes });
    const matchedCount = rankedOpportunities.filter(project => project.matched).length;
    // Students hold credits too once escrow is released, so they get a balance (the
    // Wallet view itself stays company/university only).
    const [walletBalance, creditLedger, payoutRequests, batches, batchApplications] = await Promise.all([
      creditBalance(member), loadCreditLedger(member), loadPayoutRequests(member), loadBatches(member), loadBatchApplications(member),
    ]);
    const batchStanding = await loadBatchStanding(member);
    const verification = await loadVerificationStanding(member);
    return { user, profile, projects, opportunities: rankedOpportunities, applications, studentDirectory: [], intakes, messages, verifiedCount, matchedCount, walletBalance, creditLedger, payoutRequests, batches, batchApplications, batchStanding, verification, batchBriefs: BATCH_CATALOG.map(batchBrief), identityEnabled , briefMeteringEnabled, briefFee , platformFeeRate: PLATFORM_FEE_RATE };
  }

  const projects = await checked(supabase.from('member_projects').select('*').eq('owner_user_id', user.id).order('updated_at', { ascending: false }).limit(100));
  const projectIds = projects.map(project => project.id);
  let applications = projectIds.length
    ? await checked(supabase.from('project_applications').select('*').in('project_id', projectIds).order('updated_at', { ascending: false }).limit(200))
    : [];
  // Join each application to its applicant's profile so the owner can actually review
  // candidates (the "can't see applicants" gap). Applying is consent to share the profile +
  // materials with THIS project's owner; only students who applied here are exposed.
  if (applications.length) {
    const applicantIds = [...new Set(applications.map(a => a.student_user_id).filter(Boolean))];
    const applicantProfiles = applicantIds.length
      ? await checked(supabase.from('member_profiles').select('*').in('user_id', applicantIds))
      : [];
    const byId = new Map(applicantProfiles.map(p => [p.user_id, p]));
    const projectById = new Map(projects.map(p => [p.id, p]));
    applications = applications.map(a => {
      const full = byId.get(a.student_user_id) || null;
      // Expose only review-safe profile fields to the owner (same set as before).
      const applicant = full ? { user_id: full.user_id, display_name: full.display_name, headline: full.headline, school_name: full.school_name, graduation_year: full.graduation_year, skills: full.skills, avatar_url: full.avatar_url, identity_verified: full.identity_verified } : null;
      // A5: the SAME explainable card the student saw — fresh fit for THIS project, computed
      // server-side (reasons + >=1 concern + recommended approach). Decision support only.
      const project = projectById.get(a.project_id);
      const fit = (full && project) ? computeFitScore(project, full) : null;
      // P1: never a bare number — the owner sees value + evidence tier + uncertainty band.
      const fitWithBand = fit ? { ...fit, presentation: presentScore(fit.score, studentEvidenceTier(full)) } : null;
      return { ...a, applicant, fit: fitWithBand };
    });
  }
  const studentDirectory = profile.role === 'company'
    ? await checked(supabase.from('member_profiles').select('user_id,display_name,school_name,headline,bio,skills,graduation_year,updated_at,identity_verified,verticals,work_types,avatar_url,skill_signals').eq('role', 'student').eq('portfolio_visibility', 'members').order('updated_at', { ascending: false }).limit(100))
    : [];
  const messages = projectIds.length
    ? await checked(supabase.from('project_messages').select('*').in('project_id', projectIds).order('created_at', { ascending: true }).limit(500))
    : [];
  const verifiedCount = projects.filter(project => project.status === 'complete').length;
  const [walletBalance, creditLedger, projectRequests, batches, batchAccess, batchAdmitted] = await Promise.all([
    creditBalance(member), loadCreditLedger(member), loadProjectRequests(member), loadBatches(member), loadBatchAccess(member), loadBatchAdmittedCounts(member),
  ]);
  return { user, profile, projects, opportunities: [], applications, studentDirectory, intakes, messages, verifiedCount, walletBalance, creditLedger, projectRequests, batches, batchAccess, batchAdmitted, batchBriefs: BATCH_CATALOG.map(batchBrief), identityEnabled , briefMeteringEnabled, briefFee , platformFeeRate: PLATFORM_FEE_RATE };
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
  if (input.emailOptOut !== undefined) row.email_opt_out = input.emailOptOut === true;
  // Spotlight is an EXPLICIT opt-in (higher bar than portfolio visibility). Only touch the
  // column when provided so saves keep working before the spotlight migration.
  if (input.spotlightConsent !== undefined) row.spotlight_consent = input.spotlightConsent === true;
  // Startup work-style prefs (optional). Only touch the column when provided, so onboarding
  // keeps working before the startup_fit migration is applied.
  if (input.workStyle !== undefined) row.work_style = cleanWorkStyle(input.workStyle);
  return checked(supabase.from('member_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single(), null);
}

// ---- Credits. 1 credit = $1. Public posts are free; a hyper-narrow (vertical +
// work-type + referred students) post costs a reach fee. The platform fee is 10% of the
// listed amount charged ON TOP, so the student always receives the full listed amount.
export const REACH_FEE_TARGETED = 25;
// One configurable constant, charged ON TOP of the listed amount so the student always
// receives the full listed credits. 10% -> 15% is a single env var (COVENDA_PLATFORM_FEE_RATE),
// with the code default as the fallback. Exposed to the client via the dashboard payload so
// the cost the buyer sees can never drift from what the server charges.
export const PLATFORM_FEE_RATE = (() => { const r = Number(process.env.COVENDA_PLATFORM_FEE_RATE); return Number.isFinite(r) && r >= 0 && r <= 1 ? r : 0.10; })();
// Credits are bought in any amount the buyer chooses (min/max bounded). 1 credit = $1 of value;
// the volume discount lives in the price, never in extra credits. Tiers match the old bundles:
// under 500 = full price, 500+ = 5% off, 1000+ = 10% off. One source of truth for the UI, the
// checkout, the webhook, and the tests.
export const CREDIT_MIN = 50;
export const CREDIT_MAX = 100_000;
export function creditUnitRate(credits) {
  const n = Number(credits) || 0;
  if (n >= 1000) return 0.90;
  if (n >= 500) return 0.95;
  return 1.00;
}
// Price in whole cents for a given credit count. Throws (user-facing) if out of range so the
// checkout/webhook/grant all reject the same way and never charge an unbounded amount.
export function creditPriceCents(credits) {
  const n = Math.round(Number(credits) || 0);
  if (!Number.isFinite(n) || n < CREDIT_MIN || n > CREDIT_MAX) {
    throw new Error(`Choose between ${CREDIT_MIN} and ${CREDIT_MAX.toLocaleString()} credits.`);
  }
  return Math.round(n * creditUnitRate(n) * 100);
}

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
  const priceUsd = creditPriceCents(bundle) / 100;
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
  // Payout eligibility gate: only identity-verified members who are 18+ can receive money.
  // Messages start with "Please"/"Only" so the handler surfaces them as user-facing 400s.
  const identity = await checked(
    member.supabase.from('member_profiles').select('identity_verified,identity_18plus').eq('user_id', member.user.id).maybeSingle(),
    null,
  );
  if (!identity?.identity_verified) throw new Error('Please verify your identity before requesting a payout.');
  if (!identity.identity_18plus) throw new Error('Only verified members who are 18 or older can receive payouts.');
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
  const created = await checked(
    member.supabase.from('payout_requests').insert({ user_id: member.user.id, credits, method, handle }).select('*').single(),
    null,
  );
  // Best-effort: alert the operator inbox so payouts don't sit unseen. Use the member's email
  // as the identifier (no extra query — the operator can look up the profile from there).
  await notifyOperatorEvent({
    idempotencyKey: `covenda-payout-${created?.id || member.user.id}`,
    build: ({ to, from, adminUrl }) => payoutRequestedEmail({ to, from, memberName: member.user.email, credits, method, adminUrl }),
  });
  return created;
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
    // Project Engine fields (nullable; persisted with the brief for the opportunity record).
    opportunityType: ['project', 'internship', 'part_time', 'research'].includes(brief.opportunityType) ? brief.opportunityType : 'project',
    complexityRating: Number.isInteger(brief.complexityRating) && brief.complexityRating >= 1 && brief.complexityRating <= 5 ? brief.complexityRating : null,
    ambiguityRating: Number.isInteger(brief.ambiguityRating) && brief.ambiguityRating >= 1 && brief.ambiguityRating <= 5 ? brief.ambiguityRating : null,
    founderTimeMinWeek: Number.isInteger(brief.founderTimeMinWeek) && brief.founderTimeMinWeek > 0 ? Math.min(brief.founderTimeMinWeek, 600) : null,
  };
}

// §5 fit score: a per-project↔student compatibility signal (NEVER a universal student
// rating). Transparent, tunable weights over legitimate signals only — no protected attributes
// or proxies (e.g. school prestige is deliberately excluded; the fairness-invariance test
// enforces it). This is decision SUPPORT — the company always decides — and is explainable:
// every score ships with reasons, at least one concern, and a recommended approach. Rule-based,
// not a predictive/learned model.
export const SCORER_VERSION = 'fit-2.0.0';
// Weights cap at 100. startupFit > skills on purpose: for an ambiguous startup, environment fit
// should be able to outrank raw skill (the adversarial case in the eval harness). Tunable via
// the ablation test — evidence, not intuition.
export const FIT_WEIGHTS = { vertical: 29, workType: 24, startupFit: 18, skills: 16, execution: 6, compensation: 4, deadline: 3 };

// Startup environment ↔ student work-style dimensions. Missing data on either side is skipped
// (never lowers a score). No protected attributes appear here.
const ENV_DIMS = [['env_structure', 'structure'], ['env_autonomy', 'autonomy'], ['env_pace', 'pace'], ['env_stage', 'stage']];
export const WORK_STYLE_ENUMS = { structure: ['structured', 'ambiguous'], autonomy: ['guided', 'independent'], pace: ['steady', 'fast'], stage: ['idea', 'seed', 'growth'] };
export function cleanWorkStyle(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const [k, allowed] of Object.entries(WORK_STYLE_ENUMS)) {
    if (typeof value[k] === 'string' && allowed.includes(value[k])) out[k] = value[k];
  }
  return Object.keys(out).length ? out : null;
}
function startupFitReason(matchMap) {
  const bits = [matchMap.structure, matchMap.autonomy].filter(Boolean);
  return bits.length ? `Thrives in ${bits.join(', ')} settings` : 'Work-style fits this environment';
}
function recommendApproach(project) {
  const s = project.env_structure, a = project.env_autonomy, p = project.env_pace;
  if (s === 'ambiguous' && a === 'independent') return 'Give a broad objective and a weekly checkpoint — this student can run with ambiguity.';
  if (s === 'structured') return 'Hand over a clearly scoped brief with explicit acceptance criteria.';
  if (a === 'guided') return 'Plan a short daily or twice-weekly check-in.';
  if (p === 'fast') return 'Set a tight first milestone to confirm the pace fits.';
  return 'Start with a bounded, reviewable deliverable and a named reviewer.';
}

// context (optional): { completedCount, positiveOutcomes } — the ranked student's own proven
// track record, used for the execution dimension with a cold-start guard.
export function computeFitScore(project, profile, context = {}) {
  const reasons = [];
  const concerns = [];
  const pV = new Set(profile?.verticals || []);
  const pW = new Set(profile?.work_types || []);
  const pS = new Set((profile?.skills || []).map(s => String(s).toLowerCase().trim()).filter(Boolean));
  const everything = pV.has('Not sure yet — show me everything');
  const projV = project.verticals || [];
  const projW = project.work_types || [];
  const projS = (project.desired_skills ? String(project.desired_skills).split(/[,\n]/) : []).map(s => s.toLowerCase().trim()).filter(Boolean);
  let score = 0;
  if (projV.length && (everything || projV.some(v => pV.has(v)))) {
    score += FIT_WEIGHTS.vertical;
    reasons.push(everything ? 'Open to every vertical' : `Matches your vertical (${projV.find(v => pV.has(v)) || projV[0]})`);
  }
  const wMatches = projW.filter(w => pW.has(w));
  if (projW.length && wMatches.length) { score += FIT_WEIGHTS.workType; reasons.push(`Your work type: ${wMatches.slice(0, 2).join(', ')}`); }
  const sMatches = projS.filter(s => pS.has(s));
  if (projS.length && sMatches.length) { score += Math.round(FIT_WEIGHTS.skills * Math.min(1, sMatches.length / projS.length)); reasons.push(`${sMatches.length} skill${sMatches.length > 1 ? 's' : ''} in common`); }
  const sMissing = projS.filter(s => !pS.has(s));
  if (projS.length && sMissing.length) concerns.push(`Limited evidence in ${sMissing.slice(0, 2).join(', ')} yet`);

  // Startup-Fit: work-style prefs vs the project environment. Missing data is skipped; a
  // mismatch adds a concern but no penalty beyond the un-earned points.
  const ws = (profile?.work_style && typeof profile.work_style === 'object') ? profile.work_style : {};
  let sfConsidered = 0, sfMatched = 0; const sfMatchMap = {};
  for (const [envKey, wsKey] of ENV_DIMS) {
    const env = project[envKey]; const pref = ws[wsKey];
    if (!env || !pref) continue;
    sfConsidered++;
    if (env === pref) { sfMatched++; sfMatchMap[wsKey] = env; }
    else concerns.push(`Prefers ${pref}; this role is ${env}`);
  }
  if (sfConsidered) {
    score += Math.round(FIT_WEIGHTS.startupFit * (sfMatched / sfConsidered));
    if (sfMatched) reasons.push(startupFitReason(sfMatchMap));
  }

  // Execution: the student's own proven track record, with a cold-start guard. Under 2 completed
  // projects contributes nothing (no penalty) and says so honestly — the flywheel starts here.
  const completed = Number(context?.completedCount) || 0;
  const positive = Number(context?.positiveOutcomes) || 0;
  if (completed >= 2) {
    score += Math.round(FIT_WEIGHTS.execution * Math.min(1, completed / 3));
    reasons.push(`Proven execution — ${completed} completed project${completed > 1 ? 's' : ''}${positive ? `, ${positive} advanced further` : ''}`);
  } else {
    reasons.push('New to Covenda — execution unproven');
  }

  // Opportunity requirements as HONEST soft signals for the student's view (the operator
  // matcher enforces them as hard filters). Evidence-based only — never degree/major/location.
  if (project.experience_requirement && project.experience_requirement !== 'none') {
    const meets = completed >= 1;
    if (meets) reasons.push('Meets the prior-experience bar with your completed work');
    else concerns.push('Asks for prior experience — a work-trial is how you build that record');
  }
  if (project.referral_requirement === 'required') concerns.push('A staked referral is required to be considered');
  else if (project.referral_requirement === 'preferred') reasons.push('A referral helps here, but is not required');

  const credits = Number(project.credits_listed) || 0;
  if (credits > 0) { score += FIT_WEIGHTS.compensation; reasons.push(`Pays ${credits.toLocaleString()} credits`); }
  if (project.target_date) { const due = new Date(project.target_date); if (!Number.isNaN(due.getTime()) && due.getTime() > Date.now()) score += FIT_WEIGHTS.deadline; }

  if (!concerns.length) concerns.push('No major concern flagged — still your call to confirm fit.');
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    concerns,
    recommendedApproach: recommendApproach(project),
    scorerVersion: SCORER_VERSION,
  };
}

// Rank open opportunities by fit score. `matched` (vertical or work-type overlap) is kept for
// the existing badge + matchedCount. A student who picked "show me everything" matches every
// vertical.
// context (optional): { completedCount, positiveOutcomes } for the student, feeding the
// execution dimension. Now emits fitConcerns + fitApproach too so the UI card is explainable.
// P1 hardening: the tier a student's displayed scores carry, derived only from VERIFIED
// evidence available at the call site — completed Covenda projects are trial-tier (gold),
// analyzed GitHub history is artifact-tier (bronze), everything else is self-reported.
export function studentEvidenceTier(profile, completedCount = 0) {
  if (Number(completedCount) > 0) return 'gold';
  const github = profile && profile.skill_signals && profile.skill_signals.github;
  if (Array.isArray(github) && github.length) return 'bronze';
  return 'self_reported';
}

export function rankOpportunities(opportunities, profile, context = {}) {
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
    .map(project => { const fit = computeFitScore(project, profile, context); return { ...project, matched: isMatch(project), fitScore: fit.score, fitPresentation: presentScore(fit.score, studentEvidenceTier(profile, context.completedCount)), fitReasons: fit.reasons, fitConcerns: fit.concerns, fitApproach: fit.recommendedApproach }; })
    .sort((a, b) => b.fitScore - a.fitScore || Number(b.matched) - Number(a.matched));
}

// A4 — Talent Readiness Assessment: a free, explainable company diagnostic (lead-gen).
// Pure + versioned; decision-support, NEVER a gate — low scores come with how-to-fix reasons,
// and the next step is always an invitation. No protected attributes; no I/O.
export const READINESS_VERSION = 'readiness-1.0.0';
export function computeReadinessScore(intake = {}) {
  const goal = String(intake.goal || '').trim();
  const blocked = String(intake.blocked || '').trim();
  const skills = (Array.isArray(intake.skills) ? intake.skills : String(intake.skills || '').split(/[,\n]/))
    .map(s => String(s).trim()).filter(Boolean);
  const supervision = Number(intake.supervisionHoursWeekly);
  const weeks = Number(intake.projectWeeks);
  const budget = Number(intake.budgetCents ?? intake.budget);
  const hire = intake.hireIntent === true || intake.hireIntent === 'yes';
  const needsAccess = intake.systemsAccess === true || intake.systemsAccess === 'yes';
  const sub = () => ({ score: 0, reasons: [], concerns: [] });
  const clarity = sub(), access = sub(), suitability = sub();

  // Project clarity — can this be scoped into a bounded deliverable?
  if (goal.length >= 40) { clarity.score += 45; clarity.reasons.push('The goal is specific enough to scope'); }
  else if (goal) { clarity.score += 20; clarity.concerns.push('Sharpen the goal — one sentence on what a useful finish unlocks'); }
  else clarity.concerns.push('Describe the goal — what would a finished result let your team do?');
  if (blocked) { clarity.score += 30; clarity.reasons.push('You can name what is blocked — that anchors the deliverable'); }
  else clarity.concerns.push('Name what is currently blocked or delayed');
  if (skills.length) { clarity.score += 25; clarity.reasons.push(`Skills are identified (${skills.slice(0, 3).join(', ')})`); }
  else clarity.concerns.push('List the skills you think the work needs — Covenda refines them with you');

  // Talent accessibility — can a student actually succeed here?
  if (Number.isFinite(supervision) && supervision > 0) {
    access.score += 40; access.reasons.push(`${supervision} hr/week of review time is available`);
    if (supervision > 5) access.concerns.push('More than ~5 hrs/week of supervision usually means the scope should tighten');
  } else access.concerns.push('Plan ~30–60 min/week to review checkpoints — bounded, not babysitting');
  if (Number.isFinite(weeks) && weeks >= 1 && weeks <= 8) { access.score += 35; access.reasons.push(`A ${weeks}-week window fits a bounded work-trial`); }
  else if (Number.isFinite(weeks) && weeks > 8) { access.score += 15; access.concerns.push('Longer than 8 weeks — consider splitting into stages'); }
  else access.concerns.push('Pick a rough length — 2–6 weeks is the sweet spot');
  if (Number.isFinite(budget) && budget > 0) { access.score += 25; access.reasons.push('A budget is set'); }
  else access.concerns.push('Set a budget — fixed and agreed before any student is assigned');

  // Suitability for emerging talent — is this Stage-1 shaped?
  if (!needsAccess) { suitability.score += 40; suitability.reasons.push('No production/system access needed — Stage 1 safe'); }
  else suitability.concerns.push('Redesign so Stage 1 needs no systems access — deeper access is earned later');
  if (Number.isFinite(weeks) && weeks >= 1 && weeks <= 8) { suitability.score += 30; suitability.reasons.push('Bounded scope suits a work-trial'); }
  if (skills.length && skills.length <= 4) { suitability.score += 30; suitability.reasons.push('A focused skill set one strong student can cover'); }
  else if (skills.length > 4) { suitability.score += 10; suitability.concerns.push('Five or more skills usually means two scoped roles, not one'); }
  if (hire) suitability.reasons.push('Open to hiring after — a work-trial is the low-risk path there');

  for (const s of [clarity, access, suitability]) {
    s.score = Math.max(0, Math.min(100, Math.round(s.score)));
    if (!s.concerns.length) s.concerns.push('No major concern flagged — still your call to confirm.');
    s.presentation = presentScore(s.score, 'self_reported'); // intake answers are self-reported
  }
  const lengthLabel = Number.isFinite(weeks) && weeks > 0 ? `${Math.round(weeks)}-week` : '4–6 week';
  return {
    projectClarity: clarity,
    talentAccessibility: access,
    suitabilityForEmergingTalent: suitability,
    recommendedTalentProfile: `1 ${skills[0] || 'generalist'} student${skills[1] ? ` + 1 ${skills[1]} student` : ''}, ${lengthLabel} bounded project`,
    nextStep: 'Submit your project to Covenda',
    readinessVersion: READINESS_VERSION,
  };
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
  // Work-trial ladder: only touch access_stage when explicitly Stage 2, so default (Stage 1)
  // project creation keeps working before the access_stage migration is applied.
  if (Number(input.accessStage) === 2) row.access_stage = 2;
  // Engagement ladder rung (delta #2). 'micro' = bounded ~5-hour task, the de-risked first
  // bet. Only written when explicitly provided, so creation works before the migration.
  if (['micro', 'project_short', 'project_long', 'part_time', 'internship', 'full_time'].includes(input.engagementRung)) row.engagement_rung = input.engagementRung;

  // Talent-acquisition preferences (opportunity model). All additive + only-when-supplied, so
  // creation keeps working before the Stage-0 migration is applied. Requirements below become
  // HARD FILTERS in the operator matcher; preferences are soft signals. Protected proxies are
  // never collected (see cleanTalentPrefs).
  if (OPPORTUNITY_TYPES.has(input.opportunityType)) row.opportunity_type = input.opportunityType;
  if (REFERRAL_REQUIREMENTS.has(input.referralRequirement)) row.referral_requirement = input.referralRequirement;
  if (EXPERIENCE_REQUIREMENTS.has(input.experienceRequirement)) row.experience_requirement = input.experienceRequirement;
  const talentPrefs = cleanTalentPrefs(input);
  if (talentPrefs) row.talent_source_prefs = talentPrefs;
  if (input.founderTimeBudgetMinWeek !== undefined && Number.isFinite(Number(input.founderTimeBudgetMinWeek))) {
    row.founder_time_budget_min_week = Math.max(0, Math.min(2400, Math.round(Number(input.founderTimeBudgetMinWeek))));
  }
  if (input.complexityRating !== undefined && Number(input.complexityRating) >= 1 && Number(input.complexityRating) <= 5) row.complexity_rating = Math.round(Number(input.complexityRating));
  if (input.ambiguityRating !== undefined && Number(input.ambiguityRating) >= 1 && Number(input.ambiguityRating) <= 5) row.ambiguity_rating = Math.round(Number(input.ambiguityRating));

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

// Packet-first intake (GTM Move 1): a company responds to a Covenda-scoped packet. Accept funds
// it into a live project (escrow held, exactly like posting a priced project); decline closes it.
export async function respondToPacket(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) throw new Error('Choose a valid packet.');
  const decision = input.decision === 'accept' ? 'accept' : input.decision === 'decline' ? 'decline' : null;
  if (!decision) throw new Error('Choose accept or decline.');
  const project = await checked(member.supabase.from('member_projects').select('id,owner_user_id,status,credits_listed').eq('id', projectId).maybeSingle(), null);
  if (!project || project.owner_user_id !== member.user.id) throw new Error('This packet is not available to your account.');
  if (project.status !== 'proposed') throw new Error('This packet has already been resolved.');
  const now = new Date().toISOString();
  if (decision === 'decline') {
    return checked(member.supabase.from('member_projects').update({ status: 'proposal_declined', updated_at: now }).eq('id', projectId).select('*').single(), null);
  }
  // Accept = fund it. Hold escrow (listed + platform fee) just like a normal priced post.
  const cost = projectCreditCost(project.credits_listed, 'public');
  if (cost.total > 0) {
    const balance = await creditBalance(member);
    if (balance < cost.total) throw new Error(`Accepting this packet needs ${cost.total} credits (${cost.listed} listed + ${cost.platformFee} platform fee) but your balance is ${balance}. Buy credits first.`);
  }
  const accepted = await checked(
    member.supabase.from('member_projects').update({ status: 'open', visibility: 'members', targeting: 'public', credits_held: cost.listed, platform_fee_credits: cost.platformFee, updated_at: now }).eq('id', projectId).select('*').single(),
    null,
  );
  if (cost.listed + cost.platformFee > 0) {
    await checked(member.supabase.from('credit_ledger').insert([
      { user_id: member.user.id, entry_type: 'escrow_hold', credits: -(cost.listed + cost.platformFee), project_id: projectId, note: `Escrow (packet): ${cost.listed} listed + ${cost.platformFee} platform fee` },
    ]).select('id'), []);
  }
  return accepted;
}

// Accept only an http(s) URL (for video/demonstration links); reject anything else so a
// stored "link" can never be a javascript:/data: surprise.
function cleanUrl(value) {
  const s = cleanText(value, 500);
  if (!s) return null;
  try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') ? u.toString() : null; } catch { return null; }
}
// §9 verified partners: a founder-confirmed allowlist of endorsement codes → partner name,
// set as COVENDA_VERIFIED_PARTNERS="REF-1042:Prof. Lee @ Columbia,CORE-01:CORE Club". A student
// who cites a matching code gets a REAL "Covenda-certified" endorsement; anything else stays
// pending — the credential can never be self-asserted.
export function verifiedPartnersFromEnv(env = process.env) {
  const map = new Map();
  for (const pair of String(env.COVENDA_VERIFIED_PARTNERS || '').split(',')) {
    const idx = pair.indexOf(':');
    if (idx < 0) continue;
    const code = cleanText(pair.slice(0, idx), 60).toUpperCase();
    const name = cleanText(pair.slice(idx + 1), 160);
    if (code && name) map.set(code, name);
  }
  return map;
}
// A professor/partner referral. Verified ONLY when the code matches a founder-confirmed
// partner; never fabricates an endorsed/certified status.
function cleanReferral(value, verifiedPartners) {
  const r = value && typeof value === 'object' ? value : {};
  const name = cleanText(r.name, 160);
  const code = cleanText(r.code, 60);
  if (!name && !code) return {};
  const partner = verifiedPartners && verifiedPartners.get(code.toUpperCase());
  return { name: name || partner || null, code: code || null, verified: Boolean(partner), partner: partner || null };
}
const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj?.[k]]));

// Append a lifecycle event to match_events (§5). Best-effort — a logging failure must never
// break the user's action. Runs with the service role (authorizeMember's client).
export async function logMatchEvent(member, { projectId, studentUserId, eventType, fit, features }) {
  try {
    await member.supabase.from('match_events').insert({
      project_id: projectId || null,
      student_user_id: studentUserId || null,
      event_type: eventType,
      features: features || {},
      fit_score: fit && Number.isFinite(fit.score) ? fit.score : null,
      fit_reasons: (fit && fit.reasons) || [],
    });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'match_event log failed', eventType, error: String(error?.message || error).slice(0, 200) }));
  }
}

// §6 brokered requests. A company asks Covenda to package work; an operator triages it later.
export const REQUEST_TYPES = new Set(['new_project', 'more_students', 'scope_change', 'revision', 'consult', 'question', 'specific_student']);
export async function createProjectRequest(member, input) {
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (!profile || !['company', 'university'].includes(profile.role)) throw new Error('Only company and university accounts can request work.');
  const requestType = cleanText(input.requestType, 40);
  if (!REQUEST_TYPES.has(requestType)) throw new Error('Choose what you are requesting.');
  const details = cleanText(input.details, 5000);
  if (details.length < 10) throw new Error('Describe your request in at least 10 characters.');
  const subject = cleanText(input.subject, 200) || null;
  // Optionally tie the request to one of the caller's own projects (more students / scope / revision).
  let projectId = null;
  const rawProjectId = cleanText(input.projectId, 50);
  if (rawProjectId && PROJECT_ID_PATTERN.test(rawProjectId)) {
    const project = await checked(member.supabase.from('member_projects').select('id,owner_user_id').eq('id', rawProjectId).maybeSingle(), null);
    if (project && project.owner_user_id === member.user.id) projectId = project.id;
  }
  const row = { company_user_id: member.user.id, project_id: projectId, request_type: requestType, subject, details };
  return checked(member.supabase.from('project_requests').insert(row).select('*').single(), null);
}
export async function loadProjectRequests(member) {
  // Degrade gracefully if the table hasn't been migrated yet.
  const { data, error } = await member.supabase.from('project_requests').select('*').eq('company_user_id', member.user.id).order('created_at', { ascending: false }).limit(50);
  return error ? [] : (data || []);
}

// §13 Elite Batches. Anyone can browse open/reviewing batches; a student applies with a rich
// packet. Degrade to [] if the batches migration hasn't been applied yet.
export async function loadBatches(member) {
  const { data, error } = await member.supabase.from('batches').select('*').in('status', ['open', 'reviewing']).order('created_at', { ascending: false }).limit(50);
  return error ? [] : (data || []);
}
export async function loadBatchApplications(member) {
  const { data, error } = await member.supabase.from('batch_applications').select('*').eq('student_user_id', member.user.id).order('created_at', { ascending: false }).limit(50);
  return error ? [] : (data || []);
}
export async function applyToBatch(member, input) {
  const profile = await checked(member.supabase.from('member_profiles').select('role,verticals,work_types,skills').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'student') throw new Error('Only student accounts can apply to a batch.');
  const batchId = cleanText(input.batchId, 50);
  if (!PROJECT_ID_PATTERN.test(batchId)) throw new Error('Choose a valid batch.');
  const batch = await checked(member.supabase.from('batches').select('id,status').eq('id', batchId).maybeSingle(), null);
  if (!batch || !['open', 'reviewing'].includes(batch.status)) throw new Error('This batch is not accepting applications.');
  const existing = await checked(member.supabase.from('batch_applications').select('*').eq('batch_id', batchId).eq('student_user_id', member.user.id).maybeSingle(), null);
  if (existing) return existing;
  // Elite batches are hand-reviewed, so the application is thorough. A short motivation is
  // required; the rest is optional but strengthens the case. Snapshot everything + the profile
  // signals at apply time so review is self-contained.
  const note = cleanText(input.note, 2_000);
  if (note.length < 40) throw new Error('Tell us why this cohort fits you — a few sentences at least.');
  const hoursPerWeek = Number(input.hoursPerWeek);
  const workSamples = [input.workSample1, input.workSample2, input.demonstration]
    .map(value => cleanUrl(value)).filter(Boolean).slice(0, 3);
  const materials = {
    note,
    experience: cleanText(input.experience, 2_000) || null,
    skills: cleanList(input.skills, 20),
    availability: {
      hoursPerWeek: Number.isFinite(hoursPerWeek) && hoursPerWeek > 0 ? Math.min(Math.round(hoursPerWeek), 60) : null,
      startDate: cleanText(input.startDate, 20) || null,
    },
    workSamples,
    videoUrl: cleanUrl(input.videoUrl),
    // The prompt the student was assigned + their video answers it; store it so review is
    // self-contained (the reviewer sees which prompt they were answering).
    videoPrompt: cleanText(input.videoPrompt, 500) || null,
    // Short answers gauging genuine interest in the batch's vertical.
    interest: Array.isArray(input.interest)
      ? input.interest.slice(0, 10).map(a => ({
          id: cleanText(a?.id, 40),
          question: cleanText(a?.question, 300),
          answer: cleanText(a?.answer, 600),
        })).filter(a => a.answer)
      : [],
    resumeUrl: cleanUrl(input.resumeUrl),
    referral: cleanReferral(input.referral, verifiedPartnersFromEnv(process.env)),
    verticals: profile.verticals || [],
    workTypes: profile.work_types || [],
  };
  return checked(member.supabase.from('batch_applications').insert({ batch_id: batchId, student_user_id: member.user.id, materials }).select('*').single(), null);
}

// §13 slice 4: the student's live standing against each batch's PUBLISHED bar, computed from
// evidence that already exists — so "what do I still need?" is answerable before applying and
// the bar is something to go earn rather than a verdict handed down after review.
// Degrades to [] if skill_claim / the batches migration hasn't been applied yet.
export async function loadBatchStanding(member) {
  try {
    const [claims, trials] = await Promise.all([
      checked(member.supabase.from('skill_claim').select('skill,verification_tier,evidence_pointer,evidence_meta').eq('student_user_id', member.user.id).limit(200), []),
      checked(member.supabase.from('member_projects').select('id,status,ownership_defense').eq('assigned_user_id', member.user.id).eq('status', 'complete').limit(50), []),
    ]);
    const applicant = {
      skillClaims: claims || [],
      completedTrials: (trials || []).map(t => ({ project_id: t.id })),
      // A recorded ownership defense on any completed project counts as a defense on file.
      defenses: (trials || []).filter(t => t.ownership_defense).map(t => ({ kind: 'walkthrough' })),
      artifacts: (claims || []).filter(c => c.evidence_pointer).map(c => ({ type: 'artifact', url: c.evidence_pointer })),
      referrals: [],
      // Availability is stated on the application itself, not the profile — left undefined
      // here so the check reads as "not yet confirmed" rather than a false zero.
      availabilityHoursPerWeek: undefined,
    };
    return BATCH_CATALOG.map(batch => ({
      slug: batch.slug,
      name: batch.name,
      ...evaluateBatchAdmission(batch, applicant),
    }));
  } catch {
    return [];
  }
}



// ---- §14 student verification --------------------------------------------------------
// A six-digit code to the school address. The code is checked server-side against a stored
// row, attempts are counted, and the row is consumed on success — none of which can be
// enforced from the client.

export async function requestSchoolVerification(member, input, { env = process.env } = {}) {
  const email = normaliseEmail(input.schoolEmail);
  const check = checkSchoolEmail(email);
  if (!check.ok) throw new Error(check.reason);

  // One live code per person: a fresh request invalidates the last, so an old code in an old
  // email cannot still be used.
  await member.supabase.from('school_email_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', member.user.id).is('consumed_at', null);

  const code = generateCode();
  await checked(member.supabase.from('school_email_codes').insert({ user_id: member.user.id, email, code }).select('id').single(), null);

  const apiKey = env.RESEND_API_KEY;
  const from = env.COVENDA_NOTIFICATION_FROM;
  if (!apiKey || !from) throw new PortalOperationalError('VERIFY_EMAIL_NOT_CONFIGURED', 'Email is not configured for this deployment yet.');
  const { Resend } = await import('resend');
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email,
    subject: `Covenda verification code: ${code}`,
    text: `Your Covenda school-email verification code is ${code}. It expires in 20 minutes.\n\nThis confirms you control this address. It is not a sign-in link.`,
  });
  if (error) throw new PortalOperationalError('VERIFY_EMAIL_FAILED', 'Could not send the code. Try again shortly.');
  // The address is never echoed back in full — the client already knows it, and a response
  // that repeats it is one more place it can leak.
  return { sent: true, domain: check.domain };
}

export async function confirmSchoolVerification(member, input) {
  const record = await checked(member.supabase.from('school_email_codes')
    .select('*').eq('user_id', member.user.id).is('consumed_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle(), null);

  const verdict = checkCode(record, input.code, new Date());
  if (!verdict.ok) {
    // Count the attempt BEFORE returning, or a wrong guess is free and the limit means nothing.
    if (record && !verdict.expired) {
      await member.supabase.from('school_email_codes')
        .update({ attempts: Number(record.attempts || 0) + 1 }).eq('id', record.id);
    }
    throw new Error(verdict.reason);
  }

  const now = new Date().toISOString();
  await member.supabase.from('school_email_codes').update({ consumed_at: now }).eq('id', record.id);
  const check = checkSchoolEmail(record.email);
  await checked(member.supabase.from('member_profiles').update({
    school_email: record.email,
    school_email_domain: check.domain,
    school_email_verified_at: now,
  }).eq('user_id', member.user.id), null);
  return { verified: true, domain: check.domain, doesNotProve: check.doesNotProve };
}

// The three signals side by side, so what is MISSING is as visible as what is held.
export async function loadVerificationStanding(member) {
  try {
    const [profile, clubs] = await Promise.all([
      checked(member.supabase.from('member_profiles').select('school_email_verified_at').eq('user_id', member.user.id).maybeSingle(), null),
      checked(member.supabase.from('club_members').select('id').eq('student_user_id', member.user.id).eq('status', 'confirmed'), []),
    ]);
    return verificationStanding({
      schoolVerifiedAt: profile?.school_email_verified_at || null,
      confirmedClubs: (clubs || []).length,
      referrals: 0,
    });
  } catch {
    return verificationStanding({});
  }
}

// ---- §13 slice 7: clubs, backed by real rows ----------------------------------------
// Registration used to land in the generic submissions inbox and stop, so a club could never
// actually earn anything. These read and write public.clubs / club_members /
// club_verifications, and the COUNTS are derived from applications and outcomes rather than
// stored — a stored count is a number that drifts away from what it claims to summarise.

const CLUB_SLUG_RE = /[^a-z0-9]+/g;
function clubSlug(name, school) {
  return [name, school].filter(Boolean).join(' ').toLowerCase().replace(CLUB_SLUG_RE, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export async function registerClub(member, input) {
  const name = cleanText(input.clubName, 160);
  if (name.length < 2) throw new Error('Enter the club name.');
  const row = {
    slug: clubSlug(name, cleanText(input.school, 80)),
    name,
    school: cleanText(input.school, 120) || null,
    vertical_slug: cleanText(input.verticalSlug, 60) || null,
    contact_email: cleanEmail(input.email) || null,
    contact_role: cleanText(input.role, 80) || null,
    member_estimate: Number.isFinite(Number(input.memberCount)) ? Math.max(0, Math.round(Number(input.memberCount))) : null,
    created_by: member.user.id,
  };
  // A re-registration updates the existing club rather than creating a duplicate; officers
  // turn over every year and the second one should not fork the record.
  const existing = await checked(member.supabase.from('clubs').select('id').eq('slug', row.slug).maybeSingle(), null);
  if (existing) {
    return checked(member.supabase.from('clubs').update({ ...row, updated_at: new Date().toISOString() }).eq('id', existing.id).select('*').single(), null);
  }
  return checked(member.supabase.from('clubs').insert(row).select('*').single(), null);
}

// A student claims membership; it counts for nothing until an officer or operator confirms it.
// Without that gate anyone could attach themselves to a selective club, which would make the
// club's own screen — the thing that gives the badge its value — meaningless.
export async function claimClubMembership(member, input) {
  const clubId = cleanText(input.clubId, 50);
  if (!PROJECT_ID_PATTERN.test(clubId)) throw new Error('Choose a valid club.');
  const existing = await checked(member.supabase.from('club_members').select('*').eq('club_id', clubId).eq('student_user_id', member.user.id).maybeSingle(), null);
  if (existing) return existing;
  return checked(member.supabase.from('club_members').insert({ club_id: clubId, student_user_id: member.user.id }).select('*').single(), null);
}

// Derived standing for one club: how many CONFIRMED members were admitted to each batch, and
// how many of those went on to accepted work. Never stored — recomputed from the rows that
// actually happened, so the number and the evidence can never disagree.
export async function clubStanding(member, clubId) {
  const members = await checked(member.supabase.from('club_members').select('student_user_id').eq('club_id', clubId).eq('status', 'confirmed'), []);
  const ids = members.map(m => m.student_user_id).filter(Boolean);
  const club = await checked(member.supabase.from('clubs').select('id,name,slug,vertical_slug').eq('id', clubId).maybeSingle(), null);
  if (!club || !ids.length) {
    return { club, byBatch: [], confirmedMembers: ids.length };
  }
  const apps = await checked(member.supabase.from('batch_applications').select('batch_id,student_user_id,status').in('student_user_id', ids), []);
  const admitted = apps.filter(a => a.status === 'accepted');
  const batchIds = [...new Set(admitted.map(a => a.batch_id))];
  const batches = batchIds.length
    ? await checked(member.supabase.from('batches').select('id,slug,name').in('id', batchIds), [])
    : [];
  const completed = await checked(
    member.supabase.from('member_projects').select('assigned_user_id,completed_at,conversion_outcome')
      .in('assigned_user_id', ids).not('completed_at', 'is', null), []);
  const acceptedBy = new Set(completed.filter(p => p.conversion_outcome !== 'rejected').map(p => p.assigned_user_id));

  const byBatch = batches.map(batch => {
    const inBatch = admitted.filter(a => a.batch_id === batch.id).map(a => a.student_user_id);
    return evaluateClubVerification({
      clubId: club.id,
      clubName: club.name,
      batchSlug: batch.slug,
      admittedCount: inBatch.length,
      acceptedWorkCount: inBatch.filter(id => acceptedBy.has(id)).length,
    });
  });
  return { club, byBatch, confirmedMembers: ids.length };
}

// What a member carries into an application: the club's standing in THAT batch, and nothing
// more. A badge never satisfies a requirement, because the club did not do the work.
export async function clubBadgeFor(member, studentUserId, batchSlug) {
  const rows = await checked(member.supabase.from('club_members').select('club_id').eq('student_user_id', studentUserId).eq('status', 'confirmed'), []);
  if (!rows.length) return null;
  for (const row of rows) {
    const standing = await clubStanding(member, row.club_id);
    const hit = (standing.byBatch || []).find(b => b.batchSlug === batchSlug && b.tier);
    if (hit) return memberStanding(hit);
  }
  return null;
}

// ---- §13 slice 3: company credit-gated access to a batch's admitted students. ----
// Which batches this company has unlocked (id + what it paid), so the UI can gate rosters.
export async function loadBatchAccess(member) {
  const { data, error } = await member.supabase
    .from('batch_access')
    .select('batch_id,credits_spent,granted_at')
    .eq('company_user_id', member.user.id);
  return error ? [] : (data || []);
}

// How many admitted (accepted) students each open/reviewing batch has, so a company can judge
// a roster's size before paying. Counted client-side (one flat read, no group-by rpc needed).
export async function loadBatchAdmittedCounts(member) {
  const { data, error } = await member.supabase
    .from('batch_applications')
    .select('batch_id')
    .eq('status', 'accepted');
  if (error) return {};
  const counts = {};
  for (const row of data || []) counts[row.batch_id] = (counts[row.batch_id] || 0) + 1;
  return counts;
}

// Charge the company the batch's access price and record access. The whole fee is platform
// revenue (no student payout, so no fee-on-top split). Idempotent: an already-unlocked batch
// is never charged twice, and the unique(batch_id, company_user_id) constraint blocks races
// BEFORE any ledger row is written.
export async function unlockBatch(member, input) {
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'company') throw new Error('Only company accounts can unlock a batch.');
  const batchId = cleanText(input.batchId, 50);
  if (!PROJECT_ID_PATTERN.test(batchId)) throw new Error('Choose a valid batch.');
  const batch = await checked(member.supabase.from('batches').select('id,name,status,access_credits').eq('id', batchId).maybeSingle(), null);
  if (!batch || !['open', 'reviewing'].includes(batch.status)) throw new Error('This batch is not available.');
  const existing = await checked(member.supabase.from('batch_access').select('id').eq('batch_id', batchId).eq('company_user_id', member.user.id).maybeSingle(), null);
  if (existing) return { alreadyUnlocked: true, balance: await creditBalance(member) };
  const price = Math.max(0, Math.round(Number(batch.access_credits) || 0));
  const balance = await creditBalance(member);
  if (price > 0 && balance < price) throw new Error(`You need ${price} credits to unlock this batch. Top up in your wallet.`);
  // Record access first — the unique constraint is the race guard, and it fires before any charge.
  const { data: access, error: accessError } = await member.supabase
    .from('batch_access')
    .insert({ batch_id: batchId, company_user_id: member.user.id, credits_spent: price })
    .select('*')
    .single();
  if (accessError) {
    if (/duplicate|unique/i.test(accessError.message || '')) return { alreadyUnlocked: true, balance: await creditBalance(member) };
    throw accessError;
  }
  if (price > 0) {
    const note = `Batch access: ${batch.name}`.slice(0, 500);
    await checked(member.supabase.from('credit_ledger').insert([
      { user_id: member.user.id, entry_type: 'batch_access', credits: -price, note },
      { user_id: null, entry_type: 'batch_access', credits: price, note },
    ]).select('id'), []);
  }
  return { access, balance: await creditBalance(member) };
}

// The admitted roster for a batch the company has unlocked. Gated on batch_access existing.
export async function loadBatchRoster(member, input) {
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'company') throw new Error('Only company accounts can view a batch roster.');
  const batchId = cleanText(input.batchId, 50);
  if (!PROJECT_ID_PATTERN.test(batchId)) throw new Error('Choose a valid batch.');
  const access = await checked(member.supabase.from('batch_access').select('id').eq('batch_id', batchId).eq('company_user_id', member.user.id).maybeSingle(), null);
  if (!access) throw new Error('Unlock this batch to view its admitted students.');
  const apps = await checked(member.supabase.from('batch_applications').select('student_user_id,materials').eq('batch_id', batchId).eq('status', 'accepted'), []);
  const studentIds = [...new Set(apps.map(a => a.student_user_id).filter(Boolean))];
  if (!studentIds.length) return [];
  const profiles = await checked(member.supabase.from('member_profiles').select('user_id,display_name,school_name,headline,bio,skills,graduation_year,verticals,work_types,avatar_url,identity_verified').in('user_id', studentIds), []);
  const materialsById = new Map(apps.map(a => [a.student_user_id, a.materials || {}]));
  return profiles.map(p => ({ ...p, batchMaterials: materialsById.get(p.user_id) || {} }));
}

export async function applyToProject(member, input, env = process.env) {
  const projectId = cleanText(input.projectId, 50);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) throw new Error('Choose a valid project.');
  const profile = await checked(member.supabase.from('member_profiles').select('role,display_name,verticals,work_types,skills').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'student') throw new Error('Only student accounts can apply to projects.');
  const project = await checked(member.supabase.from('member_projects').select('id,title,owner_user_id,status,visibility,verticals,work_types,desired_skills,credits_listed,target_date').eq('id', projectId).maybeSingle(), null);
  if (!project || project.status !== 'open' || !['members', 'open'].includes(project.visibility)) throw new Error('This project is not accepting applications.');
  const existing = await checked(
    member.supabase.from('project_applications').select('*').eq('project_id', projectId).eq('student_user_id', member.user.id).maybeSingle(),
    null,
  );
  if (existing) return existing;
  // Snapshot the fit at apply time so the reviewer and the audit log agree.
  const fit = computeFitScore(project, profile);
  const baseRow = { project_id: projectId, student_user_id: member.user.id, note: cleanText(input.note, 2_000) || null, updated_at: new Date().toISOString() };
  const richRow = {
    ...baseRow,
    video_url: cleanUrl(input.videoUrl),
    skills: cleanList(input.skills, 20),
    demonstration: cleanUrl(input.demonstration) || cleanText(input.demonstration, 500) || null,
    referral: cleanReferral(input.referral, verifiedPartnersFromEnv(env)),
    fit_score: fit.score,
    fit_reasons: fit.reasons,
  };
  // If the rich-application migration hasn't been applied yet, the extra columns don't exist —
  // fall back to the base insert so a student can always apply; the fields fill in once it runs.
  let { data: application, error } = await member.supabase.from('project_applications').insert(richRow).select('*').single();
  if (error) ({ data: application, error } = await member.supabase.from('project_applications').insert(baseRow).select('*').single());
  if (error) throw error;
  await logMatchEvent(member, { projectId, studentUserId: member.user.id, eventType: 'applied', fit, features: { project: pick(project, ['verticals', 'work_types', 'desired_skills', 'credits_listed']), student: pick(profile, ['verticals', 'work_types', 'skills']) } });
  // Best-effort: tell the project owner a new applicant arrived. Never blocks the application.
  await notifyMember(member.supabase, {
    toUserId: project.owner_user_id,
    idempotencyKey: `covenda-applied-${application.id}`,
    build: ({ to, from, portalUrl }) => applicationReceivedEmail({ to, from, projectTitle: project.title, studentName: profile.display_name, portalUrl }),
    env,
  });
  return application;
}

export async function sendProjectMessage(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) throw new Error('Choose a valid project conversation.');
  const body = cleanText(input.message, 4_000);
  const attachments = cleanAttachments(input.attachments);
  if (!body && !attachments.length) throw new Error('Write a message or attach a file before sending.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,assigned_student_user_id').eq('id', projectId).maybeSingle(),
    null,
  );
  const hasAccess = project && (project.owner_user_id === member.user.id || project.assigned_student_user_id === member.user.id);
  if (!hasAccess) throw new Error('This project conversation is not available to your account.');
  const row = { project_id: projectId, author_user_id: member.user.id, body, attachments };
  return checked(member.supabase.from('project_messages').insert(row).select('*').single(), null);
}

// Pin/unpin a message so a scope note or milestone stays at the top of the thread. Any
// participant (owner or assigned student) can toggle; access is re-checked via the parent project.
export async function pinProjectMessage(member, input) {
  const messageId = cleanText(input.messageId, 50);
  if (!PROJECT_ID_PATTERN.test(messageId)) throw new Error('Choose a valid message.');
  const message = await checked(member.supabase.from('project_messages').select('id,project_id,pinned').eq('id', messageId).maybeSingle(), null);
  if (!message) throw new Error('This message is no longer available.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,assigned_student_user_id').eq('id', message.project_id).maybeSingle(),
    null,
  );
  const hasAccess = project && (project.owner_user_id === member.user.id || project.assigned_student_user_id === member.user.id);
  if (!hasAccess) throw new Error('This project conversation is not available to your account.');
  const pinned = input.pinned !== undefined ? input.pinned === true : !message.pinned;
  return checked(
    member.supabase.from('project_messages').update({ pinned, pinned_at: pinned ? new Date().toISOString() : null }).eq('id', messageId).select('*').single(),
    null,
  );
}

// §4c live messages: return messages across the caller's projects (owner or assigned) newer
// than `since`. Lightweight enough to poll every ~9s; the client merges/dedupes by id.
export async function loadNewMessages(member, input) {
  const [owned, assigned] = await Promise.all([
    checked(member.supabase.from('member_projects').select('id').eq('owner_user_id', member.user.id), []),
    checked(member.supabase.from('member_projects').select('id').eq('assigned_student_user_id', member.user.id), []),
  ]);
  const projectIds = [...new Set([...owned, ...assigned].map(p => p.id))];
  if (!projectIds.length) return { messages: [] };
  let query = member.supabase.from('project_messages').select('*').in('project_id', projectIds).order('created_at', { ascending: true }).limit(200);
  const since = cleanText(input.since, 40);
  if (since && !Number.isNaN(new Date(since).getTime())) query = query.gt('created_at', since);
  return { messages: await checked(query, []) };
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
    member.supabase.from('member_projects').select('*').eq('id', application.project_id).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can accept an applicant.');
  if (!['open', 'matched'].includes(project.status)) throw new Error('This project is not open for accepting an applicant.');
  // Work-trial ladder: a Stage 2 project (deeper access) can only go to a student who has already
  // completed a Stage 1 work-trial with THIS company — proof precedes access. Projects with no
  // access_stage column/value are Stage 1, so this never changes behaviour until Stage 2 is used.
  if (Number(project.access_stage) >= 2) {
    const prior = await checked(
      member.supabase.from('member_projects').select('id').eq('owner_user_id', member.user.id).eq('assigned_student_user_id', application.student_user_id).eq('status', 'complete').limit(1),
      [],
    );
    if (!prior.length) throw new Error('This is a Stage 2 project (deeper access). This student has not completed a Stage 1 work-trial with you yet — proof precedes access.');
  }
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
  await logMatchEvent(member, { projectId: project.id, studentUserId: application.student_user_id, eventType: 'accepted', fit: { score: accepted.fit_score, reasons: accepted.fit_reasons } });
  // Best-effort: tell the accepted student. (The cascade-declined applicants are intentionally
  // not emailed here to avoid a burst; an explicit decline still notifies — see declineApplication.)
  await notifyMember(member.supabase, {
    toUserId: application.student_user_id,
    idempotencyKey: `covenda-accepted-${application.id}`,
    build: ({ to, from, portalUrl }) => applicationDecisionEmail({ to, from, projectTitle: project.title, accepted: true, portalUrl }),
  });
  return accepted;
}

export async function declineApplication(member, input) {
  const applicationId = cleanText(input.applicationId, 50);
  if (!PROJECT_ID_PATTERN.test(applicationId)) throw new Error('Choose a valid application.');
  const application = await checked(
    member.supabase.from('project_applications').select('id,project_id,student_user_id,status,fit_score,fit_reasons').eq('id', applicationId).maybeSingle(),
    null,
  );
  if (!application) throw new Error('This application is no longer available.');
  const project = await checked(member.supabase.from('member_projects').select('id,title,owner_user_id').eq('id', application.project_id).maybeSingle(), null);
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can decline an applicant.');
  if (!['submitted', 'reviewing', 'shortlisted'].includes(application.status)) throw new Error('This application has already been resolved.');
  const declined = await checked(
    member.supabase.from('project_applications').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', applicationId).select('*').single(),
    null,
  );
  await logMatchEvent(member, { projectId: project.id, studentUserId: application.student_user_id, eventType: 'declined', fit: { score: application.fit_score, reasons: application.fit_reasons } });
  // Best-effort: a gentle "not this one" to the student on an explicit decline.
  await notifyMember(member.supabase, {
    toUserId: application.student_user_id,
    idempotencyKey: `covenda-declined-${application.id}`,
    build: ({ to, from, portalUrl }) => applicationDecisionEmail({ to, from, projectTitle: project.title, accepted: false, portalUrl }),
  });
  return declined;
}

// A student can withdraw an application that has not been accepted. The row is removed so
// they can cleanly re-apply later (the unique (project, student) constraint would otherwise
// block a fresh application); the 'applied' match event stays as the audit trail.
export async function deleteApplication(member, input) {
  const applicationId = cleanText(input.applicationId, 50);
  if (!PROJECT_ID_PATTERN.test(applicationId)) throw new Error('Choose a valid application.');
  const application = await checked(
    member.supabase.from('project_applications').select('id,student_user_id,status').eq('id', applicationId).maybeSingle(),
    null,
  );
  if (!application || application.student_user_id !== member.user.id) throw new Error('Only the applicant can withdraw this application.');
  if (application.status === 'accepted') throw new Error('This application was accepted — message the company to step back from the project instead.');
  await checked(
    member.supabase.from('project_applications').delete().eq('id', applicationId).eq('student_user_id', member.user.id),
    null,
  );
  return { id: applicationId, withdrawn: true };
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

  if (decision === 'revise') {
    // No credit movement — the escrow stays held while the student reworks it.
    return checked(
      member.supabase.from('member_projects').update({ status: 'in_progress', review_note: note, updated_at: now }).eq('id', projectId).select('*').single(),
      null,
    );
  }

  // Accepting settles money, so the ledger writes and the status change must commit
  // together. The database function does both under a row lock; if it fails, nothing
  // moves and the project stays in review rather than completing unpaid.
  if (note) {
    await checked(member.supabase.from('member_projects').update({ review_note: note, updated_at: now }).eq('id', projectId).select('id').single(), null);
  }
  const released = await checked(member.supabase.rpc('release_project_escrow', { p_project_id: projectId, p_owner_id: member.user.id }), null);
  return Array.isArray(released) ? released[0] : released;
}

// Conversion tracking: what a completed project led to. Owner records it; this is the
// signal that a project became a hire — the highest-value outcome Covenda produces —
// captured now so a placement fee can be priced on real numbers later.
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
    member.supabase.from('member_projects').update({ conversion_outcome: outcome, conversion_note: cleanText(input.note, 500) || null, conversion_recorded_at: now, updated_at: now }).eq('id', projectId).select('*').single(),
    null,
  );
}

// Cancelling before completion returns the held escrow to the company. Same atomicity
// requirement as the release, so it also runs as a database function.
export async function cancelProject(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,status').eq('id', projectId).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can cancel a project.');
  if (['complete', 'archived'].includes(project.status)) throw new Error('This project is already finished.');
  const refunded = await checked(member.supabase.rpc('refund_project_escrow', { p_project_id: projectId, p_owner_id: member.user.id }), null);
  return Array.isArray(refunded) ? refunded[0] : refunded;
}

// A company can delete a project only while it is still a private draft — nothing is posted,
// so there is no escrow to refund and no applicant to strand. An active project must be ended
// with cancel-project (cancelProject), which refunds the held escrow through the DB function.
export async function deleteProject(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,status,credits_held,platform_fee_credits').eq('id', projectId).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can delete a project.');
  if (project.status !== 'draft') throw new Error('Only a draft can be deleted — end an active project instead so its escrow is refunded.');
  if (((Number(project.credits_held) || 0) + (Number(project.platform_fee_credits) || 0)) > 0) throw new Error('This draft is holding credits — end it instead so they are refunded.');
  const applicants = await checked(member.supabase.from('project_applications').select('id').eq('project_id', projectId).limit(1), []);
  if (applicants.length) throw new Error('This project already has applicants — end it instead of deleting.');
  await checked(
    member.supabase.from('member_projects').delete().eq('id', projectId).eq('owner_user_id', member.user.id),
    null,
  );
  return { id: projectId, deleted: true };
}

function portalFailure(error) {
  if (error instanceof PortalOperationalError) return { status: 503, code: error.code, message: error.publicMessage };
  const message = cleanText(error?.message, 2_000);
  if (/member_profiles|member_projects|project_applications|project_messages|submissions|schema cache|relation .* does not exist/i.test(message)) {
    return { status: 503, code: 'PORTAL_SCHEMA_MISSING', message: 'Member sign-in worked, but the portal tables are not available. Apply the newest Supabase migration to the same project used by Vercel.' };
  }
  return { status: 503, code: 'PORTAL_UNAVAILABLE', message: 'The member portal is temporarily unavailable. Check the newest /api/portal entry in Vercel Runtime Logs.' };
}

// Skill-inference: analyze a student's linked public GitHub repo into per-skill scores.
// The analysis engine (api/github.js) is deterministic + evidence-grounded; here we gate to
// students, run it, and best-effort persist into the living profile (member_profiles.skill_signals).
// Persistence is graceful: if the column isn't migrated yet, the analysis still returns for display.
export async function analyzeGithub(member, input, env = process.env) {
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'student') throw new Error('Only student accounts can analyze a GitHub repository.');
  const ref = parseRepoRef(input.repoUrl);
  if (!ref) throw new Error('Enter a valid GitHub repository URL (e.g. github.com/you/project).');
  const raw = await fetchRepoData(ref, { token: env.GITHUB_TOKEN || env.GITHUB_ANALYSIS_TOKEN || '' });
  const analysis = analyzeRepo(raw);
  try {
    const { data: existing } = await member.supabase.from('member_profiles').select('skill_signals').eq('user_id', member.user.id).maybeSingle();
    const signals = existing && existing.skill_signals && typeof existing.skill_signals === 'object' ? existing.skill_signals : {};
    const record = { repo: analysis.repo.name, url: analysis.repo.url, skills: analysis.skills, flags: analysis.flags, needsReview: analysis.needsReview, analyzedAt: new Date().toISOString() };
    const github = (Array.isArray(signals.github) ? signals.github : []).filter(g => g && g.repo !== record.repo);
    github.unshift(record);
    signals.github = github.slice(0, 20);
    const { error } = await member.supabase.from('member_profiles').update({ skill_signals: signals }).eq('user_id', member.user.id);
    analysis.persisted = !error;
  } catch { analysis.persisted = false; }
  // Proof Connector Framework — Connector A. OWNERSHIP: if the student has connected their own
  // GitHub account (connector_accounts) and its login matches this repo's owner, the claim is
  // ownership_verified; the paste path stays ownership_verified:false, honestly labelled.
  // HISTORY: the shared forensics service reads the commit timeline; a flagged (backfilled)
  // timeline routes to human review and is never auto-credited.
  let ownershipVerified = false;
  try {
    const { data: conn } = await member.supabase.from('connector_accounts')
      .select('external_login, revoked_at').eq('student_user_id', member.user.id).eq('connector_id', 'github').maybeSingle();
    if (conn && !conn.revoked_at && conn.external_login && analysis.ownerLogin
      && conn.external_login.toLowerCase() === String(analysis.ownerLogin).toLowerCase()) {
      ownershipVerified = true;
    }
  } catch { /* connector_accounts not migrated yet — treat as paste flow */ }
  const { meta, forensics } = evidenceMetaFromTimeline({ connectorId: 'github', ownershipVerified, timestamps: analysis.commitTimestamps });
  analysis.ownershipVerified = ownershipVerified;
  analysis.evidenceMeta = meta;

  // Stage 1 (profile extractor): also emit evidence-tiered skill_claim rows for the matcher.
  // Anti-gaming per the master prompt: a flagged repo (fork/one-shot) OR a forensics anomaly is
  // routed to human review and NEVER auto-credited at artifact tier — we skip claim writes for it.
  // Best-effort: before the Stage-0 migration exists this quietly no-ops.
  try {
    if (!analysis.needsReview && !forensics.anomaly && analysis.repo.url) {
      await member.supabase.from('skill_claim').delete().eq('student_user_id', member.user.id).eq('evidence_pointer', analysis.repo.url);
      const rows = analysis.skills.map(s => ({
        student_user_id: member.user.id,
        skill: s.skill,
        skill_canonical: canonicalizeSkill(s.skill).canonical,
        level: `${s.score}/10 (${s.confidence})`,
        verification_tier: 'artifact',
        evidence_pointer: analysis.repo.url,
        evidence_meta: meta,
      }));
      if (rows.length) {
        // If evidence_meta hasn't been migrated yet, retry without it so claims still land.
        let { error } = await member.supabase.from('skill_claim').insert(rows);
        if (error) await member.supabase.from('skill_claim').insert(rows.map(({ evidence_meta, ...r }) => r));
      }
    }
  } catch { /* skill_claim not migrated yet — analysis still returns for display */ }
  return analysis;
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
      // A4: free, pre-auth talent-readiness diagnostic (pure fn, no DB writes, no PII stored).
      if (input.action === 'readiness-check') return res.status(200).json({ ok: true, readiness: computeReadinessScore(input) });
      // §13 slice 4: the batch catalogue is public by design — a bar nobody can read is not a
      // published bar. Briefs carry requirements + the company evaluation walkthrough, and no
      // applicant data, weights, or connector scopes.
      if (input.action === 'batch-briefs') return res.status(200).json({
        ok: true,
        batches: BATCH_CATALOG.map(batchBrief),
        // Grouped as well as flat: the board renders by vertical, the portal by batch.
        groups: batchesByVertical().map(g => ({ ...g, batches: g.batches.map(batchBrief) })),
      });
      // Public too: a club deciding whether to register needs to see what verification takes
      // and what it earns, before handing over a single student.
      // Pre-auth: a company describes the person they need and gets the requirement card
      // back with its gaps. Pure — no DB write, nothing stored, no account needed.
      if (input.action === 'talent-requirement') return res.status(200).json({
        ok: true,
        requirement: buildTalentRequirement(input),
        taxonomy: { verticals: REQUIREMENT_VERTICALS, workTypes: REQUIREMENT_WORK_TYPES },
      });
      // The demo, per vertical. A company asking "what does this look like for us" needs
      // its own industry walked, not a generic tour — verification differs per batch.
      if (input.action === 'vertical-demo') return res.status(200).json({
        ok: true,
        demos: BATCH_CATALOG.map(b => demoForVertical(b.slug)).filter(Boolean),
      });
      if (input.action === 'club-tiers') return res.status(200).json({
        ok: true,
        tiers: VERIFICATION_TIERS,
        value: REFERRER_VALUE,
        verticals: BATCH_CATALOG.map(b => ({ slug: b.slug, name: b.name })),
        version: CLUB_VERIFICATION_VERSION,
      });
      if (input.action === 'google-login') return res.status(200).json({ ok: true, ...(await requestGoogleLogin(req, dependencies)) });
      if (input.action === 'refresh-session') return res.status(200).json({ ok: true, ...(await refreshSession(input.refreshToken, dependencies)) });
    }

    if (!['GET', 'PATCH', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }
    const member = await authorizeMember(req, dependencies);
    if (!member) return res.status(401).json({ ok: false, error: 'Member authentication is required.' });
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await loadMemberDashboard(member, dependencies.env || process.env)) });

    const input = parseBody(req);
    if (req.method === 'PATCH' && input.action === 'appeal-score') {
      const { data: appellant } = await member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle();
      if (appellant?.role !== 'student') throw new Error('Only students can contest a score.');
      const appeal = normalizeAppeal(input);
      const { data, error } = await member.supabase.from('score_appeals')
        .insert({ student_user_id: member.user.id, ...appeal }).select('id, subject, status, created_at').single();
      if (error) throw new Error('Appeals are almost ready — please try again shortly.');
      return res.status(200).json({ ok: true, appeal: data });
    }
    if (req.method === 'PATCH' && input.action === 'save-profile') return res.status(200).json({ ok: true, profile: await saveMemberProfile(member, input) });
    if (req.method === 'POST' && input.action === 'verify-school-email') return res.status(200).json({ ok: true, ...(await requestSchoolVerification(member, input, dependencies)) });
    if (req.method === 'POST' && input.action === 'confirm-school-email') return res.status(200).json({ ok: true, ...(await confirmSchoolVerification(member, input)) });
    if (req.method === 'POST' && input.action === 'register-club') return res.status(201).json({ ok: true, club: await registerClub(member, input) });
    if (req.method === 'POST' && input.action === 'claim-club') return res.status(201).json({ ok: true, membership: await claimClubMembership(member, input) });
    if (req.method === 'POST' && input.action === 'club-standing') return res.status(200).json({ ok: true, ...(await clubStanding(member, cleanText(input.clubId, 50))) });
    if (req.method === 'POST' && input.action === 'create-project') return res.status(201).json({ ok: true, project: await createMemberProject(member, input) });
    if (req.method === 'POST' && input.action === 'respond-packet') return res.status(200).json({ ok: true, project: await respondToPacket(member, input) });
    if (req.method === 'POST' && input.action === 'create-request') return res.status(201).json({ ok: true, request: await createProjectRequest(member, input) });
    if (req.method === 'POST' && input.action === 'apply') return res.status(201).json({ ok: true, application: await applyToProject(member, input, dependencies.env || process.env) });
    if (req.method === 'POST' && input.action === 'apply-batch') return res.status(201).json({ ok: true, application: await applyToBatch(member, input) });
    if (req.method === 'POST' && input.action === 'analyze-github') return res.status(200).json({ ok: true, analysis: await analyzeGithub(member, input, dependencies.env || process.env) });
    if (req.method === 'POST' && input.action === 'unlock-batch') return res.status(200).json({ ok: true, result: await unlockBatch(member, input) });
    if (req.method === 'POST' && input.action === 'batch-roster') return res.status(200).json({ ok: true, roster: await loadBatchRoster(member, input) });
    if (req.method === 'POST' && input.action === 'send-message') return res.status(201).json({ ok: true, message: await sendProjectMessage(member, input) });
    if (req.method === 'POST' && input.action === 'pin-message') return res.status(200).json({ ok: true, message: await pinProjectMessage(member, input) });
    if (req.method === 'POST' && input.action === 'get-messages') return res.status(200).json({ ok: true, ...(await loadNewMessages(member, input)) });
    if (req.method === 'POST' && input.action === 'accept-application') return res.status(200).json({ ok: true, application: await acceptApplication(member, input) });
    if (req.method === 'POST' && input.action === 'decline-application') return res.status(200).json({ ok: true, application: await declineApplication(member, input) });
    if (req.method === 'POST' && input.action === 'withdraw-application') return res.status(200).json({ ok: true, result: await deleteApplication(member, input) });
    if (req.method === 'POST' && input.action === 'submit-deliverable') return res.status(200).json({ ok: true, project: await submitDeliverable(member, input) });
    if (req.method === 'POST' && input.action === 'review-deliverable') return res.status(200).json({ ok: true, project: await reviewDeliverable(member, input) });
    if (req.method === 'POST' && input.action === 'buy-credits') return res.status(200).json({ ok: true, ...(await buyCredits(member, input, dependencies.env || process.env)) });
    if (req.method === 'POST' && input.action === 'cancel-project') return res.status(200).json({ ok: true, project: await cancelProject(member, input) });
    if (req.method === 'POST' && input.action === 'delete-project') return res.status(200).json({ ok: true, result: await deleteProject(member, input) });
    if (req.method === 'POST' && input.action === 'record-conversion') return res.status(200).json({ ok: true, project: await recordConversion(member, input) });
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
