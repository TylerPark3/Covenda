// The finance batch assessment: Covenda supplies the exercise.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────
// The finance vetting design said "upload a model you built". That assumes the student
// already has one, and most undergraduates do not — it is the same failure as the old
// "paste a Loom link" intro video: a requirement that quietly filters for people who have
// already been given opportunities, which is the exact thing this platform exists to route
// around.
//
// Worse, "build something and show us" asks a nineteen-year-old to invent a finance project
// from nothing. That is not a test of accounting ability. It is a test of imagination plus
// free time.
//
// So Covenda provides the work. Three components, all supplied:
//
//   1. A TIMED EXCEL EXERCISE, screen-recorded. Excel adeptness is the actual gate for
//      accounting and finance roles, and it is only visible in the doing — keystrokes,
//      navigation, whether they reach for a mouse or a shortcut, whether they build a
//      driver or hardcode. A finished workbook hides all of it.
//
//   2. TECHNICAL QUESTIONS from a published bank. These are the standard questions the
//      industry asks and every candidate can find online. Publishing them is deliberate:
//      we are not testing whether someone discovered a secret list, we are testing whether
//      they can answer under a follow-up. Preparation is fine. Only understanding survives
//      the second question.
//
//   3. A DEFENSE of what they just built, drawn from their own recording.
//
// Pure module — the bank, the exercises, and the scoring rules. No I/O.

export const FINANCE_ASSESSMENT_VERSION = 'finance-assessment-1.0.0';

// ── Excel exercises ───────────────────────────────────────────────────────────────────
// Each is small enough to finish inside the window and structured so the RECORDING is the
// evidence, not the file. What we are reading is method.
export const EXCEL_EXERCISES = {
  'accounting-audit': {
    id: 'reconciliation',
    title: 'Reconcile two ledgers',
    minutes: 20,
    supplied: 'Two sheets that should agree and do not, with six discrepancies planted: two timing differences, two duplicates, one transposition, one genuine error.',
    task: 'Find every discrepancy, categorise each one, and produce a reconciliation that ties.',
    // What a rater watches for in the recording. Stated so raters converge.
    watchFor: [
      'Do they sort/filter to narrow, or scroll and eyeball',
      'Do they use a lookup or manually match',
      'Do they find the transposition (difference divisible by 9 — the classic tell)',
      'Do they separate timing from error, or lump everything as "variance"',
    ],
    shortcuts: ['Ctrl+↓ / Ctrl+Shift+↓ navigation', 'XLOOKUP or INDEX/MATCH', 'Conditional formatting to spot duplicates', 'Filter rather than sort-and-scan'],
  },
  'investment-banking': {
    id: 'three-statement-link',
    title: 'Link a broken model',
    minutes: 25,
    supplied: 'A three-statement model with the links deliberately broken: net income not flowing to retained earnings, D&A missing from cash flow, and the balance sheet out by a known amount.',
    task: 'Make it balance, and say what each fix was.',
    watchFor: [
      'Do they trace the imbalance or guess-and-check',
      'Do they know where to look first (cash flow is usually the culprit)',
      'Do they hardcode a plug to force a balance — the disqualifying move',
      'Do they build drivers or type constants into formulas',
    ],
    shortcuts: ['F2 to trace a formula', 'Ctrl+[ to jump to precedents', 'Trace Precedents/Dependents', 'F9 to evaluate part of a formula'],
  },
  'private-equity': {
    id: 'paper-lbo',
    title: 'Paper LBO, then build it',
    minutes: 30,
    supplied: 'Entry multiple, leverage, a five-year operating case, and an exit assumption.',
    task: 'Estimate the IRR on paper first and say your number out loud. Then build it and reconcile the difference.',
    // Saying the estimate aloud BEFORE building is the design's whole point: it exposes
    // whether they have intuition or only mechanics.
    watchFor: [
      'Is the paper estimate close, and can they explain their shortcut',
      'Do they handle the interest circularity or avoid it',
      'Can they decompose returns without being asked',
      'Do they sanity-check the output against their own estimate',
    ],
    shortcuts: ['Iterative calculation for circularity', 'Data tables for sensitivity', 'Named ranges for drivers'],
  },
  'venture-capital': {
    id: 'cap-table',
    title: 'Cap table and dilution',
    minutes: 20,
    supplied: 'A cap table pre-seed, plus a proposed round with a SAFE converting and an option pool refresh.',
    task: 'Show post-round ownership, and say who actually pays for the pool.',
    watchFor: [
      'Do they handle the pool shuffle correctly (pre-money pool dilutes existing holders)',
      'Do they convert the SAFE at the right basis',
      'Can they state who bears the dilution without prompting',
    ],
    shortcuts: ['Absolute vs relative references', 'Structuring so the round is a driver, not hardcoded'],
  },
  'asset-wealth-management': {
    id: 'position-sizing',
    title: 'Size a portfolio to a risk rule',
    minutes: 20,
    supplied: 'Ten candidate positions with volatilities and correlations, plus a stated maximum drawdown tolerance.',
    task: 'Size the book to the rule, and show what breaks it.',
    watchFor: [
      'Do they size to risk or to conviction',
      'Do they account for correlation, or treat positions as independent',
      'Do they identify the scenario that breaches the tolerance',
    ],
    shortcuts: ['SUMPRODUCT for weighted exposure', 'Data tables for scenario runs'],
  },
};

// ── The published technical bank ──────────────────────────────────────────────────────
// These are the standard industry questions. Publishing them is the design: preparation is
// expected and fine. The follow-up is what separates understanding from recall, which is why
// every question carries one.
export const TECHNICAL_BANK = {
  'accounting-audit': [
    { q: 'Walk me through the three financial statements and how they connect.',
      followUp: 'If depreciation goes up by 10, what happens to each statement?',
      probes: 'Whether the links are understood or memorised as a sequence.' },
    { q: 'What is the difference between accrual and cash accounting?',
      followUp: 'Give me a case where a profitable company runs out of cash.',
      probes: 'Whether they can apply it, not define it.' },
    { q: 'What is working capital, and what does an increase do to cash flow?',
      followUp: 'A company’s receivables are growing faster than revenue. What do you think is happening?',
      probes: 'Directional reasoning and suspicion.' },
    { q: 'How do you test whether revenue was recorded in the right period?',
      followUp: 'What would you look at if you suspected it was not?',
      probes: 'Audit instinct rather than procedure recall.' },
  ],
  'investment-banking': [
    { q: 'Walk me through a DCF.',
      followUp: 'Which input is your answer most sensitive to, and why?',
      probes: 'Whether they know where the value actually comes from — usually terminal value.' },
    { q: 'Why might you use EBITDA rather than net income for comparison?',
      followUp: 'When would EBITDA mislead you?',
      probes: 'Whether they see the limits of their own tool.' },
    { q: 'What happens to enterprise value if a company raises debt?',
      followUp: 'And to equity value?',
      probes: 'The single most common undergraduate confusion in finance.' },
    { q: 'Two companies are identical except one leases and one owns. How do the multiples differ?',
      followUp: 'Which would you rather own?',
      probes: 'Whether accounting differences are understood as economic ones.' },
  ],
  'private-equity': [
    { q: 'Walk me through an LBO at a high level.',
      followUp: 'Where do the returns actually come from in your example?',
      probes: 'Deleveraging vs multiple expansion vs operations — the core decomposition.' },
    { q: 'What makes a good LBO candidate?',
      followUp: 'Name a business that looks like one and is not.',
      probes: 'Whether the criteria are understood or recited.' },
    { q: 'How does a dividend recap affect returns?',
      followUp: 'What is the risk you are taking on to get it?',
      probes: 'Whether they see both sides of financial engineering.' },
  ],
  'venture-capital': [
    { q: 'How would you value a company with no revenue?',
      followUp: 'What would make you wrong?',
      probes: 'Comfort with uncertainty rather than false precision.' },
    { q: 'What is the difference between a SAFE and a priced round for the founder?',
      followUp: 'And for the earliest investor?',
      probes: 'Whether they think about incentives, not just mechanics.' },
    { q: 'A company grew 300% last year. What do you want to know?',
      followUp: 'Which of those would make you pass?',
      probes: 'Whether growth is interrogated or admired.' },
  ],
  'asset-wealth-management': [
    { q: 'What is the difference between a good decision and a good outcome?',
      followUp: 'Give me an example from your own investing.',
      probes: 'The single most important distinction in this specialisation.' },
    { q: 'How do you think about position sizing?',
      followUp: 'What size would make you unable to sleep, and why is that the real limit?',
      probes: 'Whether risk is a rule or a feeling.' },
    { q: 'Two managers returned 20% last year. How would you tell them apart?',
      followUp: 'What would you need to see?',
      probes: 'Process over outcome — the core of the design.' },
  ],
};

export function assessmentFor(slug) {
  const exercise = EXCEL_EXERCISES[slug] || null;
  const technicals = TECHNICAL_BANK[slug] || [];
  if (!exercise && !technicals.length) return null;
  return {
    version: FINANCE_ASSESSMENT_VERSION,
    slug,
    exercise,
    technicals,
    totalMinutes: (exercise?.minutes || 0) + technicals.length * 2,
    // Said to the student before they start, because a published bank read as a trap would
    // be worse than not publishing it.
    note: 'The questions are published on purpose. Prepare all you like — we are listening to the follow-up, not the answer.',
  };
}

// Excel adeptness is only visible in the doing, so the recording is the artifact and the
// resulting file is secondary. Rubric reads method.
export const EXCEL_RUBRIC = {
  4: 'Reaches the answer, or does not. Navigates by mouse and scrolling. Types constants inside formulas. Cannot say why they did something when asked.',
  6: 'Reaches the answer with a repeatable method. Uses lookups and keyboard navigation. Separates inputs from calculations. Can explain each step.',
  9: 'Structures before calculating. Builds so the work would survive someone else opening it. Sanity-checks the output against an independent estimate, and catches their own error without prompting.',
};

// The disqualifying move is worth naming explicitly: a plug that forces a balance is not a
// mistake of skill, it is a decision to hide one.
export const DISQUALIFYING = [
  { move: 'Hardcoding a plug to force a balance', why: 'It conceals the error rather than finding it, and in a real model somebody later trusts the balanced output.' },
];

export function scoreGuidance(slug) {
  const a = assessmentFor(slug);
  if (!a) return null;
  return {
    watchFor: a.exercise?.watchFor || [],
    rubric: EXCEL_RUBRIC,
    disqualifying: DISQUALIFYING,
    // Two raters watch the same recording, so calibration is measurable here in a way it is
    // not for a live interview.
    raters: 2,
    note: 'Score the method, not the finished file. A correct answer reached by trial and error scores below a wrong answer reached by a sound approach that ran out of time.',
  };
}

// ── Concept questions (multiple choice) ───────────────────────────────────────────────
// Multiple choice earns its place for CONCEPTS, where there genuinely is a right answer and
// a wrong one, and where a written answer would tell us nothing extra. Every distractor here
// is a real misconception rather than filler — a wrong option nobody would pick teaches us
// nothing about the person who did not pick it.
export const CONCEPT_QUESTIONS = {
  'accounting-audit': [
    { q: 'Depreciation increases by 10. Ignoring tax, what happens to cash flow from operations?',
      options: ['Falls by 10', 'Rises by 10', 'Unchanged', 'Falls by 10 then recovers'],
      answer: 2,
      why: 'Net income falls by 10 and depreciation is added back — the two cancel. Picking "falls" is the classic error of treating a non-cash charge as cash.' },
    { q: 'A company recognises revenue on delivery. It ships in December and is paid in February. In December:',
      options: ['Revenue and cash both rise', 'Revenue rises, receivables rise', 'Deferred revenue rises', 'Nothing is recorded'],
      answer: 1,
      why: 'Accrual timing. "Deferred revenue" is the mirror error — that is cash before delivery.' },
    { q: 'Which of these would NOT appear as a reconciling item between book and bank?',
      options: ['Outstanding cheques', 'Deposits in transit', 'Bank fees not yet recorded', 'An accrued expense'],
      answer: 3,
      why: 'An accrual never touches the bank, so it cannot reconcile against it.' },
  ],
  'investment-banking': [
    { q: 'A company raises 100 of debt and holds it as cash. Enterprise value:',
      options: ['Rises by 100', 'Falls by 100', 'Unchanged', 'Depends on the interest rate'],
      answer: 2,
      why: 'Debt up 100, cash up 100, net debt unchanged. This is the single most common undergraduate error in finance.' },
    { q: 'Which has the largest effect on a DCF output, typically?',
      options: ['Year-1 revenue growth', 'Terminal growth rate', 'Year-3 margin', 'Working capital timing'],
      answer: 1,
      why: 'Terminal value is usually the majority of the total. A candidate who says year-1 growth has not looked at where the value sits.' },
    { q: 'Two identical companies; one leases its fleet, one owns it. All else equal, the lessee will show:',
      options: ['Higher EBITDA', 'Lower EBITDA', 'Identical EBITDA', 'Higher net income'],
      answer: 1,
      why: 'Lease expense sits above EBITDA; depreciation does not. This is why EBITDA multiples mislead across different capital structures.' },
  ],
};

// ── Brainteasers ──────────────────────────────────────────────────────────────────────
// Not for the answer. For whether someone can hold an unfamiliar constraint in their head
// and reason forward from it — and, more usefully, whether they say "I do not know yet" out
// loud instead of guessing confidently.
//
// Scored on the reasoning shown, never on getting there. A candidate who states their
// approach and runs out of time scores above one who blurts the memorised answer.
export const BRAINTEASERS = [
  { id: 'ropes',
    q: 'Two ropes each burn for exactly one hour, but not at a uniform rate — half a rope does not mean half an hour. Using only these two ropes and a lighter, measure 45 minutes.',
    reveals: 'Whether they use both ends. The insight is that lighting a rope at both ends halves its time regardless of how unevenly it burns.',
    weak: 'Tries to fold or measure the rope — treats the non-uniform burn as a detail rather than the whole problem.',
    strong: 'Light rope A at both ends and rope B at one end. A finishes at 30 minutes; light B\'s other end then; B finishes 15 minutes later.' },
  { id: 'bridge',
    q: 'Four people must cross a bridge at night with one torch. It holds two at a time and the torch must come back. They take 1, 2, 7 and 10 minutes; a pair moves at the slower one\'s pace. Get everyone across in 17.',
    reveals: 'Whether they notice the two slowest should cross together rather than each being escorted.',
    weak: 'Sends the fastest person back and forth every time — the intuitive approach, and it costs 19.',
    strong: 'Pairs the two slowest so their times overlap instead of accumulating.' },
  { id: 'weighing',
    q: 'You have 8 balls, one heavier. Using a balance scale twice, find it.',
    reveals: 'Whether they think in thirds rather than halves. Halving is the instinct and it needs three weighings.',
    weak: 'Splits 4 and 4 — binary search, which is one weighing too many.',
    strong: 'Splits 3-3-2 and uses the fact that a balanced scale is information too.' },
  { id: 'pills',
    q: 'You have 10 bottles of pills. All weigh 1g each except one bottle where every pill weighs 1.1g. You have a digital scale and one weighing. Find the bad bottle.',
    reveals: 'Whether they can encode identity into a measurement rather than searching.',
    weak: 'Weighs bottles one at a time and runs out of weighings.',
    strong: 'Takes 1 pill from bottle 1, 2 from bottle 2, and so on; the excess over 55g names the bottle.' },
];

export function brainteaserFor(seedIndex = 0) {
  return BRAINTEASERS[Math.abs(Number(seedIndex) || 0) % BRAINTEASERS.length];
}

// The rubric for a brainteaser reads reasoning, and says so, because a student who thinks it
// is a trivia test will guess rather than think aloud.
export const BRAINTEASER_RUBRIC = {
  4: 'Guesses, or recites a remembered answer with no reasoning. Cannot say why it works.',
  6: 'States an approach, tests it against the constraint, and adjusts when it fails. May not finish.',
  9: 'Identifies the binding constraint early and reasons from it. Says clearly what they do not yet know rather than filling the silence.',
};
