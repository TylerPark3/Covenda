// Proving someone works where they say they work.
//
// The student side already treats a school email as the FLOOR, not the proof. The company
// side is the mirror of that and needs stating just as plainly: controlling an address at a
// corporate domain proves you can read mail there. It does not prove you are authorised to
// hire, to sign, or to speak for the company. Those are separate claims, and nothing here
// establishes them.
//
// What this module is actually for: keeping consumer mailboxes and throwaway domains out of
// the company signup, and tying an account to a domain so a second person from the same
// company can be recognised later.
//
// ── ON CATCH-ALL SERVERS ──────────────────────────────────────────────────────────────
// Many corporate mail servers accept every address at SMTP time and drop invalid ones
// internally. That makes address-level probing worthless: a probe says "deliverable" for
// addresses that will never reach a human. The only reliable signal is a code that comes
// back, so this module does not probe. It classifies the domain, and delivery is the test.

export const COMPANY_VERIFICATION_VERSION = 'company-verify-1.0.0';

// Consumer mailboxes. A founder may well use one day to day, but a company account tied to
// gmail.com cannot be distinguished from anybody else's gmail.com.
const CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com', 'passport.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru', 'mail.ru',
  'qq.com', '163.com', '126.com', 'naver.com', 'daum.net', 'hanmail.net',
  'fastmail.com', 'hushmail.com', 'tutanota.com', 'tuta.io', 'zohomail.com', 'inbox.com',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net',
  'btinternet.com', 'orange.fr', 'free.fr', 'web.de', 't-online.de', 'libero.it',
]);

// Disposable / throwaway providers. Not exhaustive by nature — new ones appear constantly —
// so the pattern check below catches the shape as well as the name.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'throwaway.email',
  'yopmail.com', 'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'mailnesia.com', 'mintemail.com', 'spamgourmet.com', 'mytemp.email',
  'moakt.com', 'emailondeck.com', 'burnermail.io', 'tempr.email', 'discard.email',
  'mailsac.com', 'inboxkitten.com', 'harakirimail.com', 'spam4.me', 'grr.la',
]);

const DISPOSABLE_PATTERN = /(^|\.)(temp|tmp|trash|fake|throwaway|burner|disposable|10minute|guerrilla|spam)[a-z0-9-]*\./i;

// Academic domains belong to the student side. A company account on one is almost always a
// student signing up on the wrong tab, and saying so beats a generic rejection.
const ACADEMIC_PATTERN = /(^|\.)(edu|ac\.[a-z]{2}|edu\.[a-z]{2}|sch\.[a-z]{2}|uni-[a-z]+\.[a-z]{2,})$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normaliseCompanyEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function domainOf(email) {
  const at = normaliseCompanyEmail(email).lastIndexOf('@');
  return at === -1 ? '' : normaliseCompanyEmail(email).slice(at + 1);
}

// The registrable part, so mail.acme.co.uk and acme.co.uk are recognised as one company.
export function registrableDomain(domain) {
  const parts = String(domain || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const twoLevelTld = /^(co|com|org|net|ac|gov|edu|ne|or)\.[a-z]{2}$/.test(parts.slice(-2).join('.'));
  return parts.slice(twoLevelTld ? -3 : -2).join('.');
}

// One verdict, with a reason a person can act on rather than a boolean.
export function classifyCompanyEmail(value) {
  const email = normaliseCompanyEmail(value);
  if (!email) return { ok: false, code: 'empty', reason: 'Enter your work email.' };
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, code: 'malformed', reason: 'That does not look like an email address.' };
  }
  const domain = domainOf(email);
  const registrable = registrableDomain(domain);

  if (CONSUMER_DOMAINS.has(domain) || CONSUMER_DOMAINS.has(registrable)) {
    return {
      ok: false, code: 'consumer', domain, registrable,
      reason: 'Use your work email. A personal address cannot be tied to a company.',
    };
  }
  if (DISPOSABLE_DOMAINS.has(domain) || DISPOSABLE_DOMAINS.has(registrable) || DISPOSABLE_PATTERN.test(domain + '.')) {
    return {
      ok: false, code: 'disposable', domain, registrable,
      reason: 'That is a temporary email provider. Use your work email.',
    };
  }
  if (ACADEMIC_PATTERN.test(domain)) {
    return {
      ok: false, code: 'academic', domain, registrable,
      reason: 'That is a school address — students sign up on the student tab. Use a company address here.',
    };
  }
  return { ok: true, code: 'corporate', domain, registrable };
}

// Does the address plausibly belong to the company the user typed? Advisory only: plenty of
// real companies mail from a domain that shares no words with their trading name, so a
// mismatch is a prompt to confirm, never a rejection.
export function domainMatchesCompany(email, companyName) {
  const registrable = registrableDomain(domainOf(email));
  const host = registrable.split('.')[0] || '';
  const name = String(companyName || '').toLowerCase();
  if (!host || !name) return { match: false, confidence: 'unknown' };

  const squashed = name.replace(/[^a-z0-9]/g, '');
  const words = name.split(/[^a-z0-9]+/).filter(Boolean);

  // Strong means the domain IS the name, or is one of its words outright. A plain
  // `squashed.includes(host)` was too loose — a three-letter host matched almost anything.
  if (squashed && (squashed === host || host === squashed || words.includes(host))) {
    return { match: true, confidence: 'strong', host };
  }
  // Partial means the domain shares a stem with some word of the name.
  if (host.length >= 3 && words.some(w => w.includes(host) || host.includes(w))) {
    return { match: true, confidence: 'partial', host };
  }
  return {
    match: false, confidence: 'none', host,
    note: `The address is at ${registrable}, which does not obviously belong to "${companyName}". That is common and not a problem — it is worth confirming, not blocking.`,
  };
}

// What a company email does and does not establish. Kept next to the check itself so the
// claim and the caveat cannot drift apart.
export function companyVerificationStanding({ emailVerifiedAt = null, domain = null, teamVerifiedCount = 0 } = {}) {
  const emailHeld = Boolean(emailVerifiedAt);
  return {
    version: COMPANY_VERIFICATION_VERSION,
    domain,
    signals: [
      {
        key: 'work_email', label: 'Work email confirmed', held: emailHeld,
        proves: 'Someone controls an address at this domain.',
        doesNotProve: 'That they are authorised to hire, sign, or speak for the company.',
        strength: 'floor',
      },
      {
        key: 'colleagues', label: 'Colleagues on the same domain', held: teamVerifiedCount > 1,
        proves: `${teamVerifiedCount} confirmed ${teamVerifiedCount === 1 ? 'address' : 'addresses'} at this domain.`,
        doesNotProve: 'Anything about the company itself — only that more than one person reads mail there.',
        strength: 'weak',
      },
    ],
    // Deliberately not called "verified company". Nothing here verifies a company.
    canPostWork: emailHeld,
    summary: emailHeld
      ? 'Work email confirmed. This lets you post work — it is not a Covenda endorsement of the company.'
      : 'Confirm your work email to post work.',
  };
}
