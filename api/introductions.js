// Introductions, outcomes, and company referrals — the rules, kept pure and testable.
//
// The API layer does the I/O; everything here is the part worth being sure about.

export const INTRODUCTIONS_VERSION = 'introductions-1.0.0';

// ── Introductions ─────────────────────────────────────────────────────────────────────
// The terms a company must state before reaching a student. This list is short and all of it
// is required, because an introduction missing the money or the hours is exactly how students
// get strung along by something that turns out to be unpaid or open-ended.
export const REQUIRED_TERMS = [
  ['roleSummary', 'what the work is'],
  ['whyRelevant', 'why you picked them'],
  ['compensation', 'what it pays'],
  ['timeCommitment', 'how much time it takes'],
  ['nextStep', 'what happens next'],
];

export function checkIntroduction(input = {}) {
  const missing = REQUIRED_TERMS
    .filter(([key]) => !String(input[key] || '').trim())
    .map(([, label]) => label);

  if (missing.length) {
    return {
      ok: false,
      missing,
      reason: `An introduction has to say ${missing.join(', ')}. A student cannot judge an offer that leaves those out.`,
    };
  }
  // "Competitive" and "TBD" are how compensation gets left open. If it is genuinely unpaid,
  // it has to say so — a student can accept unpaid work; they cannot accept a vague promise.
  const pay = String(input.compensation).trim().toLowerCase();
  if (/^(tbd|competitive|negotiable|depends|doe)\b/.test(pay)) {
    return {
      ok: false, missing: ['a real number or "unpaid"'],
      reason: 'Say the number, a range, or "unpaid". "Competitive" is not something a student can weigh.',
    };
  }
  return { ok: true, missing: [] };
}

// What a student can do with an introduction. Declining and reporting are first-class, not
// buried — a student who feels pressured needs an obvious exit.
export const STUDENT_RESPONSES = ['accepted', 'question', 'declined', 'reported'];

export function applyResponse(intro = {}, response, note = '') {
  if (!STUDENT_RESPONSES.includes(response)) throw new Error('Choose a valid response.');
  if (intro.status && intro.status !== 'sent' && intro.status !== 'question') {
    throw new Error('This introduction has already been answered.');
  }
  if (response === 'question' && !String(note || '').trim()) {
    throw new Error('Add your question so the company can answer it.');
  }
  return { status: response, student_response: String(note || '').trim() || null };
}

// ── Outcomes ──────────────────────────────────────────────────────────────────────────
// The company plan lists seven questions. They are stored structurally rather than as a
// note, because free text cannot be compared across engagements and comparison is the only
// reason to ask.
export const OUTCOME_QUESTIONS = [
  { key: 'evidenceThatMattered', prompt: 'Which evidence actually mattered?', kind: 'text' },
  { key: 'shortlistRelevant', prompt: 'Was the shortlist relevant?', kind: 'scale' },
  { key: 'timeSaved', prompt: 'Roughly how many hours did Covenda save you?', kind: 'number' },
  { key: 'wouldUseAgain', prompt: 'Would you use Covenda again?', kind: 'yesno' },
  { key: 'wouldRefer', prompt: 'Would you refer another startup?', kind: 'yesno' },
  { key: 'performedAsExpected', prompt: 'Did the student perform as expected?', kind: 'scale' },
  { key: 'missingFromProfile', prompt: 'What was missing from their profile?', kind: 'text' },
];

// A survey nobody finishes is worse than a shorter one, so only the two questions that
// change what we do are required. The rest are genuinely optional and say so.
export const REQUIRED_OUTCOME_KEYS = ['shortlistRelevant', 'wouldUseAgain'];

export function normaliseOutcome(answers = {}) {
  const out = {};
  for (const q of OUTCOME_QUESTIONS) {
    const raw = answers[q.key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (q.kind === 'number') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) out[q.key] = Math.round(n);
    } else if (q.kind === 'yesno') {
      out[q.key] = raw === true || raw === 'yes';
    } else if (q.kind === 'scale') {
      const n = Number(raw);
      if (Number.isFinite(n)) out[q.key] = Math.max(1, Math.min(5, Math.round(n)));
    } else {
      out[q.key] = String(raw).trim().slice(0, 1000);
    }
  }
  const missing = REQUIRED_OUTCOME_KEYS.filter(k => out[k] === undefined);
  return { answers: out, ok: missing.length === 0, missing };
}

// ── Company referrals ─────────────────────────────────────────────────────────────────
// Rewarded only after the referred company does something real. Each gate has to have been
// passed, and they are checked as a set rather than a sequence so a company that hires
// without ever requesting an introduction still counts.
export const REFERRAL_GATES = ['verified_at', 'brief_at', 'introduced_at', 'converted_at'];

export function referralStatus(row = {}) {
  const passed = REFERRAL_GATES.filter(g => Boolean(row[g]));
  const remaining = REFERRAL_GATES.filter(g => !row[g]);
  const labels = {
    verified_at: 'confirms a work email',
    brief_at: 'creates a real brief',
    introduced_at: 'requests an introduction',
    converted_at: 'pays or hires',
  };
  return {
    passed: passed.length,
    total: REFERRAL_GATES.length,
    remaining: remaining.map(g => labels[g]),
    // Earned, not paid — the API decides when to actually move credits.
    earned: remaining.length === 0 && !row.rewarded_at,
    alreadyRewarded: Boolean(row.rewarded_at),
    summary: remaining.length === 0
      ? 'All four cleared.'
      : `Pays out once the company ${remaining.map(g => labels[g]).join(', then ')}.`,
  };
}
