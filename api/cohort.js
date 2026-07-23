// §9 public cohort page. A partner (professor / club / career center) shares a link keyed by
// their referral code; this endpoint returns an AGGREGATE, PII-FREE view of the students traced
// to that code — a funnel of endorsed → applied → employer-verified plus an industry mix. It
// never returns individual names or emails, so the page is safe to share publicly. Numbers are
// always REAL (counted from stored rows); an unknown code returns an honest empty cohort, not an
// error, so the endpoint can't be used to confirm/deny which codes exist beyond the counts.
import { createClient } from '@supabase/supabase-js';
import { supabaseConfiguration } from './submissions.js';

const CODE_PATTERN = /^REF-[A-Z0-9]{4,20}$/;

export function cleanCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // direct navigation / same-origin fetch without an Origin header
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

// Pure, testable aggregation. Takes the raw rows already narrowed to this code and produces the
// public shape. Kept free of I/O so the funnel logic can be unit-tested deterministically.
export function summarizeCohort({ code, endorsementSubs = [], codedApplications = [], completedStudentIds = new Set(), employerSubs = [] }) {
  let orgName = '';
  const rosterEmails = new Set();
  const industries = {};
  for (const sub of endorsementSubs) {
    const details = sub?.details || {};
    if (!orgName && details.contact?.company) orgName = String(details.contact.company).slice(0, 120);
    for (const endorsement of (Array.isArray(details.endorsements) ? details.endorsements : [])) {
      const email = String(endorsement?.email || '').trim().toLowerCase();
      if (email) rosterEmails.add(email);
      const fn = String(endorsement?.function || '').trim() || 'Unspecified';
      industries[fn] = (industries[fn] || 0) + 1;
    }
  }
  const applicantStudents = new Set(codedApplications.map(a => a?.student_user_id).filter(Boolean));
  const verifiedStudents = [...applicantStudents].filter(id => completedStudentIds.has(id));
  const endorsedCount = rosterEmails.size;
  const appliedCount = applicantStudents.size;
  const verifiedCount = verifiedStudents.length;
  // Employer-side attribution (GTM Move 3): firms that arrived via this partner's referral code.
  // Distinct by contact/submitter email so a firm that submits twice counts once. PII-free output.
  const firmEmails = new Set();
  for (const sub of employerSubs) {
    const details = sub?.details || {};
    const email = String(details.contact?.email || sub?.submitter_email || '').trim().toLowerCase();
    if (email) firmEmails.add(email);
  }
  const referredFirms = firmEmails.size;
  const industryList = Object.entries(industries)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  return {
    code,
    orgName,
    endorsedCount,
    appliedCount,
    verifiedCount,
    referredFirms,
    industries: industryList,
    // A partner-friendly funnel. Every rung is a real count; higher rungs are earned, never assigned.
    funnel: [
      { key: 'endorsed', label: 'Endorsed', count: endorsedCount, note: 'Vouched for by this partner' },
      { key: 'applied', label: 'Applied through Covenda', count: appliedCount, note: 'Came in via this referral and applied to real work' },
      { key: 'verified', label: 'Employer-Verified', count: verifiedCount, note: 'Completed a reviewed project' },
    ],
    isEmpty: endorsedCount === 0 && appliedCount === 0 && referredFirms === 0,
  };
}

async function loadCohort(supabase, code) {
  // Endorsement submissions are low-volume in the pilot; fetch the type and filter by the nested
  // attributionCode in JS (robust against jsonb-filter syntax quirks across client versions).
  const { data: subs } = await supabase
    .from('submissions')
    .select('details')
    .eq('submission_type', 'referrer_endorsement')
    .limit(500);
  const endorsementSubs = (subs || []).filter(s => String(s?.details?.attributionCode || '').toUpperCase() === code);

  // Employer intakes that arrived via this partner's referral link (GTM Move 3).
  const { data: empSubs } = await supabase
    .from('submissions')
    .select('details, submitter_email')
    .eq('submission_type', 'employer_intake')
    .limit(1000);
  const employerSubs = (empSubs || []).filter(s => String(s?.details?.referral?.code || '').toUpperCase() === code);

  // Applications that cited this referral code.
  const { data: apps } = await supabase
    .from('project_applications')
    .select('student_user_id, project_id, referral')
    .limit(2000);
  const codedApplications = (apps || []).filter(a => String(a?.referral?.code || '').toUpperCase() === code);

  // Which of those students have a completed (reviewed) project.
  const studentIds = [...new Set(codedApplications.map(a => a.student_user_id).filter(Boolean))];
  let completedStudentIds = new Set();
  if (studentIds.length) {
    const { data: projects } = await supabase
      .from('member_projects')
      .select('assigned_student_user_id, status')
      .in('assigned_student_user_id', studentIds)
      .eq('status', 'complete');
    completedStudentIds = new Set((projects || []).map(p => p.assigned_student_user_id).filter(Boolean));
  }
  return summarizeCohort({ code, endorsementSubs, codedApplications, completedStudentIds, employerSubs });
}

export default async function handler(req, res, dependencies = {}) {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'Method not allowed.' }); }
  if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: 'Origin not allowed.' });

  const env = dependencies.env || process.env;
  let code = '';
  try { code = cleanCode(new URL(req.url, 'http://localhost').searchParams.get('ref')); } catch { code = ''; }
  if (!CODE_PATTERN.test(code)) {
    // Not a valid code shape — return an empty cohort rather than an error so the page renders cleanly.
    return res.status(200).json({ ok: true, cohort: summarizeCohort({ code: code || '' }) });
  }

  const config = supabaseConfiguration(env);
  if (!config) return res.status(503).json({ ok: false, error: 'Cohort data is not available yet.' });
  const createSupabaseClient = dependencies.createSupabaseClient || createClient;
  const supabase = createSupabaseClient(config.url, config.secret, { auth: { persistSession: false } });

  try {
    const cohort = await loadCohort(supabase, code);
    return res.status(200).json({ ok: true, cohort });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'Cohort API failed', route: '/api/cohort', error: String(error?.message || error).slice(0, 500) }));
    return res.status(200).json({ ok: true, cohort: summarizeCohort({ code }) });
  }
}
