// Who vouches for a vertical's bar.
//
// ── THE CLAIM THIS MAKES, AND THE ONE IT REFUSES ──────────────────────────────────────
// A published bar is only worth something if a company believes whoever set it knows the
// work. "Vetted against a published bar" is true today; "vetted by industry professionals"
// would not be, because no professional has agreed to anything yet.
//
// So this holds one entry per vertical, and every entry is explicit about its state. A
// vertical with nobody attached says so, in the student's view and the company's view. The
// alternative is a page that implies twenty-five practitioners are involved when the real
// number is zero, and that is the single fastest way to lose a company that checks.
//
// ── WHAT A REVIEWER ACTUALLY DOES ─────────────────────────────────────────────────────
// They set and sign the bar, once per vertical. They do not score individual applicants:
// that is Covenda's two raters, measured for agreement in api/hardening.js. One conversation
// per discipline scales; one conversation per applicant does not, and a practitioner who has
// to review submissions weekly stops answering by week three.

export const REVIEWERS_VERSION = 'reviewers-1.0.0';

// confirmed  a named person has agreed and the bar carries their name
// invited    asked, not yet agreed. Never shown as endorsement
// none       nobody approached yet, and the vertical says so
export const STATES = ['confirmed', 'invited', 'none'];

// One entry per vertical. Everything starts at `none` because that is the truth.
//
// To confirm someone: set state to 'confirmed', add their name, what they do, and the date
// they agreed. Do not add a name at 'invited' — a name on a page reads as endorsement to
// every visitor, whatever the adjacent label says.
export const REVIEWERS = {
  'Software & AI': { state: 'none', name: null, role: null, agreedAt: null },
  'Accounting & finance': { state: 'none', name: null, role: null, agreedAt: null },
  'Professional services': { state: 'none', name: null, role: null, agreedAt: null },
  'Consumer & retail': { state: 'none', name: null, role: null, agreedAt: null },
  'Healthcare operations': { state: 'none', name: null, role: null, agreedAt: null },
};

export function reviewerFor(vertical) {
  const entry = REVIEWERS[vertical];
  if (!entry) return { state: 'none', name: null, role: null, vertical };
  // A name only ever leaves this module when somebody has actually agreed.
  const named = entry.state === 'confirmed';
  return {
    vertical,
    state: entry.state,
    name: named ? entry.name : null,
    role: named ? entry.role : null,
    agreedAt: named ? entry.agreedAt : null,
  };
}

// What a student or a company reads. Written so the honest state is a sentence rather than a
// missing badge, because an absent badge reads as an oversight and this is a fact.
export function reviewerLine(vertical) {
  const r = reviewerFor(vertical);
  if (r.state === 'confirmed') {
    return {
      state: r.state,
      headline: `Bar set with ${r.name}`,
      // What they actually do, because "vetted by a professional" is the kind of phrase a
      // student has heard before and correctly discounts.
      detail: `${r.role}. They scored the anchor submissions this bar is built from, they break ties when our two raters disagree, and they re-check a sample each quarter to catch it drifting.`,
    };
  }
  if (r.state === 'invited') {
    return {
      state: r.state,
      headline: 'Practitioner review in progress',
      detail: 'We have approached someone to sign off this bar and they have not agreed yet, so nobody is named.',
    };
  }
  return {
    state: 'none',
    headline: 'Bar set by Covenda',
    // Said plainly. A company that discovers this for itself trusts nothing else on the page.
    detail: 'No outside practitioner has signed off this vertical yet. The bar is published either way, so you can judge it directly.',
  };
}

// For the operator view: how much of the catalogue is actually backed.
export function reviewerCoverage() {
  const all = Object.entries(REVIEWERS);
  const confirmed = all.filter(([, r]) => r.state === 'confirmed');
  return {
    total: all.length,
    confirmed: confirmed.length,
    invited: all.filter(([, r]) => r.state === 'invited').length,
    none: all.filter(([, r]) => r.state === 'none').length,
    verticals: confirmed.map(([v]) => v),
    // The number that decides whether the claim may be made at all.
    mayClaimProfessionalVetting: confirmed.length === all.length,
  };
}
