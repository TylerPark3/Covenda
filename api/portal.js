import { createClient } from '@supabase/supabase-js';

import { recordError } from './limits.js';
import { scoreCandidate } from './scoring.js';
import { requestAccommodation, saveTranscript } from './transcripts.js';
import { reviewerLine } from './reviewers.js';
import { commitmentFor } from './professional-review.js';
import { claimsFromProfile, presentationBand } from './evidence.js';
import { advanceSimulation, loadSimulations, startSimulation } from './simulation-run.js';

import { supabaseConfiguration } from './submissions.js';
import { notifyMember, notifyOperatorEvent, applicationReceivedEmail, applicationDecisionEmail, payoutRequestedEmail, recordDelivery, deliverableSubmittedEmail, deliverableReviewedEmail, trialStartedEmail, introductionEmail } from './notify.js';
import { parseRepoRef, fetchRepoData, analyzeRepo } from './github.js';
import { canonicalizeSkill } from './skills-taxonomy.js';
import { presentScore, normalizeAppeal } from './hardening.js';
import { BATCH_CATALOG, batchBrief, evaluateBatchAdmission, demoForVertical, batchesByVertical, batchCompatibility, SPECIALISATION_SKILLS } from './batches.js';
import { verticalFor } from './vertical-map.js';
import { scenarioFor, optionalScenariosFor } from './scenarios.js';
import {
  assessmentPlan, reverseAudit, candidateDisclosure, aedtPosture,
  REVERSE_AUDIT_QUESTIONS, AUTONOMY_LEVELS, BUDGET_MINUTES, DIMENSIONS,
  deepDiveFor, verificationTest, blockerPrompt, systemDesign,
  ambiguousTakeHome, liveDebugging, figureItOut,
  unpromptedBuild, crossFunctional,
} from './super-intern.js';
import { allTechnicalClaims, technicalProfile, technicalGaps, recordTechnicalEvidence, recommendedEvidence, EVIDENCE_TYPES, OWNERSHIP_LEVELS } from './technical-evidence.js';
import { summarise as summariseVetting, processFor } from './vetting.js';
import { assessmentFor as supplierAssessment } from './assessments.js';
import { scriptFor } from './session-script.js';
import { VERIFICATION_TIERS, REFERRER_VALUE, CLUB_VERIFICATION_VERSION, evaluateClubVerification, memberStanding } from './clubs.js';
import { buildTalentRequirement, REQUIREMENT_VERTICALS, REQUIREMENT_WORK_TYPES } from './talent-profile.js';
import { checkSchoolEmail, checkCode, generateCode, verificationStanding, normaliseEmail } from './verification.js';
import { classifyCompanyEmail, domainMatchesCompany, companyVerificationStanding } from './company-verification.js';
import { readinessFor, categoriseOpportunity } from './readiness.js';
import { recordRevision, briefVersion, evaluateBrief } from './brief-engine.js';
import { checkIntroduction, applyResponse, normaliseOutcome, referralStatus, OUTCOME_QUESTIONS } from './introductions.js';
import { checkPayout, creditsToCents, transferIdempotencyKey, payoutsMode } from './payouts.js';
import { buildMilestoneSchedule, evaluateMilestones, reassignmentDecision, founderTimeVariance } from './milestones.js';
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

// The confirmation token is the only credential on the officer route, so it comes from the
// CSPRNG rather than Math.random.
function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
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

// For optional, additive features whose table may not exist yet. checked() throws on a query
// error, which is right for the core tables — if member_projects is missing, nothing works
// and pretending otherwise hides it. But a portal that 503s in its entirety because an
// introductions table has not been migrated yet is a code/schema skew taking down features
// that have nothing to do with it. These degrade to empty and log the reason.
// Every table optional() has quietly skipped this process, so a degraded feature can be seen
// rather than inferred. In-memory: a counter is enough to answer "is this still happening",
// and the durable record goes to error_events the first time each table fails.
export const degraded = new Map();
const reported = new Set();

// A query that filters on a column added by a migration, run against a database where that
// migration has not been applied yet, fails outright — and inside checked() that takes the
// whole portal down with it.
//
// This has now happened twice. The rule that prevents a third: a filter on a NEW column is
// always attempted and always has a fallback. When the column is missing the unfiltered result
// is correct anyway, because a database without the column has no synthetic rows in it.
async function excludingSynthetic(build) {
  const { data, error } = await build(true);
  if (!error) return data ?? [];
  if (!/column .*synthetic.* does not exist|synthetic/i.test(error.message || '')) {
    throw new Error(error.message);
  }
  console.warn(JSON.stringify({ level: 'warn', message: 'synthetic column missing; run the newest migration', detail: error.message.slice(0, 120) }));
  const fallback = await build(false);
  if (fallback.error) throw new Error(fallback.error.message);
  return fallback.data ?? [];
}

async function optional(query, fallback = [], label = 'optional table') {
  try {
    const { data, error } = await query;
    if (error) {
      noteDegraded(label, error.message);
      return fallback;
    }
    return data ?? fallback;
  } catch (error) {
    noteDegraded(label, String(error?.message || error));
    return fallback;
  }
}

function noteDegraded(label, message) {
  const seen = degraded.get(label) || { count: 0, lastMessage: '' };
  degraded.set(label, { count: seen.count + 1, lastMessage: message, lastAt: new Date().toISOString() });
  console.warn(JSON.stringify({ level: 'warn', message: 'Optional read skipped', label, error: message }));
  // Recorded once per table per instance. A row per skipped read would bury the signal in
  // its own noise — the point is to learn that a table is missing, not how often.
  if (reported.has(label)) return;
  reported.add(label);
  recordError('portal', 'schema_missing', `Optional table unavailable: ${label}`, { detail: { label, reason: String(message).slice(0, 200) } })
    .catch(() => { /* recording a degradation must never degrade anything further */ });
}

// What is currently degraded, for the operator health view. Nothing here is user data.
export function degradedReport() {
  return {
    tables: [...degraded.entries()].map(([label, v]) => ({ label, ...v })),
    healthy: degraded.size === 0,
  };
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
      excludingSynthetic(filtered => {
        let q = supabase.from('member_projects').select('*').eq('status', 'open');
        if (filtered) q = q.eq('synthetic', false);
        return q.in('visibility', ['members', 'open']).order('created_at', { ascending: false }).limit(50);
      }),
      checked(supabase.from('project_applications').select('*').eq('student_user_id', user.id).order('updated_at', { ascending: false }).limit(100)),
    ]);
    const projectIds = projects.map(project => project.id);
    const messages = projectIds.length
      ? await checked(supabase.from('project_messages').select('*').in('project_id', projectIds).order('created_at', { ascending: true }).limit(500))
      : [];
    const verifiedCount = projects.filter(project => project.status === 'complete').length;
    const positiveOutcomes = projects.filter(project => project.conversion_outcome && project.conversion_outcome !== 'none').length;
    const rankedOpportunities = (await attachPosters(supabase, rankOpportunities(opportunities, profile, { completedCount: verifiedCount, positiveOutcomes })))
      // Banded server-side so the client renders one agreed grouping rather than
      // re-deriving it and drifting.
      .map(p => ({ ...p, category: categoriseOpportunity({ score: p.fitScore, matched: p.matched }) }));
    const matchedCount = rankedOpportunities.filter(project => project.matched).length;
    // Students hold credits too once escrow is released, so they get a balance (the
    // Wallet view itself stays company/university only).
    const [walletBalance, creditLedger, payoutRequests, batches, batchApplications, videos] = await Promise.all([
      creditBalance(member), loadCreditLedger(member), loadPayoutRequests(member), loadBatches(member), loadBatchApplications(member), loadMemberVideos(member),
    ]);
    const batchStanding = await loadBatchStanding(member);
    const verification = await loadVerificationStanding(member);
    // How each open batch lines up with the skills this student actually listed. Browsing
    // help, not an admission signal — evaluateBatchAdmission remains the only gate.
    const evidencedSkills = Object.keys(((profile.skill_signals || {}).github || [])
      .reduce((acc, a) => { (a.skills || []).forEach(sk => { acc[sk.skill] = true; }); return acc; }, {}));
    // The technical evidence graph. Built for every student because breadth and gaps are
    // useful to anyone, though it only has anything to say once a repo is connected.
    // Connected repos AND evidence the student entered. Reading only the former is what made
    // the whole agency story depend on having a GitHub account connected.
    const technicalEvidence = await loadTechnicalEvidence(member);
    const technicalBase = technicalProfile(allTechnicalClaims(profile, technicalEvidence));
    // The type guide travels with the dashboard so the form and the model cannot describe the
    // same evidence type differently. Duplicating these strings in the client is how the limit
    // on a hackathon quietly stops matching the one the reviewer reads.
    const typeGuide = Object.fromEntries(Object.entries(EVIDENCE_TYPES)
      .map(([id, t]) => [id, { label: t.label, demonstrates: t.demonstrates, cannotShow: t.cannotShow }]));
    const simulations = await loadSimulations(member).catch(() => []);
    const availableSimulations = offerableSimulations(profile, batches || []);

    // The two reads that cost the student nothing, because the evidence already exists.
    const unprompted = unpromptedBuild((technicalEvidence || []).map(e => ({
      assigned: e.assigned,
      deploymentUrl: e.deployment_url,
      finished: e.project_status === 'finished' || Boolean(e.deployment_url),
      usersReported: (e.detail || {}).usage || null,
      changedAfterFeedback: Number(e.iterations) > 0,
    })));
    // Reach is read from the domain with the most EVIDENCED skills, so it measures reach from a
    // centre rather than rewarding breadth on its own.
    const FUNCTION_OF_DOMAIN = { backend: 'engineering', frontend: 'engineering', algorithms: 'engineering',
      infrastructure: 'engineering', distributed: 'engineering', databases: 'analysis', aiml: 'research',
      robotics: 'engineering', security: 'engineering', product: 'product' };
    const evidenceByFunction = {};
    for (const domain of technicalBase.breadth || []) {
      const fn = FUNCTION_OF_DOMAIN[domain.id];
      if (fn && domain.evidencedCount) (evidenceByFunction[fn] ||= []).push(domain.id);
    }
    const strongest = (technicalBase.breadth || []).find(d => d.evidencedCount > 0);
    const reach = crossFunctional({
      primary: strongest ? FUNCTION_OF_DOMAIN[strongest.id] || null : null,
      evidenceByFunction,
    });

    const technical = { ...technicalBase, gaps: technicalGaps(technicalBase), entries: technicalEvidence, unprompted, reach, typeGuide, ownershipLevels: OWNERSHIP_LEVELS };
    // The DB row carries snake_case columns and no verticalSlug or summary, so grafting only
    // `requirements` left the matcher blind to the vertical (its bonus could never fire for
    // anyone) and short of the words it matches against. Merge the whole catalog entry, with
    // the row winning wherever both have a value — status and capacity are live, not static.
    const batchesWithFit = (batches || []).map(b => {
      const spec = BATCH_CATALOG.find(c => c.slug === b.slug) || {};
      const full = { ...spec, ...b, requirements: spec.requirements || [] };
      return {
        ...b,
        verticalSlug: spec.verticalSlug || null,
        evaluates: (verticalFor(b.slug) || {}).evaluates || null,
        simulation: (verticalFor(b.slug) || {}).simulation || null,
        coreSkills: SPECIALISATION_SKILLS[b.slug] || [],
        compatibility: batchCompatibility(full, {
          skills: profile.skills || [], verticals: profile.verticals || [], evidencedSkills,
        }),
      };
    });
    return { user, profile, projects, opportunities: rankedOpportunities, applications, studentDirectory: [], intakes, messages, verifiedCount, matchedCount, walletBalance, creditLedger, payoutRequests, batches: batchesWithFit, batchApplications, batchStanding, verification, videos, technical, simulations, availableSimulations, batchApplicationsOpen: batchApplicationsOpen(env), batchesClosedMessage: BATCHES_CLOSED_MESSAGE, introductions: await loadIntroductions(member, 'student'), // `vetting` already exists on a brief and holds the rails. Adding the per-vertical
    // process under a NEW key rather than overwriting it — the first version clobbered
    // brief.vetting.rails and broke every consumer of it.
    batchBriefs: BATCH_CATALOG.map(b => ({ ...batchBrief(b), vettingProcess: summariseVetting(b.discipline), reviewer: reviewerLine(b.discipline), practitionerAsk: commitmentFor(b.discipline), vettingStages: (processFor(b.discipline) || {}).stages || [], assessment: (() => { const a = supplierAssessment(b.discipline, b.slug); return a ? { ...a, script: scriptFor(b.slug, { minutes: a.exercise?.minutes || 25 }) } : null; })() })), identityEnabled , briefMeteringEnabled, briefFee , platformFeeRate: PLATFORM_FEE_RATE };
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
    ? await excludingSynthetic(filtered => {
        let q = supabase.from('member_profiles').select('user_id,display_name,school_name,headline,bio,skills,graduation_year,updated_at,identity_verified,verticals,work_types,avatar_url,skill_signals');
        if (filtered) q = q.eq('synthetic', false);
        return q.eq('role', 'student').eq('portfolio_visibility', 'members').order('updated_at', { ascending: false }).limit(100);
      })
    : [];
  const messages = projectIds.length
    ? await checked(supabase.from('project_messages').select('*').in('project_id', projectIds).order('created_at', { ascending: true }).limit(500))
    : [];
  const verifiedCount = projects.filter(project => project.status === 'complete').length;
  const [walletBalance, creditLedger, projectRequests, batches, batchAccess, batchAdmitted] = await Promise.all([
    creditBalance(member), loadCreditLedger(member), loadProjectRequests(member), loadBatches(member), loadBatchAccess(member), loadBatchAdmittedCounts(member),
  ]);
  const [companyProfile, companyVerification] = profile.role === 'company'
    ? await Promise.all([loadCompanyProfile(member), loadCompanyStanding(member, profile)])
    : [null, null];
  return { user, profile, projects, opportunities: [], applications, studentDirectory, intakes, messages, verifiedCount, walletBalance, creditLedger, projectRequests, batches, batchAccess, batchAdmitted, companyProfile, companyVerification, briefing: await companyBriefing(member),
    // Degrades to an empty list before the migration lands, rather than taking the dashboard
    // down with it. That mistake has already caused two outages.
    simulations: await loadSimulations(member).catch(() => []), evidenceRequests: await loadEvidenceRequests(member), superIntern: { ...(await loadCompanyEnvironments(member)), questions: REVERSE_AUDIT_QUESTIONS, autonomyLevels: AUTONOMY_LEVELS, budgetMinutes: BUDGET_MINUTES, dimensions: DIMENSIONS }, evidenceTypeGuide: Object.fromEntries(Object.entries(EVIDENCE_TYPES).map(([id, t]) => [id, { label: t.label, demonstrates: t.demonstrates, cannotShow: t.cannotShow }])), introductions: await loadIntroductions(member, 'company'), companyReferrals: await loadCompanyReferrals(member), outcomeQuestions: OUTCOME_SURVEY_QUESTIONS, // `vetting` already exists on a brief and holds the rails. Adding the per-vertical
    // process under a NEW key rather than overwriting it — the first version clobbered
    // brief.vetting.rails and broke every consumer of it.
    batchBriefs: BATCH_CATALOG.map(b => ({ ...batchBrief(b), vettingProcess: summariseVetting(b.discipline), reviewer: reviewerLine(b.discipline), practitionerAsk: commitmentFor(b.discipline), vettingStages: (processFor(b.discipline) || {}).stages || [], assessment: (() => { const a = supplierAssessment(b.discipline, b.slug); return a ? { ...a, script: scriptFor(b.slug, { minutes: a.exercise?.minutes || 25 }) } : null; })() })), identityEnabled , briefMeteringEnabled, briefFee , platformFeeRate: PLATFORM_FEE_RATE };
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
    // The student half of the comparison. Both are optional and a blank is skipped, never
    // counted against them.
    work_style: cleanWorkStyle(input.workStyle),
    traits: cleanTraits(input.traits),
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
// Derived, never hand-listed: a whitelist that can drift from the catalogue is a whitelist
// that eventually rejects a real vertical.
const VERTICAL_SLUGS = new Set(batchesByVertical().map(v => v.verticalSlug));

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
  const mode = payoutsMode(env);
  const request = await checked(member.supabase.from('payout_requests').select('*').eq('id', id).maybeSingle(), null);
  if (!request) throw new Error('That payout request is no longer available.');
  if (request.status !== 'requested') throw new Error('This payout request has already been resolved.');

  // Move the money BEFORE the ledger records it as sent. The other order can mark a student
  // paid and then fail the transfer, which is the one mistake that is expensive to unwind.
  let transferId = null;
  if (mode.automated) {
    const payee = await checked(member.supabase.from('member_profiles')
      .select('stripe_account_id,stripe_payouts_enabled').eq('user_id', request.user_id).maybeSingle(), null);
    if (!payee?.stripe_account_id || !payee.stripe_payouts_enabled) {
      throw new Error('That student has not finished setting up payouts. They need to complete Stripe onboarding first.');
    }
    const params = new URLSearchParams({
      amount: String(creditsToCents(request.credits)),
      currency: 'usd',
      destination: payee.stripe_account_id,
      'metadata[payout_request_id]': request.id,
    });
    const response = await fetch('https://api.stripe.com/v1/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Stripe retries; a transfer that runs twice pays twice.
        'Idempotency-Key': transferIdempotencyKey(request.id),
      },
      body: params.toString(),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || 'Stripe would not send that transfer.');
    transferId = json.id;
  }

  const settled = await checked(
    member.supabase.rpc('fulfil_payout_request', { p_request_id: id, p_operator_id: member.user.id, p_note: cleanText(input.note, 500) || null }),
    null,
  );
  if (transferId) {
    await member.supabase.from('payout_requests').update({ stripe_transfer_id: transferId }).eq('id', id);
  }
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
export const FIT_WEIGHTS = { vertical: 28, workType: 23, startupFit: 18, skills: 16, traits: 3, execution: 6, compensation: 3, deadline: 3 };

// Startup environment ↔ student work-style dimensions. Missing data on either side is skipped
// (never lowers a score). No protected attributes appear here.
export const AXIS_COUNT = 8;
const ENV_DIMS = [
  ['env_structure', 'structure'], ['env_autonomy', 'autonomy'], ['env_pace', 'pace'], ['env_stage', 'stage'],
  // Four more axes. With only four, this component could land on five distinct values, which
  // is why very different students kept scoring the same. Every one of these is about HOW
  // someone likes to work and is answerable by a first-year with no experience.
  ['env_collaboration', 'collaboration'], ['env_feedback', 'feedback'],
  ['env_communication', 'communication'], ['env_scope', 'scope'],
];
export const WORK_STYLE_ENUMS = {
  structure: ['structured', 'ambiguous'], autonomy: ['guided', 'independent'],
  pace: ['steady', 'fast'], stage: ['idea', 'seed', 'growth'],
  collaboration: ['solo', 'paired'], feedback: ['frequent', 'light'],
  communication: ['async', 'sync'], scope: ['depth', 'breadth'],
};
// Traits a student can claim about how they work. Checked against a company's ideal_traits.
// Self-declared on both sides, so this is a preference match, never evidence — which is why
// it carries the smallest weight of anything in the score.
export const TRAIT_OPTIONS = [
  'comfortable with ambiguity', 'ships fast', 'detail-obsessed', 'asks questions early',
  'works well unsupervised', 'strong writer', 'enjoys unglamorous work', 'learns a new tool quickly',
  'pushes back when something is wrong', 'finishes what they start',
];
export function cleanTraits(value) {
  const allowed = new Set(TRAIT_OPTIONS);
  return (Array.isArray(value) ? value : [])
    .map(v => String(v || '').toLowerCase().trim())
    .filter(v => allowed.has(v)).slice(0, 6);
}
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
  // desired_skills is what the posting asks for; ideal_skills is what the founder said when
  // they described the person. Both are the company's own words, so they are one pool.
  const idealSkills = Array.isArray(project.ideal_skills) ? project.ideal_skills : [];
  const projS = [...new Set([
    ...(project.desired_skills ? String(project.desired_skills).split(/[,\n]/) : []),
    ...idealSkills,
  ].map(s => String(s).toLowerCase().trim()).filter(Boolean))];
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

  const idealTraits = (Array.isArray(project.ideal_traits) ? project.ideal_traits : [])
    .map(t => String(t).toLowerCase().trim()).filter(Boolean);
  const studentTraits = new Set((profile?.traits || []).map(t => String(t).toLowerCase().trim()).filter(Boolean));
  if (idealTraits.length && studentTraits.size) {
    const hit = idealTraits.filter(t => studentTraits.has(t));
    if (hit.length) {
      score += Math.round(FIT_WEIGHTS.traits * Math.min(1, hit.length / idealTraits.length));
      reasons.push(`How you work lines up: ${hit.slice(0, 2).join(', ')}`);
    }
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
  const bounded = Math.max(0, Math.min(100, score));
  return {
    score: Math.round(bounded),
    // Rounded to one decimal rather than truncated, so 71.96 reads as 72.0 and not 71.9.
    precise: Math.round(bounded * 10) / 10,
    // How many of the eight axes both sides actually answered. A 78 built on two answers is
    // not the same claim as a 78 built on eight, and hiding that would be the dishonest part.
    comparedOn: sfConsidered,
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
// The confidence band a company sees around a score, derived from the evidence ladder rather
// than guessed at. This used to be two hardcoded checks — completed work meant gold, a linked
// repo meant bronze — which meant every per-source ceiling in api/evidence.js governed nothing
// a company actually saw. A club confirmation, for instance, was silently worth as much as a
// connected repository; now it caps at self_reported, which is what the registry always said.
export function studentEvidenceTier(profile, completedCount = 0) {
  return presentationBand(claimsFromProfile(profile, { completedCount: Number(completedCount) || 0 }));
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
    .map(project => { const fit = computeFitScore(project, profile, context); return { ...project, matched: isMatch(project), fitScore: fit.score, fitPresentation: presentScore(fit.score, studentEvidenceTier(profile, context.completedCount)), fitReasons: fit.reasons, fitConcerns: fit.concerns, fitApproach: fit.recommendedApproach,
      // The basis, not just the number. A 78 built on two answered axes is not the claim a 78
      // built on eight is, and the product should say so where the score is shown.
      fitPrecise: fit.precise, fitComparedOn: fit.comparedOn, fitAxes: AXIS_COUNT,
      // Resolved, not assumed. With no completed outcomes this is 'rules' and the number is
      // untouched; the moment the gate clears it reports what actually produced the score.
      fitStage: scoreCandidate({ rules: fit, outcomeCount: context.outcomeCount || 0 }).stage }; })
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
  // The environment axes. These are what computeFitScore compares a student's work_style
  // against, and until now nothing wrote them, so the 18-point startup-fit component of every
  // score was silently dead.
  if (input.environment && typeof input.environment === 'object') {
    for (const [col, key] of ENV_DIMS) {
      const value = input.environment[key];
      if (typeof value === 'string' && (WORK_STYLE_ENUMS[key] || []).includes(value)) row[col] = value;
    }
  }
  // The ideal intern, as the founder describes them. Traits stay separate from skills: a
  // skill can be evidenced from an artifact and a trait cannot, and merging them would let
  // "ships fast" sit in the same list as a verified capability.
  if (input.idealTraits !== undefined) row.ideal_traits = cleanTraits(input.idealTraits);
  if (input.idealSkills !== undefined) row.ideal_skills = cleanList(input.idealSkills);
  if (input.idealMemo !== undefined) row.ideal_memo = cleanText(input.idealMemo, 2_000) || null;
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
export async function logMatchEvent(member, { projectId, studentUserId, eventType, fit, features, matchId, meta }) {
  try {
    await member.supabase.from('match_events').insert({
      project_id: projectId || null,
      student_user_id: studentUserId || null,
      event_type: eventType,
      features: features || {},
      fit_score: fit && Number.isFinite(fit.score) ? fit.score : null,
      fit_reasons: (fit && fit.reasons) || [],
      // Groups every event for one trial so the materialiser can assemble a label. The
      // project id IS the match identity in this repo.
      match_id: matchId || projectId || null,
      meta: meta || {},
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
// Applications are CLOSED by default, and stay closed until this is deliberately switched on.
//
// The specialisations are being rebuilt: several of them do not yet verify the thing they
// claim to verify, and a student who applies to one of those spends real hours on a bar that
// is about to change underneath them. Defaulting to open would mean a forgotten env var is the
// only thing standing between that and a real applicant.
export function batchApplicationsOpen(env = process.env) {
  return env.COVENDA_BATCH_APPLICATIONS_OPEN === 'true';
}

export const BATCHES_CLOSED_MESSAGE =
  'Batch applications are closed while we rebuild how each one is vetted. They open again soon, '
  + 'and nothing you have already submitted is affected.';

export async function applyToBatch(member, input, env = process.env) {
  // Enforced on the server, not only in the UI. A closed door that only exists in the client
  // is not closed.
  if (!batchApplicationsOpen(env)) throw new Error(BATCHES_CLOSED_MESSAGE);
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
    // Answers to questions generated from this applicant's own résumé. Nobody else in the
    // batch was asked them, which is the point: a shared question can be prepared once and
    // reused, and one anchored to a specific line of their own history cannot. The anchor
    // travels with the answer so a reviewer can see what prompted the question.
    // Concept answers store the INDEX chosen, not whether it was right. Correctness is
    // resolved server-side against the published bank at review time, so a client that lies
    // about its own score changes nothing.
    conceptAnswers: Array.isArray(input.conceptAnswers)
      ? input.conceptAnswers.slice(0, 12).map(a => ({
          question: cleanText(a?.question, 400),
          choice: Number.isInteger(a?.choice) ? a.choice : null,
        })).filter(a => a.question && a.choice !== null)
      : [],
    reasoningAnswers: Array.isArray(input.reasoningAnswers)
      ? input.reasoningAnswers.slice(0, 8).map(a => ({
          id: cleanText(a?.id, 60),
          question: cleanText(a?.question, 600),
          answer: cleanText(a?.answer, 2000),
        })).filter(a => a.question && a.answer)
      : [],
    resumeAnswers: Array.isArray(input.resumeAnswers)
      ? input.resumeAnswers.slice(0, 6).map(a => ({
          question: cleanText(a?.question, 400),
          followUp: cleanText(a?.followUp, 400),
          anchor: cleanText(a?.anchor, 300),
          answer: cleanText(a?.answer, 1500),
        })).filter(a => a.question && a.answer)
      : [],
    // The screen recording of the supplied exercise — the process, not just the result.
    exerciseUrl: cleanUrl(input.exerciseUrl),
    // The work sample itself — the spreadsheet or document the vetting process reads.
    // The client uploads and sends URLs; nothing is stored here that a reviewer
    // cannot open.
    workSampleFiles: (Array.isArray(input.workSampleFiles) ? input.workSampleFiles : [])
      .slice(0, 5)
      .map(f => ({ name: cleanText(f?.name, 160), url: cleanUrl(f?.url) }))
      .filter(f => f.name && f.url),
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
    return BATCH_CATALOG.map(batch => {
      const admission = evaluateBatchAdmission(batch, applicant);
      // The score says where you stand; readiness says whether that is fixed, and what
      // closes it. Admission itself is untouched — this only explains it.
      const met = admission.total ? Math.round((admission.metCount / admission.total) * 100) : 0;
      return {
        slug: batch.slug,
        name: batch.name,
        ...admission,
        readiness: readinessFor({ score: met, gaps: admission.checks || [] }),
      };
    });
  } catch {
    return [];
  }
}




// ---- Stage 4: milestone telemetry, read on every dashboard load ----------------------
// api/milestones.js was fully built and tested and imported by nothing, so the flake defense
// never ran. These are the two calls that make it real: state for whoever is looking, and a
// recommended action for the operator when someone has gone quiet.

export function projectMilestoneState(project, now = new Date().toISOString()) {
  const evaluation = evaluateMilestones(project?.milestones, now);
  return {
    ...evaluation,
    // An ACTION, never a mutation. Reassignment is recorded and a human still signs it.
    action: reassignmentDecision(evaluation, project || {}, now),
    founderTime: founderTimeVariance(project || {}),
  };
}

// Mark the active milestone submitted. Called when a deliverable lands, so on-time is
// measured against the schedule rather than asserted afterwards.
export function markMilestoneSubmitted(milestones, now = new Date().toISOString()) {
  const rows = Array.isArray(milestones) ? milestones.map(m => ({ ...m })) : [];
  const evaluation = evaluateMilestones(rows, now);
  const index = evaluation.activeIndex;
  if (index < 0 || !rows[index]) return rows;
  rows[index].submitted_at = now;
  rows[index].on_time = !rows[index].due_at || Date.parse(now) <= Date.parse(rows[index].due_at);
  return rows;
}

// ---- §14 student verification --------------------------------------------------------
// A six-digit code to the school address. The code is checked server-side against a stored
// row, attempts are counted, and the row is consumed on success — none of which can be
// enforced from the client.

// An API key with a stray character in it — a smart quote, a box-drawing dash pasted out of
// a terminal, a trailing newline — throws deep inside fetch when the Authorization header is
// built, and surfaces as the entire portal being unavailable. Catching it here means the
// message names the actual cause instead of a 503.
function usableApiKey(key, label) {
  const raw = String(key || '').trim();
  if (!raw) return { ok: false, reason: `${label} is not set on this deployment.` };
  const bad = [...raw].findIndex(ch => ch.charCodeAt(0) > 255 || ch.charCodeAt(0) < 32);
  if (bad !== -1) {
    return { ok: false, reason: `${label} has an invalid character at position ${bad + 1}. It was probably copied with formatting — re-paste just the key, nothing before or after.` };
  }
  return { ok: true, key: raw };
}

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

  const keyCheck = usableApiKey(env.RESEND_API_KEY, 'RESEND_API_KEY');
  const from = env.COVENDA_NOTIFICATION_FROM;
  // A student cannot act on "email is not configured" — that is our problem, not theirs. Say
  // what it means for them and point at the two paths that do work, both of which count for
  // more than a school email anyway.
  if (!keyCheck.ok || !from) {
    throw new PortalOperationalError(
      'VERIFY_EMAIL_NOT_CONFIGURED',
      keyCheck.ok
        ? 'School-email codes are not switched on yet. Claim a club or ask for a named referral instead — either one counts for more than a school email.'
        : keyCheck.reason,
    );
  }
  const apiKey = keyCheck.key;
  const { Resend } = await import('resend');
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email,
    subject: `Covenda verification code: ${code}`,
    text: `Your Covenda school-email verification code is ${code}. It expires in 20 minutes.\n\nThis confirms you control this address. It is not a sign-in link.`,
  });
  if (error) {
    // The real reason used to be discarded here, so every failure looked identical and this
    // stayed broken for days. Resend says exactly what went wrong; it goes to error_events
    // where it is queryable, and the student gets the part they can act on.
    const detail = String(error.message || error).slice(0, 200);
    await recordError('school-verification', 'error', detail, {
      userId: member.user.id,
      detail: { domain: check.domain, from },
    });
    // An unverified sending domain is by far the most common cause, and it is ours to fix,
    // not something a student should be told to retry through.
    const unverified = /domain|not verified|testing emails|only send/i.test(detail);
    throw new PortalOperationalError(
      'VERIFY_EMAIL_FAILED',
      unverified
        ? 'Our email sending is not fully set up yet, so the code could not reach you. Claim a club or ask for a named referral instead, either counts for more than a school email.'
        : 'Could not send the code. Try again shortly.',
    );
  }
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
// ── Intro videos ──────────────────────────────────────────────────────────────────────
// Recorded in the portal, kept on the student's account, and re-used at application time.
// Asking for "a Loom or YouTube link" assumed a video already exists somewhere; it almost
// never does. Record once, reuse everywhere.
export const VIDEO_LIBRARY_LIMIT = 12;

// ── The Super-Intern engine ───────────────────────────────────────────────────────────
// A company describes its environment; the engine returns the assessment that environment
// actually calls for. The senior-hours answer is the one that reshapes everything, and it is
// the question no other platform asks.
export async function saveCompanyEnvironment(member, input) {
  const profile = await loadMemberProfile(member);
  if (profile?.role !== 'company') throw new Error('Only company accounts can describe an environment.');

  const vertical = cleanText(input.vertical, 60);
  if (!VERTICAL_SLUGS.has(vertical)) throw new Error('Choose a vertical Covenda runs.');

  const autonomy = AUTONOMY_LEVELS.includes(input.autonomy) ? input.autonomy : 'semi_autonomous';
  const hours = input.seniorHoursPerWeek === '' || input.seniorHoursPerWeek == null
    ? null : Math.max(0, Math.min(168, Number(input.seniorHoursPerWeek) || 0));

  // The eight reverse-audit answers, kept as the company's own words. A dropdown here would
  // destroy the value, which is entirely in what they say unprompted.
  const audit = {};
  for (const q of REVERSE_AUDIT_QUESTIONS) {
    const answer = cleanText(input.reverseAudit?.[q.id], 600);
    if (answer) audit[q.id] = answer;
  }

  const row = {
    company_user_id: member.user.id,
    project_id: PROJECT_ID_PATTERN.test(cleanText(input.projectId, 50)) ? cleanText(input.projectId, 50) : null,
    vertical,
    autonomy,
    senior_hours_per_week: hours,
    domain_knowledge: Boolean(input.domainKnowledge),
    onboarding_burden: (Array.isArray(input.onboardingBurden) ? input.onboardingBurden : String(input.onboardingBurden || '').split(','))
      .map(v => cleanText(v, 120)).filter(Boolean).slice(0, 8),
    reverse_audit: audit,
  };

  const environment = await checked(member.supabase.from('company_environments').insert(row).select('*').single(), null);
  if (!environment) throw new Error('The environment could not be saved. The super_intern migration may not be applied yet.');

  // Generated and STORED, not recomputed on read. A student assessed under this plan must be
  // able to see the plan they were actually assessed under, whatever the engine does later.
  const plan = assessmentPlan({
    vertical, autonomy, seniorHoursPerWeek: hours,
    domainKnowledge: row.domain_knowledge, onboardingBurden: row.onboarding_burden,
  });
  const stored = await checked(member.supabase.from('assessment_plans').insert({
    environment_id: environment.id,
    batch_slug: cleanText(input.batchSlug, 60) || null,
    vertical,
    engine_version: plan.version,
    autonomy: plan.autonomy,
    focus: plan.focus,
    components: plan.components,
    deferred_to_trial: plan.deferredToTrial,
    not_relevant: plan.notRelevant,
    because: plan.because,
    total_minutes: plan.minutes,
  }).select('*').single(), null);

  return {
    environment,
    plan: stored ? { ...plan, id: stored.id } : plan,
    // Both counter-intuitive and both SHRINK the assessment, so they are surfaced immediately.
    audit: reverseAudit(audit),
  };
}

// The material for one component of a sitting. Served per component rather than all at once,
// because the Deep Dive topic and the verification defect are the assessment: handing them
// over up front turns a ninety-minute sitting into three days of preparation.
export function componentMaterial(componentId, vertical, seed = 0) {
  switch (componentId) {
    case 'deep_dive': return deepDiveFor(vertical, seed);
    case 'verification': return verificationTest(vertical);
    case 'blocker': return blockerPrompt(vertical);
    case 'system_design': return systemDesign(vertical);
    case 'take_home': return ambiguousTakeHome({ vertical });
    case 'live_debug': return liveDebugging({ vertical });
    case 'figure_it_out': return figureItOut({ vertical });
    // Objective questions come from the existing bank, and the defence is generated from what
    // this candidate actually did rather than prepared in advance.
    case 'objective': return { dimensions: ['capability'], minutes: 25, fromBank: true };
    case 'defense': return { dimensions: ['ownership', 'communication'], minutes: 10, generated: true };
    default: return null;
  }
}

export async function assessmentComponent(member, input) {
  const runId = cleanText(input.runId, 60);
  const componentId = cleanText(input.componentId, 40);
  const runs = await optional(member.supabase.from('assessment_runs')
    .select('*').eq('id', runId).eq('student_user_id', member.user.id).limit(1), [], 'assessment_runs');
  if (!runs.length) throw new Error('That sitting is not yours, or does not exist.');
  if (runs[0].status !== 'in_progress') throw new Error('That sitting is already finished.');

  const plans = await optional(member.supabase.from('assessment_plans')
    .select('*').eq('id', runs[0].plan_id).limit(1), [], 'assessment_plans');
  if (!plans.length) throw new Error('The plan behind this sitting is missing.');

  const component = (plans[0].components || []).find(c => c.id === componentId);
  if (!component) throw new Error('That component is not part of this sitting.');

  // Seeded from the run id so the same student always gets the same topic on resume, and two
  // students in one batch do not reliably share one.
  const seed = [...runId].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return { component, material: componentMaterial(componentId, plans[0].vertical, seed) };
}

// A student's own answer. Deliberately separate from the reviewer's observation: this is what
// they produced, that is what somebody made of it, and merging the two would let a candidate
// write their own assessment.
export async function submitComponent(member, input) {
  const runId = cleanText(input.runId, 60);
  const componentId = cleanText(input.componentId, 40);
  const answer = cleanText(input.answer, 8000);
  if (!answer) throw new Error('Nothing to submit yet.');

  const runs = await optional(member.supabase.from('assessment_runs')
    .select('*').eq('id', runId).eq('student_user_id', member.user.id).limit(1), [], 'assessment_runs');
  if (!runs.length) throw new Error('That sitting is not yours, or does not exist.');
  if (runs[0].status !== 'in_progress') throw new Error('That sitting is already finished.');

  const observations = { ...(runs[0].observations || {}) };
  observations[componentId] = {
    ...(observations[componentId] || {}),
    answer,
    submittedAt: new Date().toISOString(),
  };

  const saved = await checked(member.supabase.from('assessment_runs')
    .update({ observations }).eq('id', runId).eq('student_user_id', member.user.id).select('*').single(), null);
  if (!saved) throw new Error('That answer could not be saved.');
  return { run: saved };
}

export async function loadCompanyEnvironments(member) {
  const environments = await optional(member.supabase.from('company_environments')
    .select('*').eq('company_user_id', member.user.id)
    .order('created_at', { ascending: false }).limit(20), [], 'company_environments');
  if (!environments.length) return { environments: [], plans: [] };
  const plans = await optional(member.supabase.from('assessment_plans')
    .select('*').in('environment_id', environments.map(e => e.id))
    .order('created_at', { ascending: false }).limit(40), [], 'assessment_plans');
  return { environments, plans };
}

// What a student is owed before they spend an hour and a half. Every component, what it
// measures, how long it takes, and what is explicitly NOT being done with the result.
export async function assessmentDisclosure(member, input) {
  const slug = cleanText(input.batchSlug, 60);
  const plans = await optional(member.supabase.from('assessment_plans')
    .select('*').eq('batch_slug', slug)
    .order('created_at', { ascending: false }).limit(1), [], 'assessment_plans');

  // No company has described an environment for this batch yet, so show what the vertical
  // would produce rather than an empty page. Marked provisional, because it is.
  const batch = BATCH_CATALOG.find(b => b.slug === slug);
  if (!plans.length) {
    if (!batch) throw new Error('That batch does not exist.');
    const provisional = assessmentPlan({ vertical: batch.verticalSlug });
    return { provisional: true, plan: provisional, disclosure: candidateDisclosure(provisional), posture: aedtPosture({}) };
  }

  const row = plans[0];
  const plan = {
    version: row.engine_version, vertical: row.vertical, autonomy: row.autonomy,
    focus: row.focus || [], components: row.components || [],
    deferredToTrial: row.deferred_to_trial || [], notRelevant: row.not_relevant || [],
    because: row.because || [], minutes: row.total_minutes,
  };
  return { provisional: false, plan, disclosure: candidateDisclosure(plan), posture: aedtPosture({}) };
}

export async function startAssessmentRun(member, input) {
  const profile = await loadMemberProfile(member);
  if (profile?.role !== 'student') throw new Error('Only student accounts sit an assessment.');
  const planId = cleanText(input.planId, 60);
  if (!planId) throw new Error('Choose an assessment to start.');

  const existing = await optional(member.supabase.from('assessment_runs')
    .select('*').eq('plan_id', planId).eq('student_user_id', member.user.id).limit(1), [], 'assessment_runs');
  // Resuming rather than restarting. Losing ninety minutes to a closed tab is the same failure
  // the batch application had.
  if (existing.length) return { run: existing[0], resumed: true };

  const run = await checked(member.supabase.from('assessment_runs')
    .insert({ plan_id: planId, student_user_id: member.user.id }).select('*').single(), null);
  if (!run) throw new Error('The assessment could not be started. The super_intern migration may not be applied yet.');
  return { run, resumed: false };
}

// ── Company evidence requests (§9) ────────────────────────────────────────────────────
// What a team wants to SEE, as opposed to the skills it wants listed. The two are different
// asks and the second is the one that already existed: ideal_skills says what to filter on,
// this says what a student should go and build to be worth talking to.
//
// Priorities are stored in the company's own words. The evidence recommendation is derived at
// read time, so improving the mapping does not require rewriting requests already made.
export async function saveEvidenceRequest(member, input) {
  const profile = await loadMemberProfile(member);
  if (profile?.role !== 'company') throw new Error('Only company accounts can post an evidence request.');

  const priorities = (Array.isArray(input.priorities) ? input.priorities : String(input.priorities || '').split(','))
    .map(v => cleanText(v, 80)).filter(Boolean).slice(0, 10);
  if (!priorities.length) throw new Error('Name at least one thing you want to see evidence of.');

  const headline = cleanText(input.headline, 300);
  if (headline.length < 15) throw new Error('Say in a sentence what kind of engineer you are looking for.');

  const row = {
    company_user_id: member.user.id,
    batch_slug: cleanText(input.batchSlug, 60) || null,
    project_id: PROJECT_ID_PATTERN.test(cleanText(input.projectId, 50)) ? cleanText(input.projectId, 50) : null,
    headline,
    priorities,
    required_evidence_types: (Array.isArray(input.requiredEvidenceTypes) ? input.requiredEvidenceTypes : [])
      .map(v => cleanText(v, 40)).filter(v => EVIDENCE_TYPES[v]).slice(0, 6),
    notes: cleanText(input.notes, 1500) || null,
  };

  const saved = await checked(member.supabase.from('company_evidence_requests').insert(row).select('*').single(), null);
  if (!saved) throw new Error('The request could not be saved. The technical_evidence migration may not be applied yet.');
  // Returned so the company sees immediately what its own words ask a student to go and get,
  // including anything that did not map onto a technical domain.
  return { request: saved, guidance: recommendedEvidence(priorities) };
}

export async function loadEvidenceRequests(member) {
  // Same reasoning as loadTechnicalEvidence: a company's projects and roster must not depend
  // on a table added later.
  return optional(member.supabase.from('company_evidence_requests')
    .select('*').eq('company_user_id', member.user.id)
    .order('created_at', { ascending: false }).limit(20), [], 'company_evidence_requests');
}

export async function deleteEvidenceRequest(member, input) {
  const id = cleanText(input.id, 60);
  if (!id) throw new Error('Choose a request to remove.');
  await member.supabase.from('company_evidence_requests').delete()
    .eq('id', id).eq('company_user_id', member.user.id);
  return { removed: id };
}

// Which sittings a student can actually start.
//
// The whole simulation feature was unreachable: 26 scenarios, a working engine, a working
// server route, and no caller anywhere in the client. This is what the UI needs to offer one.
//
// Two kinds. The default for a specialisation is the sitting that batch runs, so it is
// offered against the batches this student is looking at. Optional sittings are offered on
// top and never instead, which is why they carry their own specialisation key.
export function offerableSimulations(profile, batches = []) {
  const out = [];
  const seen = new Set();

  const add = (scenario, context) => {
    if (!scenario || seen.has(scenario.id)) return;
    seen.add(scenario.id);
    out.push({
      id: scenario.id,
      title: scenario.title,
      minutes: scenario.minutes,
      brief: scenario.brief,
      skills: scenario.skills || [],
      optional: Boolean(scenario.optional),
      ...context,
    });
  };

  // The sitting behind each open batch the student could apply to.
  for (const batch of batches) {
    if (!['open', 'reviewing'].includes(batch.status)) continue;
    add(scenarioFor(batch.slug), { forBatch: batch.name, specialization: batch.slug });
  }

  // Optional extras for every vertical the student follows, plus the verticals of the batches
  // above, so somebody browsing software sees the polymath sitting without having to declare
  // an interest first.
  const verticals = new Set([
    ...(profile?.verticals || []),
    ...batches.map(b => (BATCH_CATALOG.find(c => c.slug === b.slug) || {}).verticalSlug).filter(Boolean),
  ]);
  for (const vertical of verticals) {
    for (const scenario of optionalScenariosFor(vertical)) {
      add(scenario, { specialization: scenario.specialization, forVertical: vertical });
    }
  }

  return out;
}

// ── Technical evidence (§3, §4, §5) ───────────────────────────────────────────────────
// The rails were unreachable: the model, the storage and the profile all existed, and a
// student had no way to put a hackathon or a pull request into any of them. Only analysed
// GitHub repos reached the profile, which meant the entire agency story depended on a
// connected account.
//
// recordTechnicalEvidence does the validation and the tier capping; this only persists what
// it produced. The ceiling logic is not restated here, so a route cannot drift from it.
export async function saveTechnicalEvidence(member, input) {
  const profile = await loadMemberProfile(member);
  if (profile?.role !== 'student') throw new Error('Only student accounts carry technical evidence.');

  const skills = (Array.isArray(input.skills) ? input.skills : [])
    .map(s => cleanText(s, 60)).filter(Boolean).slice(0, 12);
  const pointer = cleanUrl(input.pointer) || cleanUrl(input.repoUrl) || cleanUrl(input.deploymentUrl) || null;

  // Run it through the model first. If it refuses, nothing is written, and the reason the
  // student sees is the model's own rather than a database constraint violation.
  const assessed = recordTechnicalEvidence({
    id: pointer || cleanText(input.title, 160),
    type: input.type,
    source: input.source || (pointer ? 'connected_repo' : 'self_reported'),
    tier: input.tier || (pointer ? 'artifact' : 'claimed'),
    pointer,
    skills,
    ownership: input.ownership,
    deploymentUrl: cleanUrl(input.deploymentUrl),
    monthsOperated: Number(input.monthsOperated) || 0,
    iterations: Number(input.iterations) || 0,
    learnedForThis: cleanText(input.learnedForThis, 200) || null,
    mergeStatus: cleanText(input.mergeStatus, 40) || null,
    assigned: Boolean(input.assigned),
    aiDisclosure: input.aiDisclosure || null,
  });
  if (!assessed.ok) throw new Error(assessed.reason);

  const first = assessed.claims[0];
  const row = {
    student_user_id: member.user.id,
    evidence_type: input.type,
    evidence_source: first.evidence_meta.source,
    ownership_level: assessed.ownership,
    verification_level: first.verification_tier,
    title: cleanText(input.title, 160) || null,
    pointer,
    repo_url: cleanUrl(input.repoUrl),
    deployment_url: cleanUrl(input.deploymentUrl),
    deployment_status: cleanText(input.deploymentStatus, 40) || null,
    project_status: cleanText(input.projectStatus, 40) || null,
    skills,
    technical_domains: [...new Set(assessed.claims.flatMap(c => c.evidence_meta.technical_domains || []))],
    agency_signals: assessed.agency.map(a => a.id),
    ai_assistance_disclosure: input.aiDisclosure || null,
    detail: {
      // Type-specific fields, kept out of columns because they genuinely vary by type.
      hackathon: input.hackathon || null,
      openSource: input.openSource || null,
      usage: cleanText(input.usage, 300) || null,
      whatIBuilt: cleanText(input.whatIBuilt, 1500) || null,
      challenges: cleanText(input.challenges, 1500) || null,
      learned: cleanText(input.learned, 1500) || null,
    },
    months_operated: Number(input.monthsOperated) || null,
    iterations: Number(input.iterations) || null,
    assigned: Boolean(input.assigned),
  };

  const saved = await checked(member.supabase.from('technical_evidence').insert(row).select('*').single(), null);
  // Degrades rather than throwing when the migration is not applied yet, so the rest of the
  // portal keeps working; the client is told plainly instead of seeing a 500.
  if (!saved) throw new Error('Technical evidence could not be saved. The technical_evidence migration may not be applied yet.');
  return { entry: saved, questions: assessed.questions, agency: assessed.agency, aiDisclosure: assessed.aiDisclosure };
}

export async function loadTechnicalEvidence(member) {
  // optional(), not checked(). checked() throws, and throwing here took the WHOLE student
  // portal down with PORTAL_SCHEMA_MISSING on any deployment where the migration had not been
  // applied. A student's projects, batches and wallet have nothing to do with this table.
  //
  // Third time this exact shape has broken production. The rule: a read added after launch is
  // optional until its migration is universally applied, and nothing inside the request can
  // know whether it has been.
  return optional(member.supabase.from('technical_evidence')
    .select('*').eq('student_user_id', member.user.id)
    .order('created_at', { ascending: false }).limit(60), [], 'technical_evidence');
}

export async function deleteTechnicalEvidence(member, input) {
  const id = cleanText(input.id, 60);
  if (!id) throw new Error('Choose an entry to remove.');
  // Scoped to the owner in the query as well as in RLS: defence in depth costs one clause.
  await member.supabase.from('technical_evidence').delete()
    .eq('id', id).eq('student_user_id', member.user.id);
  return { removed: id };
}

export async function saveMemberVideo(member, input) {
  const url = cleanUrl(input.url);
  if (!url) throw new Error('That recording did not produce a usable link.');
  const row = {
    user_id: member.user.id,
    url,
    label: cleanText(input.label, 120) || null,
    prompt: cleanText(input.prompt, 400) || null,
    duration_seconds: Number.isFinite(Number(input.durationSeconds))
      ? Math.max(0, Math.round(Number(input.durationSeconds))) : null,
  };
  const saved = await checked(member.supabase.from('member_videos').insert(row).select('*').single(), null);
  // Keep the library small enough to pick from at a glance; oldest takes fall off.
  const all = await loadMemberVideos(member);
  const stale = all.slice(VIDEO_LIBRARY_LIMIT);
  if (stale.length) {
    await member.supabase.from('member_videos').delete().in('id', stale.map(v => v.id));
  }
  return saved;
}

export async function loadMemberVideos(member) {
  return optional(
    member.supabase.from('member_videos').select('*').eq('user_id', member.user.id)
      .order('created_at', { ascending: false }).limit(50),
    [], 'member_videos',
  );
}

export async function deleteMemberVideo(member, input) {
  const id = cleanText(input.videoId, 50);
  if (!PROJECT_ID_PATTERN.test(id)) throw new Error('Choose a valid recording.');
  await checked(member.supabase.from('member_videos').delete().eq('id', id).eq('user_id', member.user.id), null);
  return { deleted: true };
}

// Who is behind an open project. Discover listed titles with no company attached, so every
// card read as though it came from Covenda itself. Falls back to the display name, and then to
// an honest placeholder rather than inventing one.
export async function attachPosters(supabase, projects) {
  const list = projects || [];
  const ownerIds = [...new Set(list.map(p => p.owner_user_id).filter(Boolean))];
  if (!ownerIds.length) return list;
  const owners = await checked(
    supabase.from('member_profiles').select('user_id,display_name,organization_name,headline').in('user_id', ownerIds),
    [],
  );
  const byId = new Map((owners || []).map(o => [o.user_id, o]));
  return list.map(project => {
    const owner = byId.get(project.owner_user_id);
    return {
      ...project,
      posterName: owner?.organization_name || owner?.display_name || 'Covenda partner',
      posterHeadline: owner?.headline || null,
    };
  });
}

// ── Company work email ────────────────────────────────────────────────────────────────
// Same shape as the student flow, same honesty about what it proves: an address at a domain,
// not authority to hire or sign for anyone.
export async function requestCompanyVerification(member, input, { env = process.env } = {}) {
  const email = normaliseEmail(input.workEmail);
  const verdict = classifyCompanyEmail(email);
  if (!verdict.ok) throw new Error(verdict.reason);

  // One live code per person: a new request retires the last, so an old code in an old email
  // cannot still be used.
  await member.supabase.from('company_email_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', member.user.id).is('consumed_at', null);

  const code = generateCode();
  await checked(member.supabase.from('company_email_codes')
    .insert({ user_id: member.user.id, email, domain: verdict.registrable, code }).select('id').single(), null);

  const from = env.COVENDA_NOTIFICATION_FROM;
  const keyCheck = usableApiKey(env.RESEND_API_KEY, 'RESEND_API_KEY');
  if (!keyCheck.ok || !from) {
    throw new PortalOperationalError(
      'VERIFY_EMAIL_NOT_CONFIGURED',
      keyCheck.ok
        ? 'Work-email codes are not switched on yet. Covenda will confirm your company by hand in the meantime — nothing is blocked.'
        : keyCheck.reason,
    );
  }
  const apiKey = keyCheck.key;
  const { Resend } = await import('resend');
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email,
    subject: `Covenda verification code: ${code}`,
    text: `Your Covenda work-email verification code is ${code}. It expires in 20 minutes.\n\nThis confirms you read mail at this domain. It is not a sign-in link.`,
  });
  if (error) throw new PortalOperationalError('VERIFY_EMAIL_FAILED', 'Could not send the code. Try again shortly.');

  // Advisory only — a domain unrelated to the trading name is common and never blocking.
  const match = domainMatchesCompany(email, input.companyName || '');
  return { sent: true, domain: verdict.registrable, match };
}

export async function confirmCompanyVerification(member, input) {
  const record = await checked(member.supabase.from('company_email_codes')
    .select('*').eq('user_id', member.user.id).is('consumed_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle(), null);

  const verdict = checkCode(record, input.code, new Date());
  if (!verdict.ok) throw new Error(verdict.reason);

  const now = new Date().toISOString();
  await member.supabase.from('company_email_codes').update({ consumed_at: now }).eq('id', record.id);
  await checked(member.supabase.from('member_profiles').update({
    work_email_verified_at: now,
    work_email_domain: record.domain,
  }).eq('user_id', member.user.id), null);
  return { verified: true, domain: record.domain };
}

export async function loadCompanyStanding(member, profile) {
  try {
    const domain = profile?.work_email_domain || null;
    // How many people at this domain have confirmed. Proves only that — and says so.
    const peers = domain
      ? await checked(member.supabase.from('member_profiles').select('user_id')
          .eq('work_email_domain', domain).not('work_email_verified_at', 'is', null), [])
      : [];
    return companyVerificationStanding({
      emailVerifiedAt: profile?.work_email_verified_at || null,
      domain,
      teamVerifiedCount: (peers || []).length,
    });
  } catch {
    return companyVerificationStanding({});
  }
}

// ── The public company profile ────────────────────────────────────────────────────────
// What a student reaches by clicking the company name on a posted project. Published is
// opt-in: a half-filled draft should not be what a student judges the company on.
const COMPANY_TEXT_FIELDS = [
  ['companyName', 'company_name', 160], ['logoUrl', 'logo_url', 500], ['websiteUrl', 'website_url', 500],
  ['location', 'location', 160], ['remotePolicy', 'remote_policy', 120], ['teamSize', 'team_size', 60],
  ['stage', 'stage', 60], ['oneLiner', 'one_liner', 300], ['industry', 'industry', 120],
  ['idealCustomer', 'ideal_customer', 400], ['currentPriorities', 'current_priorities', 1200],
  ['studentGain', 'student_gain', 1200], ['workExamples', 'work_examples', 1200],
  ['workEnvironment', 'work_environment', 800], ['weeklyHours', 'weekly_hours', 80],
  ['compensationApproach', 'compensation_approach', 400], ['workAuthorization', 'work_authorization', 400],
  ['hiringTimeline', 'hiring_timeline', 300],
];
const COMPANY_LIST_FIELDS = [
  ['techStack', 'tech_stack'], ['departments', 'departments'], ['commonTools', 'common_tools'],
  ['capabilityAreas', 'capability_areas'], ['engagementTypes', 'engagement_types'], ['links', 'links'],
];

export async function saveCompanyProfile(member, input) {
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'company') throw new Error('Only company accounts have a company profile.');

  const row = { user_id: member.user.id, updated_at: new Date().toISOString() };
  for (const [key, column, max] of COMPANY_TEXT_FIELDS) {
    if (input[key] !== undefined) row[column] = cleanText(input[key], max) || null;
  }
  for (const [key, column] of COMPANY_LIST_FIELDS) {
    if (input[key] !== undefined) {
      row[column] = (Array.isArray(input[key]) ? input[key] : String(input[key] || '').split(','))
        .map(v => cleanText(typeof v === 'string' ? v : JSON.stringify(v), 200)).filter(Boolean).slice(0, 40);
    }
  }
  if (!row.company_name) {
    const existing = await checked(member.supabase.from('company_profiles').select('company_name').eq('user_id', member.user.id).maybeSingle(), null);
    row.company_name = existing?.company_name || cleanText(input.companyName, 160);
  }
  if (!row.company_name) throw new Error('Enter your company name.');
  if (input.published !== undefined) row.published = Boolean(input.published);

  return checked(member.supabase.from('company_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single(), null);
}

export async function loadCompanyProfile(member) {
  return optional(member.supabase.from('company_profiles').select('*').eq('user_id', member.user.id).maybeSingle(), null, 'company_profiles');
}

// A student opening a company from a project. Published only — and the caller must already
// be a signed-in member, which the route guarantees.
export async function loadPublicCompanyProfile(member, ownerUserId) {
  const id = cleanText(ownerUserId, 60);
  if (!id) throw new Error('Choose a company.');
  const row = await checked(member.supabase.from('company_profiles')
    .select('*').eq('user_id', id).eq('published', true).maybeSingle(), null);
  if (!row) return { profile: null, reason: 'This company has not published a profile yet.' };
  const owner = await checked(member.supabase.from('member_profiles')
    .select('work_email_verified_at,work_email_domain').eq('user_id', id).maybeSingle(), null);
  return {
    profile: row,
    // Stated for what it is. A confirmed address is not a Covenda endorsement.
    workEmailConfirmed: Boolean(owner?.work_email_verified_at),
    domain: owner?.work_email_domain || null,
  };
}

// ── Stage 3: the founder in the loop ──────────────────────────────────────────────────
// A proposed brief is a draft until the founder says otherwise. They can change scope, add
// constraints, reject a deliverable, or correct the diagnosis — and every edit is stored
// with its reason, because those reasons are the best signal we will ever get about what
// founders actually want. Same rule as human_rationale on matches: no reason, no save.
const BRIEF_EDITABLE = {
  statedProblem: 'stated_problem',
  likelyProblem: 'likely_problem',
  valueToCompany: 'value_to_company',
  rootCauseClass: 'root_cause_class',
};

export async function reviseBrief(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const project = await checked(member.supabase.from('member_projects').select('*').eq('id', projectId).maybeSingle(), null);
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the company that owns this brief can change it.');

  const field = cleanText(input.field, 60);
  const column = BRIEF_EDITABLE[field];
  if (!column) throw new Error('That part of the brief cannot be edited here.');
  const value = cleanText(input.value, 4000);
  const reason = cleanText(input.reason, 1000);

  // recordRevision throws without a reason; let that message reach the founder unchanged.
  const history = recordRevision(project.brief_revisions || [], {
    field, from: project[column], to: value, reason,
    by: member.user.id, at: new Date().toISOString(),
  });

  return checked(member.supabase.from('member_projects').update({
    [column]: value || null,
    brief_revisions: history,
    brief_version: briefVersion(history),
    // Any edit reopens approval — a founder should never be shown as having approved
    // something they then changed.
    brief_approved_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', project.id).select('*').single(), null);
}

export async function approveBrief(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const project = await checked(member.supabase.from('member_projects').select('*').eq('id', projectId).maybeSingle(), null);
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the company that owns this brief can approve it.');

  // Re-check at the gate. A brief edited into uselessness should not ship because it passed
  // when it was first proposed.
  const verdict = evaluateBrief({
    valueToCompany: project.value_to_company,
    discriminatingSignal: project.discriminating_signal || [],
    inputsRequired: project.inputs_required || [],
    founderTimeRequired: project.founder_time_budget_min_week,
    gradingRubric: (project.grading_rubric || {}).anchors,
    rubricSkill: (project.grading_rubric || {}).skill,
    estimatedHours: project.estimated_hours,
    title: project.title, deliverable: project.deliverable,
  });
  if (!verdict.ok) {
    const err = new Error(verdict.refusal.reasons[0]);
    err.reasons = verdict.refusal.reasons;
    throw err;
  }

  return checked(member.supabase.from('member_projects').update({
    brief_approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', project.id).select('*').single(), null);
}

// The ideal intern, in the founder's words. Traits and skills are kept apart deliberately:
// a skill can be evidenced from an artifact, a trait cannot, and putting "self-starter" in
// the same list as a verified capability would imply they are comparable.
//
// The memo is the part the brief engine reads. A skill list says what to filter on; the memo
// says what the work is FOR, which is what decides whether a trial discriminates usefully.
export async function saveIdealIntern(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const project = await checked(member.supabase.from('member_projects').select('id,owner_user_id').eq('id', projectId).maybeSingle(), null);
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the company on this project can describe the role.');

  const list = value => (Array.isArray(value) ? value : String(value || '').split(','))
    .map(v => cleanText(v, 80)).filter(Boolean).slice(0, 12);

  const memo = cleanText(input.memo, 2000);
  if (memo.length < 20) throw new Error('Say why you need this person — a skills list on its own does not scope a trial.');

  return checked(member.supabase.from('member_projects').update({
    ideal_traits: list(input.traits),
    ideal_skills: list(input.skills),
    ideal_memo: memo,
    updated_at: new Date().toISOString(),
  }).eq('id', project.id).select('*').single(), null);
}

// ── Company backend: the answers a founder actually opens the portal for ──────────────
// The company dashboard reported counts. Counts tell you the size of a pile, not what to do
// with it. These are the four questions a founder has when they log in, answered from rows
// rather than from a stored summary that can drift.
export async function companyBriefing(member) {
  const [projects, applications] = await Promise.all([
    checked(member.supabase.from('member_projects').select('*').eq('owner_user_id', member.user.id).limit(200), []),
    optional(member.supabase.from('project_applications').select('*').limit(500), [], 'project_applications'),
  ]);

  const mine = new Set((projects || []).map(p => p.id));
  const apps = (applications || []).filter(a => mine.has(a.project_id));
  const now = Date.now();
  const daysSince = t => (!t ? null : Math.floor((now - Date.parse(t)) / 86400000));

  // 1. What is waiting on ME. The only list where inaction has a cost to someone else.
  const blocking = [];
  for (const p of projects) {
    if (p.status === 'review') {
      blocking.push({ kind: 'deliverable', projectId: p.id, title: p.title,
        waitingDays: daysSince(p.deliverable_submitted_at),
        // A student who submitted and heard nothing is the failure this platform exists to
        // prevent, so it is named first and by name.
        note: 'A student is waiting on your review.' });
    }
    if (p.value_to_company && !p.brief_approved_at) {
      blocking.push({ kind: 'brief', projectId: p.id, title: p.title, waitingDays: daysSince(p.updated_at),
        note: 'A proposed trial is waiting for your approval.' });
    }
  }
  const newApps = apps.filter(a => a.status === 'submitted');
  if (newApps.length) {
    blocking.push({ kind: 'applications', count: newApps.length, note: `${newApps.length} ${newApps.length === 1 ? 'application' : 'applications'} nobody has opened.` });
  }

  // 2. What is running without me.
  const running = projects.filter(p => ['matched', 'in_progress'].includes(p.status))
    .map(p => ({ projectId: p.id, title: p.title, status: p.status,
      startedDays: daysSince(p.updated_at),
      // Approved but not started is a distinct state and worth surfacing — it usually means
      // the student is hesitating, not that the work has stalled.
      note: p.status === 'matched' ? 'Approved; the student has not started yet.' : 'In progress.' }));

  // 3. What it has cost and returned. Money first, because it is the number a founder
  //    actually tracks, and vague spend is how a pilot loses trust.
  const held = projects.reduce((n, p) => n + (Number(p.credits_held) || 0), 0);
  const spent = projects.filter(p => p.status === 'complete')
    .reduce((n, p) => n + (Number(p.credits_listed) || 0), 0);
  const completed = projects.filter(p => p.status === 'complete').length;

  // 4. What we learned. Empty until outcomes exist, and it says so rather than showing zeros
  //    that look like failure.
  const surveys = projects.filter(p => p.outcome_survey).map(p => p.outcome_survey);
  const learned = surveys.length
    ? {
        answered: surveys.length,
        wouldUseAgain: surveys.filter(s => s.wouldUseAgain).length,
        avgShortlistRelevance: Math.round(
          surveys.filter(s => s.shortlistRelevant).reduce((n, s) => n + s.shortlistRelevant, 0)
          / Math.max(1, surveys.filter(s => s.shortlistRelevant).length) * 10) / 10,
      }
    : null;

  return {
    blocking: blocking.sort((a, b) => (b.waitingDays || 0) - (a.waitingDays || 0)),
    running,
    money: { heldInEscrow: held, releasedOnCompletedWork: spent, completedProjects: completed },
    learned,
    // Said plainly rather than rendering an empty dashboard that reads as failure.
    emptyReason: projects.length ? null : 'Nothing posted yet. Describe a problem and we will scope the trial.',
  };
}

// ── Step 5: introductions ─────────────────────────────────────────────────────────────
// A company can reach a student at any point. The terms go with the ask, always — an
// introduction that leaves out the money or the hours is how students get strung along.
export async function requestIntroduction(member, input) {
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'company') throw new Error('Only company accounts can request an introduction.');

  const verdict = checkIntroduction({
    roleSummary: input.roleSummary, whyRelevant: input.whyRelevant, compensation: input.compensation,
    timeCommitment: input.timeCommitment, nextStep: input.nextStep,
  });
  if (!verdict.ok) throw new Error(verdict.reason);

  const studentUserId = cleanText(input.studentUserId, 60);
  if (!studentUserId) throw new Error('Choose a student.');
  const projectId = cleanText(input.projectId, 50);

  const row = {
    company_user_id: member.user.id,
    student_user_id: studentUserId,
    project_id: PROJECT_ID_PATTERN.test(projectId) ? projectId : null,
    role_summary: cleanText(input.roleSummary, 500),
    why_relevant: cleanText(input.whyRelevant, 800),
    compensation: cleanText(input.compensation, 200),
    time_commitment: cleanText(input.timeCommitment, 200),
    next_step: cleanText(input.nextStep, 300),
    message: cleanText(input.message, 2000) || null,
  };
  // Repeated asks to the same student about the same thing are pressure, not outreach —
  // the unique constraint refuses a second live one, and this says so plainly.
  const existing = await checked(member.supabase.from('introductions').select('id,status')
    .eq('company_user_id', member.user.id).eq('student_user_id', studentUserId)
    .eq('project_id', row.project_id).maybeSingle(), null);
  if (existing) throw new Error('You have already reached out to this student about this. Wait for their answer.');

  const intro = await checked(member.supabase.from('introductions').insert(row).select('*').single(), null);
  // An introduction the student never sees is an introduction that never happened. They
  // decide whether to accept, so they have to be told it exists.
  const sent_intro = await notifyMember(member.supabase, {
    toUserId: studentUserId,
    idempotencyKey: `covenda-intro-${intro?.id || studentUserId}`,
    build: ({ to, from, portalUrl }) => introductionEmail({ to, from, companyName: null, roleSummary: row.role_summary || null, portalUrl }),
    env: process.env,
  });
  await recordDelivery(member.supabase, { event: 'intro', result: sent_intro, toUserId: studentUserId });
  return intro;
}

export async function respondToIntroduction(member, input) {
  const id = cleanText(input.introductionId, 50);
  if (!PROJECT_ID_PATTERN.test(id)) throw new Error('Choose a valid introduction.');
  const intro = await checked(member.supabase.from('introductions').select('*').eq('id', id).maybeSingle(), null);
  if (!intro || intro.student_user_id !== member.user.id) throw new Error('This introduction is not yours to answer.');

  const patch = applyResponse(intro, cleanText(input.response, 20), cleanText(input.note, 2000));
  return checked(member.supabase.from('introductions').update({
    ...patch, responded_at: new Date().toISOString(),
  }).eq('id', intro.id).select('*').single(), null);
}

export async function loadIntroductions(member, role) {
  const column = role === 'student' ? 'student_user_id' : 'company_user_id';
  return optional(member.supabase.from('introductions').select('*')
    .eq(column, member.user.id).order('created_at', { ascending: false }).limit(50), [], 'introductions');
}

// ── Step 6: what actually happened ────────────────────────────────────────────────────
// conversion_outcome already records the result. This records what the company learned,
// which is the only thing that will ever tell us whether the matching works.
export async function recordOutcomeSurvey(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const project = await checked(member.supabase.from('member_projects').select('id,owner_user_id').eq('id', projectId).maybeSingle(), null);
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the company on this project can answer this.');

  const result = normaliseOutcome(input.answers || {});
  if (!result.ok) throw new Error('Answer whether the shortlist was relevant and whether you would use Covenda again.');

  return checked(member.supabase.from('member_projects').update({
    outcome_survey: result.answers,
    outcome_survey_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', project.id).select('*').single(), null);
}

export const OUTCOME_SURVEY_QUESTIONS = OUTCOME_QUESTIONS;

// ── Step 7: company referrals ─────────────────────────────────────────────────────────
export async function loadCompanyReferrals(member) {
  const rows = await optional(member.supabase.from('company_referrals').select('*')
    .eq('referrer_user_id', member.user.id).order('created_at', { ascending: false }).limit(50), [], 'company_referrals');
  return (rows || []).map(r => ({ ...r, standing: referralStatus(r) }));
}

export async function createCompanyReferral(member) {
  const profile = await checked(member.supabase.from('member_profiles').select('role').eq('user_id', member.user.id).maybeSingle(), null);
  if (profile?.role !== 'company') throw new Error('Only company accounts can refer another company.');
  const code = 'CR-' + randomToken(6).toUpperCase();
  return checked(member.supabase.from('company_referrals')
    .insert({ referrer_user_id: member.user.id, code }).select('*').single(), null);
}

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
  // A club nobody can look up is a club nobody can confirm.
  if (!cleanUrl(input.websiteUrl) && !cleanUrl(input.socialUrl)) {
    throw new Error('Add the club’s website or Instagram. We need somewhere to check it is real.');
  }
  const row = {
    slug: clubSlug(name, cleanText(input.school, 80)),
    name,
    school: cleanText(input.school, 120) || null,
    vertical_slug: cleanText(input.verticalSlug, 60) || null,
    contact_email: cleanEmail(input.email) || null,
    contact_role: cleanText(input.role, 80) || null,
    // The cheapest real evidence a club exists. For most student clubs the Instagram IS the
    // presence, so it is a peer of the website rather than a fallback.
    website_url: cleanUrl(input.websiteUrl) || null,
    social_url: cleanUrl(input.socialUrl) || null,
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

// ── Club officer confirmation ─────────────────────────────────────────────────────────
// Officers will not create accounts to vouch for someone — they are volunteers with a term of
// office, and a signup wall is where this dies. So the student generates a single-use link
// and sends it to their officer themselves. The officer states who they are and decides.
export async function createClubConfirmation(member, input) {
  const clubId = cleanText(input.clubId, 50);
  if (!PROJECT_ID_PATTERN.test(clubId)) throw new Error('Choose a valid club.');
  const membership = await checked(member.supabase.from('club_members')
    .select('id,status').eq('club_id', clubId).eq('student_user_id', member.user.id).maybeSingle(), null);
  if (!membership) throw new Error('Claim this club first, then send it for confirmation.');
  if (membership.status === 'confirmed') throw new Error('This membership is already confirmed.');

  // One live token per (student, club): a new request retires the last, so an old link in an
  // old message cannot still confirm.
  await member.supabase.from('club_confirmations')
    .update({ status: 'expired', decided_at: new Date().toISOString() })
    .eq('student_user_id', member.user.id).eq('club_id', clubId).eq('status', 'pending');

  const token = randomToken(32);
  const row = await checked(member.supabase.from('club_confirmations')
    .insert({ token, club_id: clubId, student_user_id: member.user.id, membership_id: membership.id })
    .select('token,expires_at').single(), null);
  return { token: row.token, expiresAt: row.expires_at };
}

// Called from the public confirmation page. No session — the token IS the credential, so it
// is single-use, expiring, and the officer must put a name to the decision.
export async function resolveClubConfirmation(supabase, token) {
  const clean = cleanText(token, 80);
  if (!clean) return null;
  const row = await checked(supabase.from('club_confirmations').select('*').eq('token', clean).maybeSingle(), null);
  if (!row) return null;
  if (row.status !== 'pending') return { ...row, usable: false, reason: 'This link has already been used.' };
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
    return { ...row, usable: false, reason: 'This link has expired. Ask the student to send a new one.' };
  }
  const [club, student] = await Promise.all([
    checked(supabase.from('clubs').select('id,name,school').eq('id', row.club_id).maybeSingle(), null),
    checked(supabase.from('member_profiles').select('display_name,school_name').eq('user_id', row.student_user_id).maybeSingle(), null),
  ]);
  return { ...row, usable: true, club, studentName: student?.display_name || 'This student', studentSchool: student?.school_name || null };
}

export async function decideClubConfirmation(supabase, input) {
  const record = await resolveClubConfirmation(supabase, input.token);
  if (!record) throw new Error('That confirmation link is not valid.');
  if (!record.usable) throw new Error(record.reason);

  const confirmed = input.decision === 'confirm';
  const name = cleanText(input.officerName, 120);
  if (confirmed && name.length < 2) throw new Error('Enter your name. A confirmation nobody has put their name to is worth nothing.');

  const now = new Date().toISOString();
  await checked(supabase.from('club_confirmations').update({
    status: confirmed ? 'confirmed' : 'declined',
    officer_name: name || null,
    officer_email: cleanEmail(input.officerEmail) || null,
    officer_role: cleanText(input.officerRole, 80) || null,
    decided_at: now,
  }).eq('id', record.id), null);

  await checked(supabase.from('club_members').update({
    status: confirmed ? 'confirmed' : 'rejected',
    confirmed_at: confirmed ? now : null,
  }).eq('id', record.membership_id), null);

  return { confirmed, club: record.club?.name || 'the club', student: record.studentName };
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
    fit_precise: fit.precise,
    fit_compared_on: fit.comparedOn,
    fit_concerns: fit.concerns,
    fit_reasons: fit.reasons,
  };
  // If the rich-application migration hasn't been applied yet, the extra columns don't exist —
  // fall back to the base insert so a student can always apply; the fields fill in once it runs.
  let { data: application, error } = await member.supabase.from('project_applications').insert(richRow).select('*').single();
  if (error) ({ data: application, error } = await member.supabase.from('project_applications').insert(baseRow).select('*').single());
  if (error) throw error;
  await logMatchEvent(member, { projectId, studentUserId: member.user.id, eventType: 'applied', fit, features: { project: pick(project, ['verticals', 'work_types', 'desired_skills', 'credits_listed']), student: pick(profile, ['verticals', 'work_types', 'skills']) } });
  // Best-effort: tell the project owner a new applicant arrived. Never blocks the application.
  const sent_applied = await notifyMember(member.supabase, {
    toUserId: project.owner_user_id,
    idempotencyKey: `covenda-applied-${application.id}`,
    build: ({ to, from, portalUrl }) => applicationReceivedEmail({ to, from, projectTitle: project.title, studentName: profile.display_name, portalUrl }),
    env,
  });
  await recordDelivery(member.supabase, { event: 'applied', result: sent_applied, toUserId: project.owner_user_id });
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
  if (project.assigned_student_user_id) throw new Error('This project already has an assigned student.');
  // Never approve someone onto paid work whose payment is not already held.
  const listed = Number(project.credits_listed) || 0;
  if (listed > 0 && Number(project.credits_held) < listed) {
    throw new Error('The payment for this project is not fully held yet, so nobody can be approved to start it. Top up your balance and repost.');
  }
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
  // Assign the student, move the project into progress, and lay down the milestone schedule.
  // The first checkpoint lands inside 24-72h on purpose: it is the cheapest signal that
  // someone has actually started, and it surfaces a flake while the work can still move.
  // `project` is already a select('*') from above — refetching it cost a round-trip and
  // bought nothing.
  // The student is approved, not started. `matched` + an assigned student is the approved-
  // and-waiting state; the student's own confirmation moves it to in_progress and starts the
  // milestone clock. Two reasons: nobody should be doing work they have not agreed to begin,
  // and a schedule that starts before they do makes them late for a project they never opened.
  await checked(
    member.supabase.from('member_projects').update({
      assigned_student_user_id: application.student_user_id,
      status: 'matched',
      updated_at: now,
    }).eq('id', project.id).select('id').single(),
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
  const sent_accepted = await notifyMember(member.supabase, {
    toUserId: application.student_user_id,
    idempotencyKey: `covenda-accepted-${application.id}`,
    build: ({ to, from, portalUrl }) => applicationDecisionEmail({ to, from, projectTitle: project.title, accepted: true, portalUrl }),
  });
  await recordDelivery(member.supabase, { event: 'accepted', result: sent_accepted, toUserId: application.student_user_id });
  return accepted;
}

// The student starts the work, not the company. Until this is called, an approved student has
// committed to nothing and has no clock running against them.
export async function startTrial(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const project = await checked(member.supabase.from('member_projects').select('*').eq('id', projectId).maybeSingle(), null);
  if (!project) throw new Error('This project is no longer available.');
  if (project.assigned_student_user_id !== member.user.id) throw new Error('Only the approved student can start this work.');
  if (project.status === 'in_progress') return project;
  if (project.status !== 'matched') throw new Error('This project is not waiting to be started.');

  const now = new Date().toISOString();
  const milestones = buildMilestoneSchedule(project, { startAt: now });
  const started = await checked(member.supabase.from('member_projects').update({
    status: 'in_progress',
    updated_at: now,
    ...(milestones.length ? { milestones } : {}),
  }).eq('id', project.id).select('*').single(), null);

  // Both sides need to know the clock has started, or a deadline arrives as a surprise.
  for (const toUserId of [started?.assigned_student_user_id, started?.owner_user_id].filter(Boolean)) {
    const sent_trial_start = await notifyMember(member.supabase, {
      toUserId,
      idempotencyKey: `covenda-trial-start-${project.id}-${toUserId}`,
      build: ({ to, from, portalUrl }) => trialStartedEmail({ to, from, projectTitle: started?.title, portalUrl }),
      env: process.env,
    });
    await recordDelivery(member.supabase, { event: 'trial-start', result: sent_trial_start, toUserId: null });
  }
  return started;
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
  const sent_declined = await notifyMember(member.supabase, {
    toUserId: application.student_user_id,
    idempotencyKey: `covenda-declined-${application.id}`,
    build: ({ to, from, portalUrl }) => applicationDecisionEmail({ to, from, projectTitle: project.title, accepted: false, portalUrl }),
  });
  await recordDelivery(member.supabase, { event: 'declined', result: sent_declined, toUserId: application.student_user_id });
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
  // Uploaded files are the work itself; links are what points at work hosted elsewhere. Both
  // land in the deliverable so a reviewer sees one artifact list, not two.
  const rawFiles = Array.isArray(input.deliverableFiles) ? input.deliverableFiles : [];
  const files = rawFiles
    .map(f => ({ name: cleanText(f?.name, 120), url: cleanUrl(f?.url) }))
    .filter(f => f.name && f.url)
    .slice(0, 10);
  const parts = [summary];
  if (files.length) parts.push('Files:\n' + files.map(f => `- ${f.name} — ${f.url}`).join('\n'));
  if (links.length) parts.push('Links:\n' + links.map(link => `- ${link}`).join('\n'));
  const body = parts.join('\n\n');
  const now = new Date().toISOString();
  // Clear any prior revision note so a stale "changes requested" message does not linger after resubmission.
  const submitted = await checked(
    member.supabase.from('member_projects').update({ deliverable: body, status: 'review', deliverable_submitted_at: now, review_note: null, updated_at: now }).eq('id', projectId).select('*').single(),
    null,
  );
  // The moment a trial most often stalls: the student is finished and the company has no way
  // to know. Best-effort — a mail failure must never lose the submission itself.
  if (submitted?.owner_user_id) {
    const sent_submitted = await notifyMember(member.supabase, {
      toUserId: submitted.owner_user_id,
      idempotencyKey: `covenda-submitted-${projectId}-${now}`,
      build: ({ to, from, portalUrl }) => deliverableSubmittedEmail({ to, from, projectTitle: submitted.title, portalUrl }),
      env: process.env,
    });
    await recordDelivery(member.supabase, { event: 'submitted', result: sent_submitted, toUserId: submitted.owner_user_id });
  }
  return submitted;
}

export async function reviewDeliverable(member, input) {
  const projectId = cleanText(input.projectId, 50);
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('Choose a valid project.');
  const decision = input.decision === 'accept' ? 'accept' : input.decision === 'revise' ? 'revise' : '';
  if (!decision) throw new Error('Choose accept or request changes.');
  const note = cleanText(input.note, 2_000);
  if (decision === 'revise' && !note) throw new Error('Add a note so the student knows what to revise.');
  const project = await checked(
    member.supabase.from('member_projects').select('id,owner_user_id,status,assigned_student_user_id,title').eq('id', projectId).maybeSingle(),
    null,
  );
  if (!project || project.owner_user_id !== member.user.id) throw new Error('Only the project owner can review a deliverable.');
  if (project.status !== 'review') throw new Error('This project has no submitted deliverable to review.');

  // THE LABEL GATE. `label = 1` requires acceptance AND a yes to "would you request this
  // student for future work". Without the answer there is no label, so accepting cannot be
  // allowed to proceed without it — this is the only source of supervision the re-ranker
  // will ever have, and a skip option here silently empties the training set.
  const wouldRequestAgain = input.wouldRequestAgain;
  if (decision === 'accept' && typeof wouldRequestAgain !== 'boolean') {
    const err = new Error('Answer one question to close this out: would you request this student for future work?');
    err.code = 'CLOSEOUT_RATING_REQUIRED';
    throw err;
  }
  const now = new Date().toISOString();

  if (decision === 'revise') {
    // No credit movement — the escrow stays held while the student reworks it.
    const revised = await checked(
      member.supabase.from('member_projects').update({ status: 'in_progress', review_note: note, updated_at: now }).eq('id', projectId).select('*').single(),
      null,
    );
    // A change request nobody is told about is a project that quietly stops.
    if (revised?.assigned_student_user_id) {
      const sent_revise = await notifyMember(member.supabase, {
        toUserId: revised.assigned_student_user_id,
        idempotencyKey: `covenda-revise-${projectId}-${now}`,
        build: ({ to, from, portalUrl }) => deliverableReviewedEmail({ to, from, projectTitle: revised.title, accepted: false, note, portalUrl }),
        env: process.env,
      });
      await recordDelivery(member.supabase, { event: 'revise', result: sent_revise, toUserId: revised.assigned_student_user_id });
    }
    return revised;
  }

  // Accepting settles money, so the ledger writes and the status change must commit
  // together. The database function does both under a row lock; if it fails, nothing
  // moves and the project stays in review rather than completing unpaid.
  if (note) {
    await checked(member.supabase.from('member_projects').update({ review_note: note, updated_at: now, closeout_rating: wouldRequestAgain, closeout_at: now }).eq('id', projectId).select('id').single(), null);
    // Terminal events in the label pipeline's vocabulary. The rating rides on the event
    // rather than only the project row, because the materialiser reads events.
    await logMatchEvent(member, { projectId, eventType: 'deliverable_accepted', matchId: projectId });
    await logMatchEvent(member, { projectId, eventType: 'closeout_rating', matchId: projectId, meta: { wouldRequestAgain } });
  }
  const released = await checked(member.supabase.rpc('release_project_escrow', { p_project_id: projectId, p_owner_id: member.user.id }), null);
  // Acceptance is what the student has been waiting weeks for, and it is what issues their
  // verified work record. Telling them is not optional.
  if (project.assigned_student_user_id) {
    const sent_accepted = await notifyMember(member.supabase, {
      toUserId: project.assigned_student_user_id,
      idempotencyKey: `covenda-accepted-${projectId}-${now}`,
      build: ({ to, from, portalUrl }) => deliverableReviewedEmail({ to, from, projectTitle: project.title, accepted: true, portalUrl }),
      env: process.env,
    });
    await recordDelivery(member.supabase, { event: 'accepted', result: sent_accepted, toUserId: project.assigned_student_user_id });
  }
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
    if (req.method === 'POST' && input.action === 'verify-work-email') return res.status(200).json({ ok: true, ...(await requestCompanyVerification(member, input, dependencies)) });
    if (req.method === 'POST' && input.action === 'confirm-work-email') return res.status(200).json({ ok: true, ...(await confirmCompanyVerification(member, input)) });
    if (req.method === 'POST' && input.action === 'save-company-profile') return res.status(200).json({ ok: true, companyProfile: await saveCompanyProfile(member, input) });
    if (req.method === 'POST' && input.action === 'company-profile') return res.status(200).json({ ok: true, ...(await loadPublicCompanyProfile(member, input.ownerUserId)) });
    if (req.method === 'POST' && input.action === 'revise-brief') return res.status(200).json({ ok: true, project: await reviseBrief(member, input) });
    if (req.method === 'POST' && input.action === 'approve-brief') return res.status(200).json({ ok: true, project: await approveBrief(member, input) });
    if (req.method === 'POST' && input.action === 'ideal-intern') return res.status(200).json({ ok: true, project: await saveIdealIntern(member, input) });
    if (req.method === 'POST' && input.action === 'request-introduction') return res.status(201).json({ ok: true, introduction: await requestIntroduction(member, input) });
    if (req.method === 'POST' && input.action === 'respond-introduction') return res.status(200).json({ ok: true, introduction: await respondToIntroduction(member, input) });
    if (req.method === 'POST' && input.action === 'outcome-survey') return res.status(200).json({ ok: true, project: await recordOutcomeSurvey(member, input) });
    if (req.method === 'POST' && input.action === 'create-company-referral') return res.status(201).json({ ok: true, referral: await createCompanyReferral(member) });
    if (req.method === 'POST' && input.action === 'save-company-environment') return res.status(201).json({ ok: true, ...(await saveCompanyEnvironment(member, input)) });
    if (req.method === 'POST' && input.action === 'assessment-disclosure') return res.status(200).json({ ok: true, ...(await assessmentDisclosure(member, input)) });
    if (req.method === 'POST' && input.action === 'assessment-component') return res.status(200).json({ ok: true, ...(await assessmentComponent(member, input)) });
    if (req.method === 'POST' && input.action === 'submit-component') return res.status(200).json({ ok: true, ...(await submitComponent(member, input)) });
    if (req.method === 'POST' && input.action === 'start-assessment') return res.status(201).json({ ok: true, ...(await startAssessmentRun(member, input)) });
    if (req.method === 'POST' && input.action === 'save-evidence-request') return res.status(201).json({ ok: true, ...(await saveEvidenceRequest(member, input)) });
    if (req.method === 'POST' && input.action === 'delete-evidence-request') return res.status(200).json({ ok: true, ...(await deleteEvidenceRequest(member, input)) });
    if (req.method === 'POST' && input.action === 'save-technical-evidence') return res.status(201).json({ ok: true, ...(await saveTechnicalEvidence(member, input)) });
    if (req.method === 'POST' && input.action === 'delete-technical-evidence') return res.status(200).json({ ok: true, ...(await deleteTechnicalEvidence(member, input)) });
    if (req.method === 'POST' && input.action === 'save-video') return res.status(201).json({ ok: true, video: await saveMemberVideo(member, input) });
    if (req.method === 'POST' && input.action === 'delete-video') return res.status(200).json({ ok: true, ...(await deleteMemberVideo(member, input)) });
    if (req.method === 'POST' && input.action === 'register-club') return res.status(201).json({ ok: true, club: await registerClub(member, input) });
    if (req.method === 'POST' && input.action === 'club-confirmation-link') return res.status(201).json({ ok: true, ...(await createClubConfirmation(member, input)) });
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
    if (req.method === 'POST' && input.action === 'start-trial') return res.status(200).json({ ok: true, project: await startTrial(member, input) });
    if (req.method === 'POST' && input.action === 'submit-deliverable') return res.status(200).json({ ok: true, project: await submitDeliverable(member, input) });
    if (req.method === 'POST' && input.action === 'review-deliverable') return res.status(200).json({ ok: true, project: await reviewDeliverable(member, input) });
    if (req.method === 'POST' && input.action === 'buy-credits') return res.status(200).json({ ok: true, ...(await buyCredits(member, input, dependencies.env || process.env)) });
    if (req.method === 'POST' && input.action === 'start-simulation') return res.status(200).json({ ok: true, ...(await startSimulation(member, input)) });
    if (req.method === 'POST' && input.action === 'advance-simulation') return res.status(200).json({ ok: true, ...(await advanceSimulation(member, input)) });
    if (req.method === 'POST' && input.action === 'save-transcript') return res.status(200).json({ ok: true, result: await saveTranscript(member, input) });
    if (req.method === 'POST' && input.action === 'request-accommodation') return res.status(200).json({ ok: true, result: await requestAccommodation(member, input) });
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
