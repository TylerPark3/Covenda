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
      subject: `You're in, “${title}”`,
      text: `Good news, you were selected for “${title}” on Covenda. Open your portal to see the project and start the thread${portalUrl ? `: ${portalUrl}` : '.'}\n`,
      html: shell(`<h1 style="font-size:20px;margin:0 0 10px">You were selected 🎉</h1><p>You've been accepted for <strong>${escapeHtml(title)}</strong>. The project is now in your workspace, open the thread to align on scope.</p>${button(portalUrl, 'Open the project')}`),
      tags: TAGS,
    };
  }
  return {
    from, to: [to],
    subject: `Update on your application, “${title}”`,
    text: `Thanks for applying to “${title}”. The company went with another student this time. Your profile and proof stay with you, keep applying${portalUrl ? `: ${portalUrl}` : '.'}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Not this one, keep going</h1><p>The company chose another student for <strong>${escapeHtml(title)}</strong>. It's not a mark against you; fit is project-specific. New opportunities open regularly.</p>${button(portalUrl, 'Find your next project')}`),
    tags: TAGS,
  };
}
export function batchDecisionEmail({ to, from, batchName, decision, portalUrl = '' }) {
  const name = batchName || 'the cohort';
  if (decision === 'accepted') {
    return {
      from, to: [to],
      subject: `You're in, ${name}`,
      text: `Congratulations, you've been admitted to ${name} on Covenda. Open your portal to see next steps${portalUrl ? `: ${portalUrl}` : '.'}\n`,
      html: shell(`<h1 style="font-size:20px;margin:0 0 10px">You're in 🎉</h1><p>You've been admitted to <strong>${escapeHtml(name)}</strong>. Admitted students are surfaced to partner companies, keep your profile sharp.</p>${button(portalUrl, 'Open your batches')}`),
      tags: TAGS,
    };
  }
  if (decision === 'waitlisted') {
    return {
      from, to: [to],
      subject: `Waitlisted, ${name}`,
      text: `You've been waitlisted for ${name} on Covenda. If a spot opens, you'll be the first to know. Your profile and proof stay with you${portalUrl ? `: ${portalUrl}` : '.'}\n`,
      html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Waitlisted for ${escapeHtml(name)}</h1><p>You made a strong case, you're on the waitlist. If a seat opens, we'll reach out. In the meantime, keep building proof through real projects.</p>${button(portalUrl, 'Find a project')}`),
      tags: TAGS,
    };
  }
  return {
    from, to: [to],
    subject: `Update on your ${name} application`,
    text: `Thanks for applying to ${name}. It wasn't a match this round, cohorts are small and fit is specific. Your profile and proof stay with you, and new cohorts open regularly${portalUrl ? `: ${portalUrl}` : '.'}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Not this cohort, keep going</h1><p>You weren't selected for <strong>${escapeHtml(name)}</strong> this round. Cohorts are small and fit is project-specific; it's not a mark against you. New cohorts open regularly.</p>${button(portalUrl, 'Explore Covenda')}`),
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

// ── The trial lifecycle ───────────────────────────────────────────────────────────────
// A trial has four moments where one side acts and the other has no way to know: the work is
// submitted, the work is reviewed, the trial starts, and an introduction is offered. Silence
// at any of them is how a first trial dies — not from a bug, but from somebody waiting on
// somebody who never found out it was their turn.
//
// Every subject line says WHO must act, because an email that only reports a state change
// leaves the reader to work out whether it concerns them.

export function deliverableSubmittedEmail({ to, from, projectTitle, studentName, portalUrl = '' }) {
  const title = projectTitle || 'your project';
  const who = studentName || 'The student';
  return {
    from, to: [to],
    subject: `${who} submitted work for “${title}”, your review`,
    text: `${who} submitted the deliverable for “${title}”.\n\nReviewing it is the last step: accepting issues their verified work record.\n\nOpen it${portalUrl ? `: ${portalUrl}` : '.'}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Work submitted</h1><p><strong>${escapeHtml(who)}</strong> submitted the deliverable for <strong>${escapeHtml(title)}</strong>.</p><p>Reviewing it is the last step. Accepting issues their verified work record.</p>${button(portalUrl, 'Review the work')}`),
    tags: TAGS,
  };
}

export function deliverableReviewedEmail({ to, from, projectTitle, accepted, note = '', portalUrl = '' }) {
  const title = projectTitle || 'your project';
  return {
    from, to: [to],
    subject: accepted ? `Your work on “${title}” was accepted` : `Changes requested on “${title}”`,
    text: accepted
      ? `Your deliverable for “${title}” was accepted. You now hold a verified work record for it.\n\n${portalUrl}\n`
      : `The reviewer asked for changes on “${title}”.\n\n${note ? `What they asked for: ${note}\n\n` : ''}${portalUrl}\n`,
    html: shell(accepted
      ? `<h1 style="font-size:20px;margin:0 0 10px">Accepted</h1><p>Your deliverable for <strong>${escapeHtml(title)}</strong> was accepted. You now hold a verified work record for it, and it is the strongest thing on your profile.</p>${button(portalUrl, 'See your record')}`
      : `<h1 style="font-size:20px;margin:0 0 10px">Changes requested</h1><p>The reviewer asked for changes on <strong>${escapeHtml(title)}</strong>.</p>${note ? `<p style="padding:12px 14px;background:#faf6ec;border-left:3px solid #a8761c">${escapeHtml(note)}</p>` : ''}${button(portalUrl, 'Open the project')}`),
    tags: TAGS,
  };
}

export function trialStartedEmail({ to, from, projectTitle, portalUrl = '' }) {
  const title = projectTitle || 'the project';
  return {
    from, to: [to],
    subject: `“${title}” has started`,
    text: `Work on “${title}” has started. Scope, deadline and payment are on the project page.\n\n${portalUrl}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">Trial started</h1><p>Work on <strong>${escapeHtml(title)}</strong> has started. Scope, deadline and payment are on the project page, and questions belong in the project thread so nothing gets lost.</p>${button(portalUrl, 'Open the project')}`),
    tags: TAGS,
  };
}

export function introductionEmail({ to, from, companyName, roleSummary, portalUrl = '' }) {
  const who = companyName || 'A company';
  return {
    from, to: [to],
    subject: `${who} would like an introduction`,
    text: `${who} asked to be introduced to you.\n\n${roleSummary || ''}\n\nYou decide whether to accept. Nothing is shared until you do.\n\n${portalUrl}\n`,
    html: shell(`<h1 style="font-size:20px;margin:0 0 10px">An introduction</h1><p><strong>${escapeHtml(who)}</strong> asked to be introduced to you.</p>${roleSummary ? `<p>${escapeHtml(roleSummary)}</p>` : ''}<p>You decide whether to accept. Nothing is shared until you do.</p>${button(portalUrl, 'See the request')}`),
    tags: TAGS,
  };
}

// ── Delivery health ───────────────────────────────────────────────────────────────────
// The failure mode this exists for is silence. If RESEND_API_KEY is missing, every send
// returns not-configured and the product behaves exactly as it does today: nothing breaks,
// nothing arrives, and the first anyone learns of it is a company saying they never heard
// back. Configuration state has to be visible before it matters, not after.

export function deliveryConfig(env = process.env) {
  const apiKey = Boolean(env.RESEND_API_KEY);
  const from = env.COVENDA_NOTIFICATION_FROM || null;
  const operator = env.COVENDA_NOTIFICATION_EMAIL || null;
  const missing = [
    !apiKey ? 'RESEND_API_KEY' : null,
    !from ? 'COVENDA_NOTIFICATION_FROM' : null,
  ].filter(Boolean);
  return {
    configured: missing.length === 0,
    missing,
    from,
    operatorInbox: operator,
    // Said plainly, because "not configured" reads as a minor warning and this is not one.
    consequence: missing.length
      ? 'Every notification silently does nothing. A student submits work and the company is never told.'
      : null,
  };
}

// Records a send that did not happen, so a run of failures is countable rather than folklore.
// Never records the message body or the recipient address.
export async function recordDelivery(supabase, { event, result, toUserId = null }) {
  if (!supabase || result?.sent || result?.reason === 'opted-out') return { logged: false };
  try {
    await supabase.from('error_events').insert({
      route: 'notify',
      kind: 'degraded',
      message: `${event} not delivered: ${result?.reason || 'unknown'}`,
      detail: { event, reason: String(result?.reason || 'unknown').slice(0, 120) },
      user_id: toUserId,
    });
    return { logged: true };
  } catch {
    return { logged: false };
  }
}
