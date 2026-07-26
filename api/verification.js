// Student verification — proving a signup is actually a student.
//
// Nothing checked this before: anyone could create a student account and appear in a batch
// application queue. That is survivable at zero users and corrosive at a hundred, because the
// one thing a company is buying is that the pool was screened.
//
// ── WHAT EACH SIGNAL ACTUALLY PROVES ──────────────────────────────────────────────────
// Being precise here matters more than the mechanism, because it is easy to imply more than
// you have checked:
//
//   School email   → someone controls an address at an academic domain. NOT identity, NOT
//                    current enrolment (alumni keep addresses for years, and some schools
//                    issue them before term starts). It is cheap, instant and free.
//   Club confirmed → an officer of a real organisation says this person is a current member.
//                    Stronger than the email on enrolment, because a club has no reason to
//                    confirm someone who is not there.
//   PI referral    → a named supervisor answers for the person under their own identity.
//                    Strongest, and the least scalable.
//
// So school email is the FLOOR, not the proof. It is stated that way everywhere it appears,
// and it never satisfies a batch requirement on its own.

export const VERIFICATION_VERSION = 'student-verification-1.0.0';

// Academic suffixes. Deliberately a list of SUFFIXES rather than a registry of institutions:
// a registry goes stale, excludes newer or non-Western institutions, and quietly turns a
// verification step into a gate on where someone studies.
const ACADEMIC_SUFFIXES = [
  '.edu', '.ac.uk', '.edu.au', '.ac.nz', '.edu.sg', '.edu.in', '.ac.in', '.edu.cn', '.ac.jp',
  '.ac.kr', '.edu.hk', '.ac.za', '.edu.br', '.edu.mx', '.ac.il', '.edu.tr', '.ac.th', '.edu.my',
  '.edu.ph', '.edu.pk', '.ac.id', '.edu.co', '.edu.ar', '.ac.at', '.edu.pl', '.edu.gr',
];

// Domains that are academic-adjacent but do NOT indicate enrolment. Listed explicitly so the
// check cannot be quietly satisfied by a staff or alumni address.
const NON_STUDENT_PREFIXES = ['alumni.', 'alum.', 'staff.', 'faculty.', 'emeriti.'];

export function normaliseEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) ? email : '';
}

export function domainOf(email) {
  const normalised = normaliseEmail(email);
  return normalised ? normalised.split('@')[1] : '';
}

export function isAcademicDomain(email) {
  const domain = domainOf(email);
  if (!domain) return false;
  return ACADEMIC_SUFFIXES.some(suffix => domain === suffix.slice(1) || domain.endsWith(suffix));
}

export function looksLikeAlumniOrStaff(email) {
  const domain = domainOf(email);
  return NON_STUDENT_PREFIXES.some(prefix => domain.startsWith(prefix));
}

// The check, with its own limits attached. A caller cannot use the result without also
// carrying what it does not prove.
export function checkSchoolEmail(email) {
  const normalised = normaliseEmail(email);
  if (!normalised) {
    return { ok: false, reason: 'That does not look like an email address.', domain: '', version: VERIFICATION_VERSION };
  }
  if (!isAcademicDomain(normalised)) {
    return {
      ok: false,
      domain: domainOf(normalised),
      reason: 'Use your school address. A personal address cannot show you are enrolled anywhere.',
      version: VERIFICATION_VERSION,
    };
  }
  if (looksLikeAlumniOrStaff(normalised)) {
    return {
      ok: false,
      domain: domainOf(normalised),
      reason: 'That looks like an alumni or staff address rather than a current student one.',
      version: VERIFICATION_VERSION,
    };
  }
  return {
    ok: true,
    domain: domainOf(normalised),
    proves: 'You control an address at an academic domain.',
    // Load-bearing: shown wherever the badge is, so nobody reads it as more than it is.
    doesNotProve: 'It does not prove current enrolment or identity — alumni keep addresses, and some schools issue them before term.',
    strength: 'floor',
    version: VERIFICATION_VERSION,
  };
}

// A six-digit code. Deliberately not a magic link: sign-in already uses links, and a second
// kind of link in the inbox is how people click the wrong one.
export function generateCode(randomInt) {
  const n = typeof randomInt === 'function' ? randomInt() : Math.floor(Math.random() * 1_000_000);
  return String(Math.abs(Math.trunc(n)) % 1_000_000).padStart(6, '0');
}

export const CODE_TTL_MINUTES = 20;
export const MAX_ATTEMPTS = 5;

// Pure verdict for a submitted code, so expiry and lockout are testable without a database.
export function checkCode(record, submitted, now) {
  if (!record) return { ok: false, reason: 'Request a new code.' };
  if (Number(record.attempts) >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'Too many attempts. Request a new code.', locked: true };
  }
  const issued = Date.parse(record.created_at);
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (Number.isFinite(issued) && Number.isFinite(nowMs) && nowMs - issued > CODE_TTL_MINUTES * 60_000) {
    return { ok: false, reason: 'That code has expired. Request a new one.', expired: true };
  }
  const given = String(submitted || '').trim();
  if (!/^\d{6}$/.test(given)) return { ok: false, reason: 'Enter the six-digit code.' };
  if (given !== String(record.code)) return { ok: false, reason: 'That code is not right.' };
  return { ok: true };
}

// How verified a student is overall, and — the part that matters — what is still missing.
// Never a single score: the three signals prove different things and collapsing them would
// hide which one is absent.
export function verificationStanding({ schoolVerifiedAt = null, confirmedClubs = 0, referrals = 0 } = {}) {
  const signals = [
    { key: 'school_email', label: 'School email', held: Boolean(schoolVerifiedAt),
      proves: 'Controls an address at an academic domain.', strength: 'floor' },
    { key: 'club', label: 'Club confirmed', held: confirmedClubs > 0,
      proves: 'An officer of a real organisation says you are a current member.', strength: 'strong' },
    { key: 'referral', label: 'Named referral', held: referrals > 0,
      proves: 'A supervisor answers for your work under their own identity.', strength: 'strongest' },
  ];
  const held = signals.filter(s => s.held);
  return {
    signals,
    heldCount: held.length,
    // The floor alone is not "verified" and must not be presented as such.
    isStudentVerified: held.some(s => s.key !== 'school_email'),
    summary: held.length === 0
      ? 'Not yet verified.'
      : held.length === signals.length
        ? 'Verified on every signal.'
        : `Verified on ${held.map(s => s.label.toLowerCase()).join(' and ')}.`,
    version: VERIFICATION_VERSION,
  };
}
