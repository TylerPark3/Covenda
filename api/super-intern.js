// The Super-Intern assessment framework.
//
// ── THE REFRAME THIS MODULE EXISTS FOR ────────────────────────────────────────────────
// Everything Covenda measured until now asked "is this student good". The constraint a startup
// actually has is not the student's wage, it is SENIOR EMPLOYEE TIME. A student can be cheap to
// hire and expensive to onboard, and the expensive part is a senior engineer explaining the
// codebase instead of building the product.
//
// So the question every assessment here answers is narrower and more useful:
//
//     How much senior time will this person consume before they contribute?
//
// That is why agency, resourcefulness and learning velocity are measured as first-class
// dimensions rather than as personality adjectives. A student who can unblock themselves costs
// a fraction of one who cannot, at identical technical ability.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────────────────
// No composite readiness number. Dimensions are reported independently because they trade off
// against each other and a company hiring for autonomy wants a different profile from one
// hiring for depth. Averaging them destroys exactly the information that makes the match work.
//
// Nothing here scores anybody automatically. Every function returns a structured observation
// and the question a reviewer should ask next. The judgement stays human.

export const SUPER_INTERN_VERSION = 'super-intern-1.0.0';

// ── The dimensions ────────────────────────────────────────────────────────────────────
// Measured separately, never summed. `costsSeniorTime` names what a company pays when a
// student is weak here, which is the whole point of measuring it.
export const DIMENSIONS = {
  capability: {
    id: 'capability', label: 'Technical capability',
    reads: 'Whether they can do the work at all.',
    costsSeniorTime: 'Every task has to be checked line by line.',
  },
  agency: {
    id: 'agency', label: 'Agency',
    reads: 'What they do when the obvious path is blocked.',
    costsSeniorTime: 'They stop and wait, and the senior becomes the unblocking service.',
  },
  resourcefulness: {
    id: 'resourcefulness', label: 'Resourcefulness',
    reads: 'Whether they can find and validate an answer they were never given.',
    costsSeniorTime: 'Every unknown becomes a question rather than a search.',
  },
  learningVelocity: {
    id: 'learningVelocity', label: 'Learning velocity',
    reads: 'How fast they can pick up something genuinely new.',
    costsSeniorTime: 'Domain knowledge has to be taught rather than absorbed.',
  },
  discernment: {
    id: 'discernment', label: 'Discernment',
    reads: 'Whether they can tell a good source, or a right answer, from a plausible one.',
    costsSeniorTime: 'Confidently wrong work is more expensive than no work.',
  },
  leverage: {
    id: 'leverage', label: 'Leverage',
    reads: 'Whether AI and tooling multiply their output or substitute for their thinking.',
    costsSeniorTime: 'Reviewing generated code the student cannot explain.',
  },
  ownership: {
    id: 'ownership', label: 'Ownership',
    reads: 'Whether they can account for their own decisions afterwards.',
    costsSeniorTime: 'Nobody can tell which parts of the work are actually understood.',
  },
  communication: {
    id: 'communication', label: 'Communication',
    reads: 'Whether they can say what they did, what they tried, and where they got stuck.',
    costsSeniorTime: 'The senior has to reconstruct the work to review it.',
  },
};

export const DIMENSION_IDS = Object.keys(DIMENSIONS);

// ── Agency, defined behaviourally ─────────────────────────────────────────────────────
// "High agency" is unusable as a trait. As a behaviour it is checkable: what happened when the
// obvious path closed.
//
// The bands are deliberately not a score. A reviewer places an account in one, and the band
// carries the question that would confirm or break it.
export const AGENCY_BANDS = [
  {
    id: 'waited', label: 'Escalated and waited',
    looksLike: 'Contacted whoever owned the blocker and stopped until they replied.',
    reads: 'Correct behaviour, and it makes progress a function of somebody else\'s response time.',
    probe: 'While you were waiting, what else could have moved?',
  },
  {
    id: 'parallel', label: 'Escalated and kept moving',
    looksLike: 'Raised it with the owner, then continued on a part that was not blocked.',
    reads: 'Keeps the critical path alive without going around anybody. The common shape of a strong junior.',
    probe: 'How did you decide which part was safe to continue on?',
  },
  {
    id: 'routed', label: 'Found another route',
    looksLike: 'Built a temporary workaround, found an alternative source, or reached the owner another way, and kept building.',
    reads: 'Treats a blocker as a problem to solve rather than a state to report.',
    probe: 'What did your workaround assume, and what would have broken if that assumption was wrong?',
  },
];

// The failure mode this framework has to avoid: rewarding somebody who ignored a boundary and
// called it initiative. Agency is about maintaining momentum, not about going around people.
export const AGENCY_DISQUALIFIERS = [
  'Bypassed a control or a permission rather than a technical obstacle.',
  'Went around a person who had said no, without raising it.',
  'Hid the workaround rather than flagging it.',
];

export function agencyBand(id) {
  return AGENCY_BANDS.find(b => b.id === id) || null;
}

// The blocker scenario. Asked of every vertical, because every vertical has blockers.
export function blockerPrompt(vertical = 'your work') {
  return {
    dimension: 'agency',
    ask: `Tell us about a time something you needed in ${vertical} was not available. A dependency broke, a person said no, access was refused, or a resource did not exist. What did you do?`,
    // Written when the assessment was designed, not improvised per applicant, so two reviewers
    // reading two students apply the same standard.
    lookFor: AGENCY_BANDS.map(b => ({ band: b.id, looksLike: b.looksLike, reads: b.reads })),
    disqualifiers: AGENCY_DISQUALIFIERS,
    followUp: 'What would you have done if the workaround had not been available either?',
  };
}

// ── The Deep Dive ─────────────────────────────────────────────────────────────────────
// The single best test of learning velocity, and it works identically in every vertical:
// hand somebody a genuinely difficult concept they do not already know, and see whether they
// can learn it and then explain it plainly.
//
// The topic must be chosen, not offered. A student picking their own topic tests what they
// already know, which is the thing a résumé already claims.
export const DEEP_DIVE = {
  minutes: 12,
  prepDays: 3,
  stages: [
    { id: 'assigned', label: 'Topic assigned', detail: 'Chosen by Covenda from the vertical, not by the student.' },
    { id: 'research', label: 'Independent research', detail: 'Any source, including AI. The tools are not the test.' },
    { id: 'explain', label: 'Explain it in ten minutes', detail: 'To somebody competent who does not know this specific thing.' },
    { id: 'defend', label: 'Answer follow-ups', detail: 'Where the borrowed understanding and the real one separate.' },
  ],
  // What a reviewer is actually listening for. Jargon is the tell: it is what someone reaches
  // for when they have memorised a description rather than understood a mechanism.
  reads: [
    { signal: 'Explains the mechanism, not the label', means: 'They understood it rather than memorised its description.' },
    { signal: 'Says what they did not understand at first', means: 'They can locate the edge of their own knowledge.' },
    { signal: 'Answers "why does that matter" without reaching for jargon', means: 'They can hold the concept and its purpose at once.' },
    { signal: 'Says "I do not know" cleanly on a follow-up', means: 'Discernment. Guessing here is the more expensive habit.' },
  ],
  fails: [
    'Recites a definition and stalls on the first follow-up.',
    'Uses the vocabulary correctly but cannot say what problem the thing solves.',
    'Cannot say where they got it from or how they checked it.',
  ],
};

// Topics per vertical. Deliberately narrow: broad enough to research in a few days, specific
// enough that nobody has it memorised from coursework.
export const DEEP_DIVE_TOPICS = {
  'software-ai': [
    'Why batch normalisation behaves differently at inference than during training',
    'What a write-ahead log buys a database, and what it costs',
    'Why a p99 latency figure can improve while every user gets slower',
    'What actually happens between a container and the host kernel',
    'Why floating point makes some financial calculations wrong',
  ],
  'accounting-finance': [
    'Why a DCF terminal value usually dominates the answer, and what that implies',
    'What a deferred tax asset actually represents',
    'Why circularity appears in an LBO model and how it is normally handled',
    'What a revenue recognition standard changes about when cash and profit diverge',
    'Why two analysts can produce different WACCs from the same company',
  ],
  'healthcare-operations': [
    'Why a diagnostic test with 99% accuracy can still be wrong most of the time',
    'What a prior authorisation is actually protecting against',
    'Why clinical trial endpoints are argued over before a trial begins',
    'What makes a coding error a compliance problem rather than a billing one',
    'Why readmission rates are a contested quality measure',
  ],
  'consumer-retail': [
    'Why last-click attribution systematically misprices upper-funnel spend',
    'What a holdout test measures that a conversion rate cannot',
    'Why a stockout costs more than the margin on the units not sold',
    'What makes a cohort retention curve flatten, and what it means when it does not',
    'Why gross margin and contribution margin disagree about the same product',
  ],
  'professional-services': [
    'Why a market size can be correct and useless at the same time',
    'What makes a survey result unreliable even with a large sample',
    'Why an engagement scope changes what the answer is allowed to be',
    'What a materiality threshold actually decides',
    'Why two credible sources cite the same underlying number',
  ],
};

export function deepDiveFor(verticalSlug, index = 0) {
  const topics = DEEP_DIVE_TOPICS[verticalSlug];
  if (!topics) return null;
  return {
    ...DEEP_DIVE,
    vertical: verticalSlug,
    // Rotated rather than random so a run is reproducible and two students in one batch do not
    // silently get the same topic.
    topic: topics[Math.abs(index) % topics.length],
    dimensions: ['learningVelocity', 'communication', 'discernment'],
  };
}

// ── Figure It Out ─────────────────────────────────────────────────────────────────────
// A problem outside what they have been taught, with the tools explicitly allowed. What is
// being read is the process, not whether they finished.
export const FIGURE_IT_OUT_STEPS = [
  { id: 'decompose', label: 'Decomposition', asks: 'Did they work out what they needed to know before searching?' },
  { id: 'retrieve', label: 'Retrieval', asks: 'Did they find something genuinely useful, or the first result?' },
  { id: 'discern', label: 'Discernment', asks: 'Could they tell a credible source from a confident one?' },
  { id: 'learn', label: 'Learning', asks: 'Did they understand it, or copy it?' },
  { id: 'apply', label: 'Application', asks: 'Could they adapt it to a situation it was not written for?' },
  { id: 'verify', label: 'Verification', asks: 'Did they check it worked, or assume it did?' },
  { id: 'adapt', label: 'Adaptation', asks: 'What happened when the first attempt failed?' },
  { id: 'defend', label: 'Defence', asks: 'Can they explain the result and say what they are unsure about?' },
];

export function figureItOut({ vertical = 'this field', task = null } = {}) {
  return {
    dimensions: ['resourcefulness', 'learningVelocity', 'discernment', 'leverage'],
    // Said out loud, because a student who thinks tools are forbidden will hide the process
    // that is actually being assessed.
    framing: 'You have not been taught this. Use anything you would really use, including AI. '
      + 'We are reading how you work it out, not whether you already knew.',
    task: task || `A problem in ${vertical} that nobody at your stage would have been taught.`,
    steps: FIGURE_IT_OUT_STEPS,
    minutes: 90,
  };
}

// ── AI: leverage or dependence ────────────────────────────────────────────────────────
// Banning the tools produces a test of who is willing to lie. The useful distinction is
// whether the student can stand behind what came out.
export const AI_BANDS = [
  {
    id: 'dependent', label: 'Dependent',
    looksLike: 'Cannot explain the output, spot its errors, or change it.',
    reads: 'Every piece of their work needs full senior review, because nobody knows what is understood.',
  },
  {
    id: 'assisted', label: 'Assisted',
    looksLike: 'Understands the output and can modify it, but did not check it independently.',
    reads: 'Faster than unaided, and correctness still rests on somebody else.',
  },
  {
    id: 'leveraged', label: 'Leveraged',
    looksLike: 'Used it to move faster, found what it got wrong, verified the rest, and can defend the result.',
    reads: 'Multiplies their own output. This is the profile the whole thesis is about.',
  },
];

export const AI_OWNERSHIP_PROBES = [
  'Which part of this did the model get wrong, and how did you notice?',
  'Why this approach rather than the obvious alternative?',
  'What did you check, and what are you taking on trust?',
  'What breaks first if this goes to production?',
];

export function aiBand(id) {
  return AI_BANDS.find(b => b.id === id) || null;
}

// ── The company side: what onboarding actually costs ──────────────────────────────────
// A company describes its constraint, and the assessment is built to close the expensive gaps
// rather than to test everything equally.
export const AUTONOMY_LEVELS = ['guided', 'semi_autonomous', 'autonomous', 'high_agency'];

const AUTONOMY_WEIGHT = {
  guided: ['capability', 'communication'],
  semi_autonomous: ['capability', 'communication', 'ownership'],
  autonomous: ['agency', 'resourcefulness', 'ownership', 'capability'],
  high_agency: ['agency', 'resourcefulness', 'learningVelocity', 'discernment'],
};

// The heart of the company batch builder. Senior hours available is the input nobody else asks
// for, and it is the one that decides everything: a team with two hours a week cannot afford a
// student who needs unblocking, whatever their technical score.
export function assessmentPlan({
  vertical = 'software-ai',
  autonomy = 'semi_autonomous',
  seniorHoursPerWeek = null,
  onboardingBurden = [],
  domainKnowledge = false,
} = {}) {
  const level = AUTONOMY_LEVELS.includes(autonomy) ? autonomy : 'semi_autonomous';
  const focus = [...AUTONOMY_WEIGHT[level]];

  // Below roughly three hours a week there is no supervision budget, so self-direction stops
  // being a preference and becomes the requirement.
  const scarceSeniorTime = seniorHoursPerWeek !== null && Number(seniorHoursPerWeek) <= 3;
  if (scarceSeniorTime) for (const d of ['agency', 'resourcefulness']) if (!focus.includes(d)) focus.unshift(d);
  if (domainKnowledge && !focus.includes('learningVelocity')) focus.push('learningVelocity');

  const components = [
    { id: 'objective', label: 'Objective questions', why: 'A measurable floor on what they already know.' },
    { id: 'deep_dive', label: 'Deep Dive', why: 'Whether they can learn something hard and explain it.' },
  ];
  if (focus.includes('agency')) components.push({ id: 'blocker', label: 'Blocker account', why: 'What they do when the obvious path closes.' });
  if (focus.includes('resourcefulness')) components.push({ id: 'figure_it_out', label: 'Figure It Out', why: 'Finding and validating an answer nobody gave them.' });
  components.push({ id: 'simulation', label: 'Scenario sitting', why: 'Decisions under incomplete information, with the trade named.' });
  components.push({ id: 'defense', label: 'Defence', why: 'The only part no artifact and no score can stand in for.' });

  return {
    version: SUPER_INTERN_VERSION,
    vertical,
    autonomy: level,
    focus,
    components,
    deepDive: deepDiveFor(vertical),
    // Named so a company sees which of its own constraints shaped the assessment.
    because: [
      `Autonomy expected: ${level.replace(/_/g, ' ')}.`,
      scarceSeniorTime
        ? `Around ${seniorHoursPerWeek} senior hours a week, so self-direction is a requirement rather than a preference.`
        : seniorHoursPerWeek !== null ? `Around ${seniorHoursPerWeek} senior hours a week available.` : null,
      domainKnowledge ? 'Domain knowledge has to be learned on the job, so learning velocity is weighted.' : null,
      (onboardingBurden || []).length ? `Most expensive to teach: ${onboardingBurden.join(', ')}.` : null,
    ].filter(Boolean),
  };
}

// ── The outcome loop ──────────────────────────────────────────────────────────────────
// What actually decides whether any of the above predicted anything. Recorded per placement,
// and until there are placements it is empty rather than estimated.
export const OUTCOME_MEASURES = [
  { id: 'days_to_contribution', label: 'Days to first meaningful contribution', unit: 'days' },
  { id: 'senior_hours', label: 'Senior hours consumed', unit: 'hours' },
  { id: 'independent_resolution', label: 'Blockers resolved without escalating', unit: 'percent' },
  { id: 'rework_rate', label: 'Work substantially redone by a senior', unit: 'percent' },
  { id: 'would_continue', label: 'Company would continue working with them', unit: 'boolean' },
];

// The honest state of the loop. A framework that claims predictive power it has not earned is
// exactly the thing this product exists to replace.
export function calibrationStatus(outcomes = []) {
  const recorded = (outcomes || []).filter(o => o && o.days_to_contribution !== undefined).length;
  return {
    recorded,
    // Below this there is nothing to learn from, and averages over a handful of placements
    // would be noise presented as insight.
    minimumUseful: 20,
    ready: recorded >= 20,
    claim: recorded >= 20
      ? 'Enough outcomes recorded to check whether the assessment predicted anything.'
      : `${recorded} outcomes recorded. Covenda cannot yet claim these assessments predict time to productivity, and does not.`,
  };
}
