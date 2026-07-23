// §A transactional member email. Discrete lifecycle moments only (no message-thread spam —
// that needs debounce, a later slice): a company gets "new applicant", a student gets
// "accepted"/"not selected", the operator gets "payout requested".
//
// Mirrors the digest/operator-notification pattern: pure *Email() builders (testable) + a
// sender that NO-OPS unless Resend is configured, honors the member's opt-out, and is
// idempotent per event. Every call site treats this as best-effort — a failed/*unconfigured*
// email must never break the underlying action.
import { Resend } from 'resend';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function shell(bodyHtml) {
  return `<div style="font-family:Manrope,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.55">${bodyHtml}<p style="color:#999;font-size:11px;border-top:1px solid #eee;padding-top:12px;margin-top:20px">You're receiving this because you have a Covenda account. Manage email preferences in your portal profile.</p></div>`;
}
function button(url, label) {
  return url ? `<p style="margin:18px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#b47b20;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:600">${escapeHtml(label)}</a></p>` : '';
}
const TAGS = [{ name: 'source', value: 'covenda' }, { name: 'kind', value: 'transactional' }];

// ---- Pure email builders ({from,to,subject,text,html}) ----
export function applicationReceivedEmail({ to, from, projectTitle, studentName, portalUrl = '' }) {
  const title = projectTitle || 'your project';
  const who = studentName ? `${studentName} ` : 'A student ';
  return {
    from, to: [to],
    subject: `New applicant for “${title}”`,
    text: `${who}applied to “${title}” on Covenda.\n\nReview them in your portal${portalUrl ? `: ${portalUrl}` : '.'}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">New applicant</h1><p>${escapeHtml(who)}applied to <strong>${escapeHtml(title)}</strong>. Their fit score, skills, and any referral are on the application.</p>${button(portalUrl, 'Review the applicant')}`),
    tags: TAGS,
  };
}
export function applicationDecisionEmail({ to, from, projectTitle, accepted, portalUrl = '' }) {
  const title = projectTitle || 'the project';
  if (accepted) {
    return {
      from, to: [to],
      subject: `You're in — “${title}”`,
      text: `Good news — you were selected for “${title}” on Covenda. Open your portal to see the project and start the thread${portalUrl ? `: ${portalUrl}` : '.'}\n`,
      html: shell(`<h1 style="font-size:20px;margin:0 0 10px">You were selected 🎉</h1><p>You've been accepted for <strong>${escapeHtml(title)}</strong>. The project is now in your workspace — open the thread to align on scope.</p>${button(portalUrl, 'Open the project')}`),
      tags: TAGS,
    };
  }
  return {
    from, to: [to],
    subject: `Update on your application — “${title}”`,
    text: `Thanks for applying to “${title}”. The company went with another student this time. Your profile and proof stay with you — keep applying${portalUrl ? `: ${portalUrl}` : '.'}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Not this one — keep going</h1><p>The company chose another student for <strong>${escapeHtml(title)}</strong>. It's not a mark against you; fit is project-specific. New opportunities open regularly.</p>${button(portalUrl, 'Find your next project')}`),
    tags: TAGS,
  };
}
export function batchDecisionEmail({ to, from, batchName, decision, portalUrl = '' }) {
  const name = batchName || 'the cohort';
  if (decision === 'accepted') {
    return {
      from, to: [to],
      subject: `You're in — ${name}`,
      text: `Congratulations — you've been admitted to ${name} on Covenda. Open your portal to see next steps${portalUrl ? `: ${portalUrl}` : '.'}\n`,
      html: shell(`<h1 style="font-size:20px;margin:0 0 10px">You're in 🎉</h1><p>You've been admitted to <strong>${escapeHtml(name)}</strong>. Admitted students are surfaced to partner companies — keep your profile sharp.</p>${button(portalUrl, 'Open your batches')}`),
      tags: TAGS,
    };
  }
  if (decision === 'waitlisted') {
    return {
      from, to: [to],
      subject: `Waitlisted — ${name}`,
      text: `You've been waitlisted for ${name} on Covenda. If a spot opens, you'll be the first to know. Your profile and proof stay with you${portalUrl ? `: ${portalUrl}` : '.'}\n`,
      html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Waitlisted for ${escapeHtml(name)}</h1><p>You made a strong case — you're on the waitlist. If a seat opens, we'll reach out. In the meantime, keep building proof through real projects.</p>${button(portalUrl, 'Find a project')}`),
      tags: TAGS,
    };
  }
  return {
    from, to: [to],
    subject: `Update on your ${name} application`,
    text: `Thanks for applying to ${name}. It wasn't a match this round — cohorts are small and fit is specific. Your profile and proof stay with you, and new cohorts open regularly${portalUrl ? `: ${portalUrl}` : '.'}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Not this cohort — keep going</h1><p>You weren't selected for <strong>${escapeHtml(name)}</strong> this round. Cohorts are small and fit is project-specific; it's not a mark against you. New cohorts open regularly.</p>${button(portalUrl, 'Explore Covenda')}`),
    tags: TAGS,
  };
}
export function payoutRequestedEmail({ to, from, memberName, credits, method, adminUrl = '' }) {
  const who = memberName || 'A member';
  return {
    from, to: [to],
    subject: `Payout requested · ${credits} credits`,
    text: `${who} requested a payout of ${credits} credits via ${method}.\n\nReview it in the operator console${adminUrl ? `: ${adminUrl}` : '.'}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Payout requested</h1><p><strong>${escapeHtml(who)}</strong> requested a payout of <strong>${escapeHtml(String(credits))} credits</strong> via ${escapeHtml(method)}.</p>${button(adminUrl, 'Review in the console')}`),
    tags: [{ name: 'source', value: 'covenda' }, { name: 'kind', value: 'operator' }],
  };
}

// ---- Recipient resolution + gating ----
export async function resolveUserEmail(supabase, userId) {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email || '';
  } catch { return ''; }
}
export async function memberOptedOut(supabase, userId) {
  try {
    const { data } = await supabase.from('member_profiles').select('email_opt_out').eq('user_id', userId).maybeSingle();
    return data?.email_opt_out === true;
  } catch { return false; }
}

function portalUrlFor(env) {
  const base = (env.COVENDA_SITE_URL || 'https://covenda.app').replace(/\/+$/, '');
  return `${base}/portal.html`;
}

// Send a transactional email to a member (best-effort). Returns {sent, reason}; never throws.
export async function notifyMember(supabase, {
  toUserId, build, idempotencyKey,
  env = process.env, createResendClient = apiKey => new Resend(apiKey),
} = {}) {
  try {
    const apiKey = env.RESEND_API_KEY;
    const from = env.COVENDA_NOTIFICATION_FROM;
    if (!apiKey || !from) return { sent: false, reason: 'not-configured' };
    if (await memberOptedOut(supabase, toUserId)) return { sent: false, reason: 'opted-out' };
    const to = await resolveUserEmail(supabase, toUserId);
    if (!isEmail(to)) return { sent: false, reason: 'no-email' };
    const resend = createResendClient(apiKey);
    const { error } = await resend.emails.send(build({ to, from, portalUrl: portalUrlFor(env) }), idempotencyKey ? { idempotencyKey } : undefined);
    if (error) return { sent: false, reason: String(error.message || error).slice(0, 200) };
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: String(error?.message || error).slice(0, 200) };
  }
}

// Send a transactional email to the operator inbox (best-effort). No opt-out; fixed recipient.
export async function notifyOperatorEvent({
  build, idempotencyKey,
  env = process.env, createResendClient = apiKey => new Resend(apiKey),
} = {}) {
  try {
    const apiKey = env.RESEND_API_KEY;
    const from = env.COVENDA_NOTIFICATION_FROM;
    const to = env.COVENDA_NOTIFICATION_EMAIL;
    if (!apiKey || !from || !to) return { sent: false, reason: 'not-configured' };
    const resend = createResendClient(apiKey);
    const { error } = await resend.emails.send(build({ to, from, adminUrl: env.COVENDA_ADMIN_URL || '' }), idempotencyKey ? { idempotencyKey } : undefined);
    if (error) return { sent: false, reason: String(error.message || error).slice(0, 200) };
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: String(error?.message || error).slice(0, 200) };
  }
}
