// §9 monthly partner digest. Each referral partner (professor / club / career center) gets a
// once-a-month email summarizing THEIR cohort — the same aggregate, PII-free funnel as the
// public cohort page, plus "what changed this period". Reuses summarizeCohort so the numbers
// match the cohort page exactly.
//
// Safety: this NEVER sends on its own. It is operator-triggered (admin API), gated on Resend +
// COVENDA_DIGEST_ENABLED, and idempotent per (partner code, year-month) so a re-run can't double
// send. `dryRun` builds every email without sending, so the founder can preview what would go out.
import { Resend } from 'resend';
import { summarizeCohort } from './cohort.js';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function periodKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(now = new Date()) {
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Pure: turn the cohort summary + "new this period" counts into a partner-facing digest object.
export function buildDigest({ code, cohort, newThisPeriod = {}, contactEmail, now = new Date() }) {
  const org = cohort.orgName || 'your cohort';
  return {
    code,
    contactEmail,
    orgName: cohort.orgName || '',
    period: periodKey(now),
    periodLabel: periodLabel(now),
    cohort,
    newThisPeriod: {
      endorsed: Number(newThisPeriod.endorsed) || 0,
      applied: Number(newThisPeriod.applied) || 0,
      verified: Number(newThisPeriod.verified) || 0,
    },
    org,
  };
}

// Pure: the email payload {from,to,subject,text,html}. Kept side-effect-free for testing.
export function partnerDigestEmail(digest, { to, from, cohortUrl = '' } = {}) {
  const org = digest.orgName || 'your Covenda cohort';
  const c = digest.cohort;
  const n = digest.newThisPeriod;
  const movedText = [
    n.endorsed ? `${n.endorsed} newly endorsed` : '',
    n.applied ? `${n.applied} started real work` : '',
    n.verified ? `${n.verified} reached Employer-Verified` : '',
  ].filter(Boolean).join(' · ') || 'No new movement this month — a good time to endorse a few more students.';

  const subject = `${org}: your Covenda cohort in ${digest.periodLabel}`;
  const text = [
    `${org} — Covenda cohort update for ${digest.periodLabel}`,
    '',
    `This month: ${movedText}`,
    '',
    'Cohort to date:',
    `  Endorsed: ${c.endorsedCount}`,
    `  Applied through Covenda: ${c.appliedCount}`,
    `  Employer-Verified: ${c.verifiedCount}`,
    cohortUrl ? `\nYour live cohort page: ${cohortUrl}` : '',
    '',
    'Every number is earned — students move up only by completing real, reviewed work.',
    'Reply to this email to update your roster or step back from these summaries.',
  ].filter(line => line !== undefined).join('\n');

  const stat = (label, value) =>
    `<td style="padding:12px 16px;border:1px solid #eee;border-radius:10px;text-align:center"><div style="font-size:26px;font-weight:700;color:#b47b20">${value}</div><div style="font-size:12px;color:#555">${escapeHtml(label)}</div></td>`;
  const cohortLink = cohortUrl
    ? `<p><a href="${escapeHtml(cohortUrl)}" style="color:#b47b20;font-weight:600">View your live cohort page →</a></p>`
    : '';
  const html = [
    `<div style="font-family:Manrope,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">`,
    `<p style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#b47b20;margin:0 0 4px">Covenda cohort · ${escapeHtml(digest.periodLabel)}</p>`,
    `<h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(org)}</h1>`,
    `<p style="color:#444;font-size:14px;line-height:1.5">This month: <strong>${escapeHtml(movedText)}</strong></p>`,
    `<table role="presentation" cellspacing="8" style="margin:16px 0"><tr>${stat('Endorsed', c.endorsedCount)}${stat('Applied', c.appliedCount)}${stat('Verified', c.verifiedCount)}</tr></table>`,
    cohortLink,
    `<p style="color:#777;font-size:12px;line-height:1.5;border-top:1px solid #eee;padding-top:14px;margin-top:18px">Every number is earned — students move up only by completing real, reviewed work. Reply to update your roster or to stop receiving these.</p>`,
    `</div>`,
  ].join('');

  return { from, to: [to], subject, text, html, tags: [{ name: 'kind', value: 'partner_digest' }, { name: 'source', value: 'covenda' }] };
}

// Assemble digests for every partner code from the DB. One pass over the three tables, grouped
// by referral code, then summarizeCohort per code (matching the cohort page).
export async function buildPartnerDigests(supabase, { sinceDays = 30, now = new Date() } = {}) {
  const sinceIso = new Date(now.getTime() - sinceDays * 86_400_000).toISOString();

  const { data: subs } = await supabase
    .from('submissions')
    .select('details, created_at')
    .eq('submission_type', 'referrer_endorsement')
    .limit(1000);
  const byCode = new Map();
  for (const sub of subs || []) {
    const details = sub?.details || {};
    const code = String(details.attributionCode || '').toUpperCase();
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, { endorsementSubs: [], contactEmail: '', newEndorsed: 0 });
    const entry = byCode.get(code);
    entry.endorsementSubs.push(sub);
    if (!entry.contactEmail && isEmail(details.contact?.email)) entry.contactEmail = String(details.contact.email).trim().toLowerCase();
    if (sub.created_at && sub.created_at >= sinceIso) entry.newEndorsed += (Array.isArray(details.endorsements) ? details.endorsements.length : 0);
  }
  if (!byCode.size) return [];

  const { data: apps } = await supabase
    .from('project_applications')
    .select('student_user_id, project_id, referral, created_at')
    .limit(5000);
  const appsByCode = new Map();
  for (const app of apps || []) {
    const code = String(app?.referral?.code || '').toUpperCase();
    if (!byCode.has(code)) continue;
    if (!appsByCode.has(code)) appsByCode.set(code, []);
    appsByCode.get(code).push(app);
  }

  // Completed projects (with completion time) for any student who cited a tracked code.
  const trackedStudentIds = [...new Set([...appsByCode.values()].flat().map(a => a.student_user_id).filter(Boolean))];
  let completedById = new Map();
  if (trackedStudentIds.length) {
    const { data: projects } = await supabase
      .from('member_projects')
      .select('assigned_student_user_id, status, completed_at')
      .in('assigned_student_user_id', trackedStudentIds)
      .eq('status', 'complete');
    for (const p of projects || []) {
      if (!p.assigned_student_user_id) continue;
      const prev = completedById.get(p.assigned_student_user_id);
      // keep the most recent completion for the "new this period" check
      if (!prev || (p.completed_at && p.completed_at > prev)) completedById.set(p.assigned_student_user_id, p.completed_at || prev || '');
    }
  }
  const completedStudentIds = new Set(completedById.keys());

  const digests = [];
  for (const [code, entry] of byCode) {
    const codedApplications = appsByCode.get(code) || [];
    const cohort = summarizeCohort({ code, endorsementSubs: entry.endorsementSubs, codedApplications, completedStudentIds });
    const newApplied = codedApplications.filter(a => a.created_at && a.created_at >= sinceIso).length;
    // Distinct students in this cohort whose completion landed in the period.
    const newVerified = new Set(
      codedApplications
        .map(a => a.student_user_id)
        .filter(id => id && completedById.get(id) && completedById.get(id) >= sinceIso),
    ).size;
    digests.push(buildDigest({
      code,
      cohort,
      contactEmail: entry.contactEmail,
      newThisPeriod: { endorsed: entry.newEndorsed, applied: newApplied, verified: newVerified },
      now,
    }));
  }
  return digests;
}

// Send (or dry-run) the partner digests. Never sends unless send + configured + enabled.
export async function sendPartnerDigests(supabase, {
  env = process.env,
  createResendClient = apiKey => new Resend(apiKey),
  send = false,
  now = new Date(),
} = {}) {
  const digests = await buildPartnerDigests(supabase, { now });
  const from = env.COVENDA_NOTIFICATION_FROM;
  const enabled = env.COVENDA_DIGEST_ENABLED === 'true';
  const apiKey = env.RESEND_API_KEY;
  const cohortBase = (env.COVENDA_SITE_URL || 'https://covenda.app').replace(/\/+$/, '');

  const results = digests.map(d => ({
    code: d.code,
    orgName: d.orgName,
    to: d.contactEmail || null,
    subject: partnerDigestEmail(d, { to: d.contactEmail || 'x@x', from: from || 'x@x' }).subject,
    newThisPeriod: d.newThisPeriod,
    cohort: { endorsedCount: d.cohort.endorsedCount, appliedCount: d.cohort.appliedCount, verifiedCount: d.cohort.verifiedCount },
    sent: false,
    reason: '',
  }));

  if (!send) { results.forEach(r => { r.reason = 'dry-run'; }); return { sent: 0, total: results.length, configured: Boolean(apiKey && from && enabled), results }; }
  if (!apiKey || !from || !enabled) {
    results.forEach(r => { r.reason = 'not-configured'; });
    return { sent: 0, total: results.length, configured: false, results };
  }

  const resend = createResendClient(apiKey);
  let sent = 0;
  for (let i = 0; i < digests.length; i += 1) {
    const d = digests[i];
    if (!isEmail(d.contactEmail)) { results[i].reason = 'no-email'; continue; }
    const cohortUrl = `${cohortBase}/cohort.html?ref=${encodeURIComponent(d.code)}${d.orgName ? `&via=${encodeURIComponent(d.orgName)}` : ''}`;
    try {
      const { error } = await resend.emails.send(
        partnerDigestEmail(d, { to: d.contactEmail, from, cohortUrl }),
        { idempotencyKey: `covenda-digest-${d.code.toLowerCase()}-${d.period}` },
      );
      if (error) throw new Error(error.message || 'unknown email error');
      results[i].sent = true; results[i].reason = 'sent'; sent += 1;
    } catch (error) {
      results[i].reason = String(error.message || error).slice(0, 200);
    }
  }
  return { sent, total: results.length, configured: true, results };
}
