// Pushing a candidate into the company's own ATS.
//
// The positioning this encodes: we do not ask a company to stop using Greenhouse. We tell
// them to keep it, and that Covenda makes what enters it better. That is a near-zero
// adoption ask, and it is the difference between "replace your hiring stack" and "we handle
// the part you are bad at".
//
// ── CONSENT IS THE WHOLE PROBLEM ──────────────────────────────────────────────────────
// Pushing a profile into an external ATS moves a student's data somewhere Covenda cannot
// reach, cannot update, and cannot delete. Every other consent decision in this codebase is
// per-application on purpose; this one has to be at least as strict, because it is the only
// one that is irreversible.
//
// So: nothing is exported without an explicit, recorded, per-destination consent. Not
// "they opted into discovery". Not "they applied". A specific yes to this company.
//
// Pure module — payload shape, redaction and the consent rule. The HTTP calls live in the
// route, so all of this is testable without an ATS account.

export const ATS_VERSION = 'ats-1.0.0';

export const PROVIDERS = {
  greenhouse: {
    id: 'greenhouse', label: 'Greenhouse',
    endpoint: 'https://harvest.greenhouse.io/v1/candidates',
    auth: 'basic',   // API key as the basic-auth username
  },
  ashby: {
    id: 'ashby', label: 'Ashby',
    endpoint: 'https://api.ashbyhq.com/candidate.create',
    auth: 'basic',
  },
  lever: {
    id: 'lever', label: 'Lever',
    endpoint: 'https://api.lever.co/v1/candidates',
    auth: 'basic',
  },
};

// Fields that never leave Covenda, whatever the caller passes. The scorer refuses to train
// on these; exporting them would put them in a system that has no such rule, which would
// make the guarantee true only inside our own walls.
const NEVER_EXPORT = [
  'school_name', 'graduation_year', 'gpa', 'age', 'date_of_birth',
  'gender', 'race', 'ethnicity', 'nationality', 'citizenship', 'visa_status',
  'photo_url', 'avatar_url', 'address', 'postcode', 'zip', 'pronouns',
];

export function redact(profile = {}) {
  const out = {};
  const dropped = [];
  for (const [key, value] of Object.entries(profile)) {
    if (NEVER_EXPORT.includes(key)) { dropped.push(key); continue; }
    out[key] = value;
  }
  return { profile: out, dropped };
}

// The consent rule. Deliberately unforgiving: an absent record is a no, an expired one is a
// no, and consent for one company is not consent for another.
export function checkConsent(consent = null, { companyUserId, now = null } = {}) {
  if (!consent) {
    return { ok: false, reason: 'This student has not agreed to be sent to an external system. Ask them first.' };
  }
  if (consent.student_user_id && consent.company_user_id && consent.company_user_id !== companyUserId) {
    return { ok: false, reason: 'They agreed to a different company. Consent does not carry across.' };
  }
  if (consent.revoked_at) {
    return { ok: false, reason: 'They withdrew consent for this.' };
  }
  if (consent.expires_at && now && Date.parse(consent.expires_at) < Date.parse(now)) {
    return { ok: false, reason: 'That consent has expired. Ask again.' };
  }
  return { ok: true };
}

// What we send. Deliberately the things an ATS cannot work out for itself — the evidence and
// the reasoning — rather than a résumé it already knows how to parse.
export function buildPayload({ student = {}, fit = null, project = null, notes = '', provider = 'greenhouse' } = {}) {
  const { profile, dropped } = redact(student);
  const reasons = (fit?.reasons || []).slice(0, 5);

  const summaryLines = [
    'Sourced through Covenda.',
    fit?.score != null ? `Compatibility ${Math.round(fit.score)}%${fit.band ? ` (likely ${fit.band.low}–${fit.band.high})` : ''}.` : null,
    reasons.length ? `Why: ${reasons.join('; ')}.` : null,
    (fit?.concerns || []).length ? `Watch: ${fit.concerns.slice(0, 3).join('; ')}.` : null,
    project?.title ? `Completed trial: ${project.title}.` : null,
    // The honesty carries across the boundary. A recruiter reading this in Greenhouse should
    // know what the number is and is not.
    fit?.score != null ? 'Covenda scores per opportunity, never as a global candidate rating.' : null,
    notes ? `Recruiter notes: ${notes}` : null,
  ].filter(Boolean);

  const base = {
    firstName: firstOf(profile.display_name),
    lastName: restOf(profile.display_name),
    emailAddresses: profile.email ? [{ value: profile.email, type: 'personal' }] : [],
    websiteAddresses: (profile.links || []).slice(0, 5).map(url => ({ value: url })),
    tags: ['Covenda'],
    summary: summaryLines.join(' '),
  };

  // Providers disagree on shape; the content does not change.
  const shaped = provider === 'ashby'
    ? { name: profile.display_name || 'Candidate', email: profile.email || undefined, sourceTitle: 'Covenda', notes: base.summary }
    : provider === 'lever'
      ? { name: profile.display_name || 'Candidate', emails: profile.email ? [profile.email] : [], tags: ['Covenda'], comments: base.summary }
      : base;

  return { provider, payload: shaped, dropped, summary: base.summary };
}

function firstOf(name) { return String(name || '').trim().split(/\s+/)[0] || 'Candidate'; }
function restOf(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

// One call the route can trust: is this export allowed, and what exactly goes.
export function prepareExport({ provider, student, consent, companyUserId, fit, project, notes, now } = {}) {
  const spec = PROVIDERS[provider];
  if (!spec) return { ok: false, reason: `Covenda does not push to ${provider} yet.` };

  const allowed = checkConsent(consent, { companyUserId, now });
  if (!allowed.ok) return { ok: false, reason: allowed.reason };

  if (!student?.email) {
    return { ok: false, reason: 'That student has no email on file, and an ATS record without one cannot be matched to an application.' };
  }
  const built = buildPayload({ student, fit, project, notes, provider });
  return { ok: true, version: ATS_VERSION, endpoint: spec.endpoint, auth: spec.auth, ...built };
}

// Whether a push is even possible on this deployment. Same posture as payouts: say which
// path is live rather than offering a button that cannot work.
export function atsMode(connection = null) {
  if (!connection || !connection.api_key_set) {
    return { connected: false, note: 'Connect your ATS to push candidates into it. Until then, Covenda keeps them here.' };
  }
  return {
    connected: true,
    provider: connection.provider,
    note: `Candidates you push land in ${PROVIDERS[connection.provider]?.label || connection.provider}. Covenda keeps its own copy.`,
  };
}
