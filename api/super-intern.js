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

// ── AI: verification, not leverage ────────────────────────────────────────────────────
// The first version of this module ranked students on "AI leverage". The evidence says that
// is the wrong axis.
//
// Brynjolfsson, Li & Raymond (QJE 2025) measured AI assistance across 5,172 support agents:
// gains concentrated among the LEAST experienced, and were close to flat for the most skilled.
// AI compresses the productivity distribution within a role. Ranking on "uses AI well" would
// therefore rank students on the trait AI is actively making least discriminating, and would
// get less discriminating every year.
//
// What stays scarce is the other half. DORA 2025 found time saved generating code is
// re-allocated to auditing it, with delivery throughput AND instability both rising; GitClear
// measured code churn roughly doubling, from ~3.3% to 5.7-7.1%. The bottleneck moved from
// producing output to deciding whether output can be trusted.
//
// So this measures error detection under AI assistance, not fluency with the tools.
export const AI_BANDS = [
  {
    id: 'unverified', label: 'Did not verify',
    looksLike: 'Accepted the output. Did not notice the planted defect, or noticed and did not act.',
    reads: 'Every piece of their work needs full senior review, because nobody knows what was checked.',
  },
  {
    id: 'spotted', label: 'Caught it',
    looksLike: 'Found the defect and could say what was wrong with it.',
    reads: 'Reads output critically rather than accepting it. The floor for working unsupervised.',
  },
  {
    id: 'traced', label: 'Caught it and found why',
    looksLike: 'Found the defect, reproduced it, traced it to its cause, and said what else it implicates.',
    reads: 'The scarce half. Where the work is going, this is the part that does not commoditise.',
  },
];

// The Verification Test. A planted, plausible defect in AI-generated work, per vertical. The
// question is not whether a student can get a model to produce an answer; almost everyone can.
// It is whether they can decide the answer deserves to be trusted.
export const VERIFICATION_DEFECTS = {
  'software-ai': 'Generated code that passes the happy path and mishandles an edge case the test suite does not cover.',
  'accounting-finance': 'A generated valuation whose arithmetic is right and whose driver assumption is not.',
  'healthcare-operations': 'A generated research summary that states a real finding and misreports its population.',
  'consumer-retail': 'A generated market analysis drawing a causal claim from correlational data.',
  'professional-services': 'A generated landscape whose sources are real and whose inference from them does not follow.',
};

export function verificationTest(verticalSlug) {
  const defect = VERIFICATION_DEFECTS[verticalSlug];
  if (!defect) return null;
  return {
    dimensions: ['discernment', 'capability'],
    minutes: 20,
    // Told plainly. A student who suspects a trap performs differently from one who is working,
    // and the framing has to produce the second.
    framing: 'This was produced with AI assistance. Treat it the way you would treat a colleague\'s '
      + 'draft you are about to put your name on.',
    material: defect,
    bands: AI_BANDS,
    probes: AI_OWNERSHIP_PROBES,
  };
}

export const AI_OWNERSHIP_PROBES = [
  'Which part of this is wrong, and how did you notice?',
  'How would you check the parts you have not challenged?',
  'What did you verify yourself, and what are you taking on trust?',
  'What breaks first if this ships as written?',
];

export function aiBand(id) {
  return AI_BANDS.find(b => b.id === id) || null;
}

// ── The company side: what onboarding actually costs ──────────────────────────────────
// A company describes its constraint, and the assessment is built to close the expensive gaps
// rather than to test everything equally.
export const AUTONOMY_LEVELS = ['guided', 'semi_autonomous', 'autonomous', 'high_agency'];

// The hard ceiling on the pre-trial battery. Not a target, a limit: past roughly this point
// completion collapses and the assessment starts selecting for availability.
export const BUDGET_MINUTES = 90;

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

  // Everything below is built against a hard time budget, and that is the point.
  //
  // Completion rates fall off a cliff with length: short screens under an hour complete at
  // 80-95%, one-to-two hours at 55-75%, three or more frequently below 50%. Past that you are
  // measuring free time and desperation rather than capability, and the student this product
  // is built for, the one already doing a lot, is exactly the one who drops.
  //
  // There is also a ceiling argument. The best-validated single predictor in the literature
  // sits near .42, roughly 18% of variance. No battery assesses its way to certainty, so
  // stacking stages buys very little and costs the candidates you most want.
  //
  // The trial does the real predicting. This only decides who is worth a trial.
  const candidates = [
    { id: 'objective', label: 'Objective questions', minutes: 25, why: 'A measurable floor on what they already know.' },
    { id: 'verification', label: 'Verification test', minutes: 20, why: 'Whether they can tell trustworthy output from plausible output.' },
    { id: 'deep_dive', label: 'Deep Dive', minutes: 12, why: 'Whether they can learn something hard and explain it.' },
    { id: 'blocker', label: 'Blocker account', minutes: 15, why: 'What they do when the obvious path closes.', needs: 'agency' },
    { id: 'system_design', label: 'System design', minutes: 25, why: 'Whether they can find the seams in a problem.' },
    { id: 'take_home', label: 'Ambiguous take-home', minutes: 45, why: 'What they do when one requirement admits two readings.', needs: 'agency' },
    { id: 'live_debug', label: 'Live debugging', minutes: 45, why: 'The shape of the search when the answer is not obvious.', needs: 'capability' },
    { id: 'figure_it_out', label: 'Figure It Out', minutes: 45, why: 'Finding and validating an answer nobody gave them.', needs: 'resourcefulness' },
    { id: 'simulation', label: 'Scenario sitting', minutes: 35, why: 'Decisions under incomplete information, with the trade named.' },
  ];

  // Costs the student nothing: the artifacts already exist and the reach is derived from them.
  // Always read, never budgeted.
  const asynchronous = [
    { id: 'unprompted', label: 'Unprompted build review', why: 'What they made that nobody asked for.' },
    { id: 'cross_functional', label: 'Cross-functional reach', why: 'Whether they contribute either side of their own discipline.' },
  ];

  // The defence is mandatory and appended last, so its cost is reserved BEFORE anything else
  // is admitted. Adding it afterwards let the battery finish at 92 minutes against a 90 minute
  // cap, which is the whole point of having a cap.
  const DEFENCE_MINUTES = 10;
  const spendable = BUDGET_MINUTES - DEFENCE_MINUTES;

  const components = [];
  let minutes = 0;
  const deferred = [];
  const notRelevant = [];
  for (const c of candidates) {
    // Skipped because this environment does not call for it, which is different from skipped
    // for time. Both are reported: a component that disappears with no trace is a silent cap,
    // and nobody can audit an assessment they cannot see the shape of.
    if (c.needs && !focus.includes(c.needs)) { notRelevant.push({ id: c.id, label: c.label, because: c.needs }); continue; }
    // Objective and verification are never dropped: one sets the floor, the other measures the
    // half of AI-era work that has not commoditised.
    const required = ['objective', 'verification'].includes(c.id);
    if (!required && minutes + c.minutes > spendable) { deferred.push(c); continue; }
    components.push({ id: c.id, label: c.label, minutes: c.minutes, why: c.why });
    minutes += c.minutes;
  }
  components.push({ id: 'defense', label: 'Defence', minutes: DEFENCE_MINUTES, why: 'The only part no artifact and no score can stand in for.' });
  minutes += DEFENCE_MINUTES;

  return {
    version: SUPER_INTERN_VERSION,
    vertical,
    autonomy: level,
    focus,
    components,
    minutes,
    budgetMinutes: BUDGET_MINUTES,
    // Named rather than silently dropped. What did not fit belongs in the paid trial, which is
    // where deeper validation should happen anyway.
    deferredToTrial: deferred.map(c => ({ id: c.id, label: c.label, why: c.why })),
    // Not run because this role does not weight that dimension. Named so a company can see
    // what its own stated constraints excluded, and argue with it.
    notRelevant,
    asynchronous,
    deepDive: deepDiveFor(vertical),
    verification: verificationTest(vertical),
    design: systemDesign(vertical),
    // Named so a company sees which of its own constraints shaped the assessment.
    because: [
      `Autonomy expected: ${level.replace(/_/g, ' ')}.`,
      scarceSeniorTime
        ? `Around ${seniorHoursPerWeek} senior hours a week, so self-direction is a requirement rather than a preference.`
        : seniorHoursPerWeek !== null ? `Around ${seniorHoursPerWeek} senior hours a week available.` : null,
      domainKnowledge ? 'Domain knowledge has to be learned on the job, so learning velocity is weighted.' : null,
      (onboardingBurden || []).length ? `Most expensive to teach: ${onboardingBurden.join(', ')}.` : null,
      deferred.length ? `Held back to the paid trial to stay inside ${BUDGET_MINUTES} minutes: ${deferred.map(c => c.label).join(', ')}.` : null,
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

// ── The regulatory perimeter ──────────────────────────────────────────────────────────
// The moment Covenda scores or ranks a student in a way that materially assists a hiring
// decision, it is an Automated Employment Decision Tool, and several regimes apply at once:
// NYC Local Law 144 (independent bias audit within the prior year, public summary, at least
// 10 business days' candidate notice, $500-$1,500 per violation with each day separate),
// Illinois HB 3773, the Colorado AI Act, California's ADS regulations, and the EU AI Act's
// high-risk HR obligations from August 2026. There is no headcount exemption and no
// self-certification: the audit has to be independent.
//
// This is cheap to design for now and expensive to retrofit, which is the only reason it is
// here before a single placement exists.
export const AEDT_VERSION = 'aedt-1.0.0';

// Whether what Covenda produces is inside the perimeter at all. The distinction that matters
// is not "do we use AI", it is "does a number we produce order candidates for a human".
export function aedtPosture({ producesRanking = false, producesScore = false, humanDecides = true } = {}) {
  const inScope = Boolean(producesRanking || producesScore);
  return {
    version: AEDT_VERSION,
    inScope,
    // Covenda's architecture is deliberately outside it: dimensions are reported separately and
    // never summed, and no ordering is emitted. That is a compliance position as well as a
    // product one, and it only holds while both remain true.
    why: inScope
      ? 'A score or ranking that materially assists a hiring decision is an AEDT wherever these rules apply.'
      : 'Separate named dimensions with no composite and no ordering do not substitute for the human decision.',
    obligationsIfInScope: [
      'Independent bias audit within the prior year, by a third party.',
      'Public summary of the audit results.',
      'At least 10 business days notice to candidates before use.',
      'Documented methodology a candidate can challenge.',
    ],
    humanDecides,
  };
}

// Signals that can act as a proxy for a protected characteristic. Referral networks and club
// affiliation are the sharpest case: they are Covenda's differentiation AND, if the network is
// anchored in a narrow set of institutions, an adverse-impact exposure sitting directly on top
// of it. Naming them is the first step to designing around them.
export const PROXY_RISK_SIGNALS = [
  { id: 'school', signal: 'School name', proxyFor: 'race, national origin, socioeconomic background' },
  { id: 'referral_network', signal: 'Who referred them', proxyFor: 'the demographics of whoever Covenda already knows' },
  { id: 'club', signal: 'Club or society affiliation', proxyFor: 'institution, and therefore the same characteristics as school' },
  { id: 'location', signal: 'Postcode or region', proxyFor: 'race and national origin' },
  { id: 'unpaid_work', signal: 'Unpaid projects and long take-homes', proxyFor: 'socioeconomic background, via who can afford the time' },
];

// A running check on whether the qualification process is leaning on proxies. Returns what to
// look at, not a verdict: adverse impact is measured against outcomes, and there are none yet.
export function proxyAudit({ signalsUsed = [], batteryMinutes = 0 } = {}) {
  const flagged = PROXY_RISK_SIGNALS.filter(p => signalsUsed.includes(p.id));
  // The time budget is itself a proxy risk, which is the part that is easy to miss.
  if (batteryMinutes > BUDGET_MINUTES) {
    flagged.push({ ...PROXY_RISK_SIGNALS.find(p => p.id === 'unpaid_work'), note: `${batteryMinutes} minutes is past the ${BUDGET_MINUTES} minute limit.` });
  }
  return {
    version: AEDT_VERSION,
    flagged,
    clean: flagged.length === 0,
    // Deliberately not a pass or fail. Adverse impact is an outcome measurement and Covenda has
    // no outcomes; claiming a clean bill of health from a structural check would be the exact
    // overclaim this product exists to refuse.
    note: flagged.length
      ? 'These signals can stand in for a protected characteristic. Track outcomes by group before relying on any of them.'
      : 'No flagged proxies in use. This is a structural check, not an adverse-impact finding, which needs outcome data.',
  };
}

// What a student is owed about a decision that involved them. Explainability is a regulatory
// obligation and it is also the product: a student who cannot see why is back in the black box
// the whole thing exists to replace.
export function candidateDisclosure(plan = {}) {
  return {
    assessed: (plan.components || []).map(c => ({ component: c.label, minutes: c.minutes, measures: c.why })),
    dimensions: (plan.focus || []).map(id => DIMENSIONS[id]).filter(Boolean)
      .map(d => ({ dimension: d.label, reads: d.reads })),
    shapedBy: plan.because || [],
    notUsed: ['No composite score.', 'No ranking against other students.', 'No automated rejection.'],
    rights: [
      'You can see every component you were assessed on and what it measured.',
      'A human makes the decision, and you can ask them to explain it.',
      'You can correct anything factually wrong in your profile.',
    ],
  };
}

// ── The Ambiguous Take-Home ───────────────────────────────────────────────────────────
// A small, tightly scoped assignment with exactly ONE requirement left deliberately unclear.
//
// The ambiguity is the assessment. A student who freezes, or who asks for every detail before
// starting, will do the same thing on day four of a real job while a senior waits. A student
// who picks a reading, writes down why, and delivers has done the thing the job actually asks
// for. Both are visible in an hour; neither is visible on a résumé.
//
// One ambiguity, not several. Two or more stops reading as a real brief and starts reading as
// a trick, and a student who suspects a trick behaves differently from one who is working.
export const TAKE_HOME_RESPONSES = [
  {
    id: 'froze', label: 'Stalled',
    looksLike: 'Did not start, or delivered only the unambiguous part.',
    reads: 'Needs the specification to be complete before work begins. Expensive on a team that writes rough briefs.',
  },
  {
    id: 'asked_all', label: 'Asked for everything',
    looksLike: 'Sent a list of clarifying questions and waited for answers before starting.',
    reads: 'Careful, and it makes a senior the unblocking service for every unclear line.',
  },
  {
    id: 'asked_and_moved', label: 'Asked, and started anyway',
    looksLike: 'Raised the ambiguity, took a reading, and kept working while waiting.',
    reads: 'The behaviour most teams actually want. Nothing is hidden and nothing is stalled.',
  },
  {
    id: 'assumed_documented', label: 'Chose, and wrote down why',
    looksLike: 'Picked a reading, stated it in the deliverable, and said what would change if the other reading was intended.',
    reads: 'Decided under uncertainty and left an audit trail. Costs a senior almost nothing to check.',
  },
];

// An undocumented guess is not the top band. It reads identically to a misunderstanding, and
// the reviewer cannot tell which it was.
export const TAKE_HOME_FAILS = [
  'Chose a reading and never mentioned there was a choice.',
  'Delivered something that answers neither reading cleanly.',
  'Asked about the parts that were clear and not about the part that was not.',
];

export function ambiguousTakeHome({ vertical = 'this field', brief = null, ambiguity = null } = {}) {
  return {
    dimensions: ['agency', 'communication', 'discernment'],
    minutes: 45,
    brief: brief || `A small, self-contained piece of ${vertical} work.`,
    // Never disclosed to the student. Saying "one requirement is ambiguous" converts the
    // assessment into a hunt for the ambiguity, which is a different and less useful test.
    plantedAmbiguity: ambiguity || 'Exactly one requirement admits two reasonable readings.',
    framing: 'Deliver what you would actually send. If anything is unclear, handle it the way you would handle it at work.',
    lookFor: TAKE_HOME_RESPONSES,
    fails: TAKE_HOME_FAILS,
    probe: 'Which part was unclear, and how did you decide what to do about it?',
  };
}

// ── The Unprompted Build ──────────────────────────────────────────────────────────────
// The strongest single signal in the whole framework, and the cheapest to collect: what has
// this person made that nobody asked for.
//
// It is empirically-keyed biodata, which the 2022 re-analysis of selection validity puts among
// the highest-validity job-specific predictors. It is also the one thing a course transcript
// structurally cannot contain.
//
// Reviewed rather than assessed: the evidence already exists, so this is a protocol for
// reading it, not another hour of a student's time.
export const UNPROMPTED_TIERS = [
  {
    id: 'none', label: 'Nothing unprompted',
    looksLike: 'Everything on the profile was assigned, graded, or paid for.',
    reads: 'Says nothing bad about the person. It says this signal is simply absent, and something else has to carry the read.',
  },
  {
    id: 'started', label: 'Started something',
    looksLike: 'Began a project nobody set, and it stopped where the interesting part ended.',
    reads: 'Initiative without follow-through. Common, and the gap between this and the next tier is most of the signal.',
  },
  {
    id: 'finished', label: 'Finished it',
    looksLike: 'Carried an unassigned project to something that runs.',
    reads: 'Chose a problem and closed it, including the unglamorous last twenty percent.',
  },
  {
    id: 'used', label: 'Someone else used it',
    looksLike: 'Other people depend on it, and it changed after they did.',
    reads: 'Survived contact with users. The strongest version, because the feedback loop was real.',
  },
];

export function unpromptedBuild(entries = []) {
  const rows = (entries || []).filter(e => e && !e.assigned);
  const tier = !rows.length ? 'none'
    : rows.some(e => e.usersReported || e.changedAfterFeedback) ? 'used'
    : rows.some(e => e.deploymentUrl || e.finished) ? 'finished'
    : 'started';
  return {
    dimension: 'agency',
    // Asynchronous: nothing here costs the student time, because the artifacts already exist.
    minutes: 0,
    tier,
    band: UNPROMPTED_TIERS.find(t => t.id === tier),
    count: rows.length,
    // Repetition is a different claim from magnitude, and the more useful one.
    repeated: rows.length >= 2,
    ask: 'What have you built that nobody told you to build?',
    probes: [
      'Why that problem, out of everything you could have worked on?',
      'What did you have to finish that you did not enjoy?',
      'What would you do differently if you started it again now?',
    ],
    ladder: UNPROMPTED_TIERS,
  };
}

// ── Live Debugging ────────────────────────────────────────────────────────────────────
// A small codebase, a failing test, a subtle bug, and deliberately incomplete documentation.
//
// Whether they fix it is the least interesting output. What is being read is the shape of the
// search: a hypothesis that gets tested and discarded is worth more than a lucky fix, because
// the job is mostly the former.
export const DEBUG_BEHAVIOURS = [
  { id: 'shotgun', label: 'Changed things to see what happened', reads: 'No model of the system. Every fix is a coincidence and none of them generalise.' },
  { id: 'traced', label: 'Followed the data to where it went wrong', reads: 'Builds a model before touching anything. Slower to the first change, faster to the right one.' },
  { id: 'hypothesised', label: 'Formed a hypothesis and tested it', reads: 'Treats the bug as a question with an answer. Discarding a wrong hypothesis quickly is the signal.' },
  { id: 'narrowed', label: 'Cut the search space deliberately', reads: 'Halved the problem rather than reading all of it. The habit that scales to codebases nobody can hold in their head.' },
];

export const DEBUG_READS = [
  { signal: 'Reproduced it before changing anything', means: 'Knows a bug you cannot reproduce is a bug you cannot verify you fixed.' },
  { signal: 'Read the failing test before the source', means: 'Started from what is actually asserted rather than from what the code appears to do.' },
  { signal: 'Said what they expected before running it', means: 'Was testing a belief. Someone who cannot say what they expect is not running an experiment.' },
  { signal: 'Checked the fix did not break something else', means: 'Understands that a passing test is not the same as a correct change.' },
  { signal: 'Said out loud what they had ruled out', means: 'Communication under uncertainty, which is what a senior needs to help without starting over.' },
];

export function liveDebugging({ vertical = 'software-ai', minutes = 45 } = {}) {
  return {
    dimensions: ['capability', 'discernment', 'communication'],
    minutes,
    vertical,
    setup: 'A small codebase, one failing test, a bug that is not where the failure appears, and documentation that does not cover it.',
    framing: 'Think out loud. We are reading how you narrow it down, not whether you finish.',
    // Stated because it changes behaviour: a student who believes only the fix counts will stop
    // narrating, and the narration is the assessment.
    notScoredOn: 'Whether the bug is fixed inside the time.',
    behaviours: DEBUG_BEHAVIOURS,
    lookFor: DEBUG_READS,
    probes: [
      'What did you rule out, and what ruled it out?',
      'What would you have checked next?',
      'How would you stop this class of bug reaching production again?',
    ],
  };
}

// ── System Design, scaled down ────────────────────────────────────────────────────────
// Not distributed systems trivia. Whether they can take something they already understand and
// separate it into parts that do not bleed into each other.
//
// A student who has never run anything at scale cannot reason about sharding, and asking them
// to is a test of whether they have read the right blog posts. Whether orders belong to users
// and payments belong to orders is answerable from first principles, and it is the actual
// skill.
export const DESIGN_PROMPTS = {
  'software-ai': 'Design the data model and endpoints for campus food delivery. Users, restaurants, orders, payments, delivery.',
  'accounting-finance': 'Design the structure of a model that tracks one portfolio across positions, transactions, valuations and reporting periods.',
  'healthcare-operations': 'Design how a clinic tracks a patient visit from referral through appointment, encounter, coding and billing. Synthetic only.',
  'consumer-retail': 'Design how a retailer tracks one product from supplier through inventory, store allocation, sale and return.',
  'professional-services': 'Design how a firm tracks an engagement from scope through workstreams, deliverables, review and invoicing.',
};

export const DESIGN_READS = [
  { signal: 'Separated the entities cleanly', means: 'Can find the seams in a problem. The whole skill at this level.' },
  { signal: 'Noticed a relationship that is not one-to-one', means: 'Read the domain rather than the nouns in the prompt.' },
  { signal: 'Said what they were deliberately leaving out', means: 'Scoping. Distinguishes a simplification from an oversight.' },
  { signal: 'Named a trade rather than reaching for a pattern', means: 'Reasoning from the problem, not from vocabulary.' },
];

export function systemDesign(verticalSlug = 'software-ai') {
  const prompt = DESIGN_PROMPTS[verticalSlug];
  if (!prompt) return null;
  return {
    dimensions: ['capability', 'communication'],
    minutes: 25,
    prompt,
    framing: 'Whiteboard level. We are reading whether the pieces are separated sensibly, not whether you know the vocabulary.',
    notScoredOn: 'Terminology, scale, or anything you would only know from having run it in production.',
    lookFor: DESIGN_READS,
    probes: [
      'What did you leave out, and why was that safe?',
      'What breaks first if this gets ten times bigger?',
      'Which of these would you build last?',
    ],
  };
}

// ── Cross-functionality ───────────────────────────────────────────────────────────────
// On a five-person team, the boundary of a title is a formality. What matters is whether
// somebody can contribute one step either side of their own discipline.
//
// Measured as reach, not as breadth-for-its-own-sake. A strong specialist who can talk to the
// next function is worth more than a generalist who is weak everywhere, and this must not
// reward the second.
export const FUNCTIONS = ['engineering', 'product', 'research', 'analysis', 'operations', 'communication', 'commercial'];

export function crossFunctional({ primary = null, evidenceByFunction = {} } = {}) {
  const held = FUNCTIONS.filter(f => (evidenceByFunction[f] || []).length > 0);
  const secondary = held.filter(f => f !== primary);
  return {
    dimension: 'capability',
    minutes: 0,
    primary,
    secondary,
    reach: secondary.length,
    // Stated so the number is never read as "more is better". Depth first, then reach.
    note: !primary
      ? 'No primary function established yet, so reach cannot be read: breadth without a strong centre is not the signal.'
      : secondary.length === 0
        ? `Evidence sits entirely in ${primary}. That is a specialist profile, which is the right answer for some teams.`
        : `Primary in ${primary}, with evidence reaching ${secondary.join(' and ')}.`,
    ask: 'Tell us about something you worked on that was outside what you would call your main skill.',
    probe: 'What did you get wrong because it was outside your area, and how did you find out?',
  };
}

// ── The company reverse audit ─────────────────────────────────────────────────────────
// The intake question that changes everything. Companies asked "what skills do you want" answer
// with a wish list; the assessment built from it tests everything equally and discriminates on
// nothing.
//
// Asked instead: what does a student actually have to do here, what will you teach, and what
// will you not. The gap between those is the assessment.
export const REVERSE_AUDIT_QUESTIONS = [
  { id: 'day_one', ask: 'What must this person already know on day one?', builds: 'The objective floor.' },
  { id: 'two_weeks', ask: 'What could they pick up in a fortnight?', builds: 'Nothing. This is the part not worth testing.' },
  { id: 'months', ask: 'What takes months, and who teaches it?', builds: 'Learning velocity, and the Deep Dive topic.' },
  { id: 'blocked', ask: 'Where do juniors get stuck here?', builds: 'The blocker scenario and the debugging setup.' },
  { id: 'senior_time', ask: 'What consumes the most senior time?', builds: 'Which dimensions the plan weights.' },
  { id: 'costly_mistakes', ask: 'Which mistakes are expensive rather than annoying?', builds: 'The verification test.' },
  { id: 'first_month', ask: 'What does a good first month look like?', builds: 'What the trial is measured against.' },
  { id: 'automatable', ask: 'Which of this work can AI already do?', builds: 'What NOT to assess, because it is no longer the scarce part.' },
];

// The most valuable answer is `two_weeks`, and it is the one nobody volunteers. Anything a
// company will happily teach in a fortnight should not be tested at all: testing it costs a
// student time and screens on something the job does not actually require.
export function reverseAudit(answers = {}) {
  const answered = REVERSE_AUDIT_QUESTIONS.filter(q => String(answers[q.id] || '').trim().length > 3);
  const missing = REVERSE_AUDIT_QUESTIONS.filter(q => !answered.includes(q));
  const doNotTest = String(answers.two_weeks || '').trim();
  const automatable = String(answers.automatable || '').trim();
  return {
    version: SUPER_INTERN_VERSION,
    answered: answered.map(q => q.id),
    missing: missing.map(q => ({ id: q.id, ask: q.ask, builds: q.builds })),
    complete: missing.length === 0,
    // Surfaced back to the company, because both are counter-intuitive and both shrink the
    // assessment rather than growing it.
    excludeFromAssessment: [
      doNotTest ? `Learnable in a fortnight, so not worth a student's time: ${doNotTest}` : null,
      automatable ? `Already automatable, so no longer the scarce part: ${automatable}` : null,
    ].filter(Boolean),
    note: missing.length
      ? `${missing.length} of ${REVERSE_AUDIT_QUESTIONS.length} unanswered. The assessment will be generic in proportion to what is missing.`
      : 'Enough to build an assessment that reflects this environment rather than the vertical average.',
  };
}
