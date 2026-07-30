// The supplied assessment, for every vertical.
//
// Same framework as finance — Covenda provides the work, the concepts are multiple choice,
// there is a reasoning problem, and the recording is the artifact — but the MEDIUM changes,
// because the medium is the skill.
//
//   Software & AI          → code. A repository and a failing test, not a spreadsheet.
//   Accounting & finance   → a workbook. Already built in api/finance-assessment.js.
//   Professional services  → a structured case, spoken.
//   Consumer & retail      → a dataset and a decision.
//   Healthcare operations  → a synthetic process, never real data.
//
// Getting this wrong in the obvious direction — one shared exercise with the vertical swapped
// into the wording — would test whether someone can read, not whether they can do the work.
//
// Pure module. Finance lives separately because it was built first and its Excel-specific
// detail does not generalise; `assessmentFor` here routes to it.

import { assessmentFor as financeAssessment } from './finance-assessment.js';

import { questionsFor } from './question-bank.js';

export const ASSESSMENTS_VERSION = 'assessments-1.0.0';

// ── Software & AI ─────────────────────────────────────────────────────────────────────
// Code-centric throughout. The supplied artifact is a repository with something wrong in it,
// because reading unfamiliar code and finding the fault is most of the job and almost none
// of a portfolio.
export const SOFTWARE = {
  vertical: 'Software & AI',
  medium: 'code',
  exercises: {
    'ai-ml': {
      title: 'Find the leak',
      minutes: 30,
      supplied: 'A small training script and evaluation harness that reports 98% accuracy. The split leaks: a feature derived from the label survives into the training set.',
      task: 'Find why the number is wrong, fix it, and report the honest figure.',
      watchFor: [
        'Do they distrust the 98% before being told to',
        'Do they inspect the split or only the model',
        'Do they re-run after fixing, or assert the fix worked',
        'Do they say what the honest number now means',
      ],
    },
    'physical-ai': {
      title: 'Simulation lies',
      minutes: 30,
      supplied: 'A controller that holds setpoint in simulation and oscillates on the supplied recorded hardware trace.',
      task: 'Explain why it diverges and what you would change.',
      watchFor: [
        'Do they look at timing and latency, or only at gains',
        'Do they reason about what the sim does not model',
        'Do they propose an instrument rather than only a fix',
      ],
    },
    'infrastructure-data': {
      title: 'Silent row loss',
      minutes: 25,
      supplied: 'A pipeline that runs clean and drops about 3% of rows at a join. No error is raised.',
      task: 'Find where the rows go and add the check that would have caught it.',
      watchFor: [
        'Do they count at each stage or read the code hoping to spot it',
        'Do they find the join type as the cause',
        'Is the check they add one that would actually have fired',
      ],
    },
    'product-engineering': {
      title: 'Change code you did not write',
      minutes: 30,
      supplied: 'An unfamiliar codebase, one failing test, and a small feature request that touches three files.',
      task: 'Make the test pass and add the feature without breaking anything else.',
      watchFor: [
        'How they orient — tests first, entry point, or straight to the failure',
        'Do they run the suite before and after',
        'Do they follow the existing conventions or impose their own',
      ],
    },
    'security-reliability': {
      title: 'Break it, then say what else is exposed',
      minutes: 30,
      supplied: 'A small service with one deliberate authorisation flaw and one lower-severity information leak.',
      task: 'Find what you can, rank by severity, and say what your fix does not cover.',
      watchFor: [
        'Do they find the authorisation bug or stop at the leak',
        'Do they rank by impact or by ease of finding',
        'Do they reason about the class of bug rather than the instance',
      ],
    },
  },
  // Concepts where a written answer would add nothing.
  concepts: [
    { q: 'A test passes locally and fails in CI. The most common cause is:',
      options: ['A compiler difference', 'Undeclared dependence on local state or ordering', 'CI being slower', 'A flaky assertion library'],
      answer: 1,
      why: 'Hidden state — env vars, file paths, test ordering. Blaming CI speed is the instinct that stops people looking.' },
    { q: 'You add an index and the query gets slower. Most likely:',
      options: ['The index is corrupt', 'The planner now chooses a worse path', 'Indexes always slow writes', 'The table is too small to matter'],
      answer: 1,
      why: 'An index changes the planner\'s options, not just its speed. "Indexes are always faster" is the misconception being read here.' },
    { q: 'Your model scores 0.99 AUC on a holdout. The first thing to check:',
      options: ['Whether the model is too large', 'Whether the split leaks', 'Whether to try a better architecture', 'Whether to deploy'],
      answer: 1,
      why: 'A number that good is usually a bug. A candidate whose first instinct is to celebrate has not been burned yet.' },
  ],
  // Reasoning under an unfamiliar constraint, code-flavoured rather than a riddle.
  reasoning: [
    { id: 'rate-limit',
      q: 'A service must allow 100 requests per minute per user. Describe an approach that does not require storing every request timestamp.',
      reveals: 'Whether they reach for a counter with a window, and whether they notice the burst problem at a window boundary.',
      weak: 'Stores all timestamps and filters. Correct and does not scale, and they do not notice.',
      strong: 'Sliding window or token bucket, and names the boundary-burst tradeoff without prompting.' },
    { id: 'dedupe',
      q: 'You receive a stream of events and must ignore duplicates, but you cannot keep every ID you have seen. What do you do?',
      reveals: 'Comfort with accepting a bounded error rate rather than insisting on exactness.',
      weak: 'Insists on a perfect set and runs out of memory.',
      strong: 'Bounded structure with a stated false-positive rate, and says which direction the error runs.' },
  ],
};

// ── Professional services ─────────────────────────────────────────────────────────────
// Spoken and structured. The medium is the reasoning itself, so there is no artifact to hand
// over — the recording IS the submission.
export const PROFESSIONAL = {
  vertical: 'Professional services',
  medium: 'spoken case',
  exercises: {
    'management-consulting': {
      title: 'A live structured case',
      minutes: 30,
      supplied: 'A prompt from the published bank, and a fact mid-case that contradicts whatever hypothesis you formed.',
      task: 'Structure it, state a hypothesis, and update when the contradicting fact lands.',
      watchFor: [
        'Is the structure MECE or a list',
        'Do they state a hypothesis before analysing',
        'What happens at the contradiction — update or defend',
        'Do they sanity-check their own arithmetic',
      ],
    },
    'strategy-research': {
      title: 'Frame, then answer',
      minutes: 25,
      supplied: 'A vague question and a small set of sources, two of which conflict.',
      task: 'Sharpen the question, answer it, and say what the conflict means.',
      watchFor: ['Do they reframe before answering', 'Do they notice the conflict', 'Do they state what they could not resolve'],
    },
    'market-intelligence': {
      title: 'Size it and say how wrong you might be',
      minutes: 25,
      supplied: 'A market to size, with deliberately incomplete public data.',
      task: 'Produce an estimate with a stated range and the assumption doing the most work.',
      watchFor: ['Is the approach top-down, bottom-up, or both', 'Do they state confidence per assumption'],
    },
    'legal-operations': {
      title: 'Design the intake',
      minutes: 25,
      supplied: 'A messy contract-request process with three named failure points.',
      task: 'Redesign it, including where it escalates to a lawyer.',
      watchFor: ['Is there an exception path', 'Do they know where their competence ends'],
    },
    'technical-writing': {
      title: 'Document what you just learned',
      minutes: 30,
      supplied: 'An unfamiliar small API and its source.',
      task: 'Write the getting-started page, then say what confused you first.',
      watchFor: ['Is it ordered by the reader\'s task or the source\'s structure', 'Do they name their own confusion honestly'],
    },
    'content-production': {
      title: 'Cut it to half the words',
      minutes: 30,
      supplied: 'A 900-word draft with one unsourced statistic in it.',
      task: 'Publish a 450-word version, and list what you removed and why.',
      watchFor: ['Do they find the unsourced figure without being told to look', 'Is what they cut the weakest material or just the last paragraphs'],
    },
    'creator-marketing': {
      title: 'Brief one creator, reject three',
      minutes: 30,
      supplied: 'Four creator profiles with audience data, and one product page.',
      task: 'Write the brief for the one you would fund, and one sentence on why each of the other three is out.',
      watchFor: ['Is the rejection reasoned or just ranked by follower count', 'Does the brief set a boundary without dictating the content'],
    },
  },
  concepts: [
    { q: 'Traffic is up 30%, revenue is flat. The first thing to check:',
      options: ['Increase ad spend', 'Conversion by segment', 'Pricing', 'Competitor activity'],
      answer: 1,
      why: 'The classic misdiagnosis. Traffic up and revenue flat is a conversion or mix question before it is a marketing one.' },
    { q: 'Which decomposition is MECE?',
      options: ['New vs returning vs mobile customers', 'New vs returning customers', 'Online vs promotional vs wholesale', 'Cheap vs premium vs seasonal'],
      answer: 1,
      why: 'The others overlap — mobile customers are also new or returning. Overlap is the commonest structuring error.' },
  ],
  reasoning: [
    { id: 'estimate',
      q: 'How many piano tuners work in Chicago? Reason it out loud.',
      reveals: 'Whether they decompose and sanity-check, or reach for a remembered number.',
      weak: 'Guesses, or recites the famous answer without the reasoning.',
      strong: 'Builds from population, states each assumption, and checks the result for plausibility.' },
  ],
};

// ── Consumer & retail ─────────────────────────────────────────────────────────────────
export const CONSUMER = {
  vertical: 'Consumer & retail',
  medium: 'dataset and a decision',
  exercises: {
    'growth-performance': {
      title: 'Find the drop',
      minutes: 30,
      supplied: 'A synthetic funnel where the obvious drop-off is a red herring and the real loss is a segment effect.',
      task: 'Locate the real problem and recommend one action with a stated confidence.',
      watchFor: ['Do they segment or read the aggregate', 'Do they check the denominator', 'Is the recommendation sized to the finding'],
    },
    'brand-content': {
      title: 'Three directions, one decision',
      minutes: 25,
      supplied: 'A brief, an audience description, and a constraint that rules out the most obvious approach.',
      task: 'Produce three directions, choose one, and say what you gave up.',
      watchFor: ['Are the three genuinely distinct', 'Do they reject one they clearly like, for a stated reason'],
    },
    'merchandising': {
      title: 'Cut one',
      minutes: 25,
      supplied: 'A range with one obvious low performer that is also the entry point to the category.',
      task: 'Decide what to cut and say where that customer goes.',
      watchFor: ['Do they rank on one metric', 'Do they see the range role'],
    },
    'supply-chain': {
      title: 'Forecast, and price being wrong',
      minutes: 25,
      supplied: 'Demand history with a structural break partway through, plus stockout and holding costs.',
      task: 'Forecast, state a range, and say which error is worse here.',
      watchFor: ['Do they notice the break', 'Do they treat the two error directions symmetrically'],
    },
    'ecommerce-marketplace': {
      title: 'Which side is starving',
      minutes: 25,
      supplied: 'A two-sided marketplace dataset where demand looks healthy and match rate is falling.',
      task: 'Say which side is constrained and what you would do.',
      watchFor: ['Do they analyse both sides', 'Do they reach for liquidity rather than volume'],
    },
  },
  concepts: [
    { q: 'Conversion rose after a change, but revenue fell. Most likely:',
      options: ['The tracking broke', 'Mix shifted to cheaper items', 'Seasonality', 'The change failed'],
      answer: 1,
      why: 'A rate improving while the total falls is almost always mix. Concluding "the change failed" ignores that conversion went up.' },
    { q: 'A cohort chart shows retention improving for newer cohorts. This could be caused by:',
      options: ['A better product', 'Newer cohorts having less time to churn', 'Better onboarding', 'All of these'],
      answer: 3,
      why: 'Survivorship in cohort charts is the trap — newer cohorts have not had time to churn yet.' },
  ],
  reasoning: [
    { id: 'ab-stop',
      q: 'An A/B test hits significance on day two. Do you ship it?',
      reveals: 'Whether they know that peeking inflates false positives, and whether they can say so without being dogmatic.',
      weak: 'Ships it — significance is significance.',
      strong: 'Names the peeking problem and asks what the pre-registered sample size was.' },
  ],
};

// ── Healthcare operations ─────────────────────────────────────────────────────────────
// Synthetic only. The PHI gate exists precisely so that no exercise here ever creates a
// reason for a student to touch real data.
export const HEALTHCARE = {
  vertical: 'Healthcare operations',
  medium: 'synthetic process and data',
  exercises: {
    'clinical-operations': {
      title: 'Map the queue',
      minutes: 25,
      supplied: 'A synthetic intake process with a bottleneck that moves when you staff around it.',
      task: 'Map it, find the real constraint, and design the exception path.',
      watchFor: ['Do they map before redesigning', 'Do they notice the bottleneck moves', 'Is there an exception path'],
    },
    'health-analytics': {
      title: 'Define the denominator',
      minutes: 25,
      supplied: 'A synthetic dataset where missingness is not random and the obvious denominator is wrong.',
      task: 'Produce the rate, state the population, and say what the missingness does to it.',
      watchFor: ['Do they define the denominator explicitly', 'Do they ask why data is missing'],
    },
    'revenue-cycle': {
      title: 'Trace the denial',
      minutes: 25,
      supplied: 'Synthetic denials where one reason code hides three different root causes.',
      task: 'Group by cause, and say which ones are not worth fighting.',
      watchFor: ['Do they group by code or by cause', 'Do they consider cost to collect'],
    },
    'regulatory-quality': {
      title: 'Prove it happened',
      minutes: 25,
      supplied: 'A control description with no evidence trail attached.',
      task: 'Say what you would show an auditor, and where the evidence is thin.',
      watchFor: ['Preventive vs detective', 'Do they find the thin spot themselves'],
    },
    'digital-health-product': {
      title: 'Whose workflow pays',
      minutes: 25,
      supplied: 'A product improvement that helps patients and adds two minutes per clinician encounter.',
      task: 'Decide, and say who bears the cost.',
      watchFor: ['Do they separate user from buyer', 'Do they quantify the clinician cost'],
    },
  },
  concepts: [
    { q: 'Which of these still identifies someone under HIPAA Safe Harbor?',
      options: ['Year of birth', 'Admission date', '3-digit ZIP for a large area', 'Age 45'],
      answer: 1,
      why: 'All date elements except year must go. Redacting names and leaving admission dates is the commonest de-identification error.' },
    { q: 'Ages above 89 must be:',
      options: ['Left as-is', 'Rounded to the nearest 5', 'Aggregated into 90+', 'Removed entirely'],
      answer: 2,
      why: 'Small populations at the top of an age distribution are re-identifiable.' },
  ],
  reasoning: [
    { id: 'bottleneck',
      q: 'You add staff to the step with the longest queue and total wait time does not improve. What happened?',
      reveals: 'Whether they think in systems — the constraint moved — rather than in isolated steps.',
      weak: 'Concludes they needed even more staff.',
      strong: 'Recognises the bottleneck relocated, and says where they would look next.' },
  ],
};

const REGISTRY = {
  'Software & AI': SOFTWARE,
  'Professional services': PROFESSIONAL,
  'Consumer & retail': CONSUMER,
  'Healthcare operations': HEALTHCARE,
};

// One entry point. Finance routes to its own module, which is richer because Excel technique
// is specific enough to deserve it.
export function assessmentFor(vertical, slug) {
  if (vertical === 'Accounting & finance') return financeAssessment(slug);
  const v = REGISTRY[vertical];
  if (!v) return null;
  const exercise = v.exercises[slug];
  if (!exercise) return null;
  return {
    version: ASSESSMENTS_VERSION,
    vertical: v.vertical,
    medium: v.medium,
    exercise,
    // The bank, not the two-or-three-question stub this shipped with. Three near-binary
    // signals could not separate a guesser from a competent applicant.
    ...(() => {
      const bank = questionsFor(v.vertical);
      const concepts = bank.concepts.length ? bank.concepts : v.concepts;
      const reasoning = bank.reasoning.length ? bank.reasoning : v.reasoning;
      return { concepts, reasoning, totalMinutes: exercise.minutes + concepts.length * 2 + reasoning.length * 5 };
    })(),
    note: 'Covenda supplies everything here. You are not asked to invent a project.',
  };
}

export function verticals() { return [...Object.keys(REGISTRY), 'Accounting & finance']; }
