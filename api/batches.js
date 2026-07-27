// §13 slice 4 — Batch admission: a PUBLISHED threshold, checked against real evidence.
//
// The Litmus-style property we want is a *known bar*, not a mystery ranking: a student can
// read exactly what a batch requires, see where they currently stand, and go earn the gap.
// So admission is a REQUIREMENTS CHECKLIST, never a weighted person-score — which also keeps
// the guardrail from docs/COMPATIBILITY_ENGINE_MASTER.md intact by construction:
//
//   * per-skill / per-batch evidence only — no global person score, no cross-student ranking
//   * every satisfied requirement carries the evidence pointer that satisfied it
//   * the engine DRAFTS a recommendation; an operator DECIDES with a mandatory rationale
//   * a miss is never a rejection — it returns the specific gap, so the bar is actionable
//   * protected attributes and their proxies (school prestige, name) are not inputs
//
// Every requirement is a serializable descriptor (it lives in batches.admission_requirements
// as jsonb), so the same spec renders as student-facing copy AND runs as the evaluator.
//
// Publish the REQUIREMENTS (students must know what to build toward); never publish the
// scorer's internal weights. Requirements are not weights.

import { CONNECTORS } from './connectors.js';

export const BATCH_ADMISSION_VERSION = 'batch-admission-1.0.0';

// Evidence tiers, weakest → strongest. Mirrors skill_claim.verification_tier.
export const TIER_ORDER = ['claimed', 'artifact', 'referral', 'trial'];
export function tierAtLeast(tier, minimum) {
  const have = TIER_ORDER.indexOf(String(tier));
  const need = TIER_ORDER.indexOf(String(minimum));
  return have >= 0 && need >= 0 && have >= need;
}

// ---------------------------------------------------------------------------
// The vetting matrix — one technical process per industry.
//
// HONESTY RULE (docs/PROOF_CONNECTORS.md): where no API can prove the work, we do NOT invent
// a verification story. We route to the human rail and say so. The human rail is itself a
// real technical process — a dual-rater anchored rubric with adjudication and inter-rater
// reliability (api/hardening.js) — not a vibe check.
// ---------------------------------------------------------------------------
export const VETTING_RAILS = {
  api_forensics: {
    id: 'api_forensics',
    label: 'Ownership + timestamp forensics',
    how: 'You connect the account that owns the work. Covenda reads the platform’s own timeline — not a screenshot — and checks that the history accumulated over months rather than in one session.',
    defeats: 'Screenshotted portfolios and afternoon-generated repos: neither survives an ownership check plus a commit-cadence read.',
  },
  artifact_parse: {
    id: 'artifact_parse',
    label: 'Programmatic artifact parsing',
    how: 'You upload the real file. Covenda parses its structure — formulas, not just displayed values — and scores it against a published rubric.',
    defeats: 'A model of hardcoded numbers: it scores low by construction, because the parser reads the formula layer.',
  },
  instrumented_trial: {
    id: 'instrumented_trial',
    label: 'Instrumented trial',
    how: 'You do a bounded piece of the real work inside Covenda-provisioned tooling, so the outcome is platform-measured rather than self-reported.',
    defeats: 'Claimed results with no audit trail — the tooling records the outcome, not the candidate.',
  },
  rubric_defense: {
    id: 'rubric_defense',
    label: 'Recorded walkthrough + dual-rater rubric',
    how: 'You walk through your own work on camera and answer follow-ups. Two raters score it against anchored exemplars and adjudicate disagreements; inter-rater reliability is tracked.',
    defeats: 'Work you cannot explain. Authorship survives an unscripted walkthrough; borrowed work usually does not.',
  },
  structured_referral: {
    id: 'structured_referral',
    label: 'Structured referral from a named professional',
    how: 'A professor, PI, or manager who supervised you answers narrow, cross-checked questions and attaches their name and role to the answers.',
    defeats: 'Anonymous praise — the referrer’s identity and track record are attached to the claim.',
  },
};

// ── Verticals define HOW proof is taken; batches define WHAT the work is ──────────────
// Vetting is a property of the industry — a robotics team and an ML team both audit code the
// same way — so the rails and the company walkthrough live once per vertical. Specialisation
// then splits each vertical into the batches a company actually hires against: "Software"
// is not a thing anyone recruits for, "ML engineering" is.
export const VERTICALS_BASE = {
  'software-ai': {
    vertical: 'Software & AI',
    vetting: { rails: ['api_forensics', 'rubric_defense'], connectors: ['github'] },
    companyWorkflow: [
      { step: 1, title: 'Open the batch', detail: 'Every admitted student, with their evidence attached — not a ranked leaderboard and not a résumé pile.' },
      { step: 2, title: 'Read the proof, not the pedigree', detail: 'Each skill shows the repo, the commit range, and whether the account was ownership-verified. School and name are not scoring inputs.' },
      { step: 3, title: 'Scope one bounded task', detail: 'Describe the work that keeps slipping. Covenda turns the safe part into a fixed-scope, fixed-price trial.' },
      { step: 4, title: 'See at most three candidates', detail: 'Evidence-cited, each with one honest gap. Fewer than three clear your must-haves and you get fewer — never a padded shortlist.' },
      { step: 5, title: 'Run the trial', detail: 'Milestones with dates. You review at checkpoints; deeper system access is earned, never granted up front.' },
      { step: 6, title: 'Decide with the record', detail: 'Accept and the outcome becomes part of the student’s verified record. Hire, re-hire, or stop — the evidence is yours either way.' },
    ],
  },
  'accounting-finance': {
    vertical: 'Accounting & finance',
    vetting: { rails: ['artifact_parse', 'rubric_defense'], connectors: ['xlsx_model', 'pitch_defense', 'alpaca_track_record'] },
    companyWorkflow: [
      { step: 1, title: 'Open the batch', detail: 'Admitted students, each with a parsed model and a scored defence on file.' },
      { step: 2, title: 'Read the model score', detail: 'What the parser found — formula integrity, structure, and where it was weak. Per skill, never one overall number.' },
      { step: 3, title: 'Scope one bounded task', detail: 'Reconciliations, a model build, diligence support — the safe, self-contained slice.' },
      { step: 4, title: 'See at most three candidates', detail: 'With the specific evidence that fits your task, plus one honest gap each.' },
      { step: 5, title: 'Run the trial', detail: 'No production or client-record access at stage one. Sample or de-identified data until access is earned.' },
      { step: 6, title: 'Decide with the record', detail: 'Acceptance is recorded as employer-verified evidence and compounds on the student’s record.' },
    ],
  },
  'healthcare-operations': {
    vertical: 'Healthcare operations',
    vetting: { rails: ['rubric_defense', 'structured_referral'], connectors: [] },
    companyWorkflow: [
      { step: 1, title: 'Open the batch', detail: 'Each student shows a process artifact, a scored walkthrough, and a named referrer.' },
      { step: 2, title: 'Read the rail honestly', detail: 'Covenda labels this batch expert-vetted. There is no API forensic here and we do not claim one.' },
      { step: 3, title: 'Scope one bounded task', detail: 'Intake mapping, documentation, scheduling analysis — de-identified by default.' },
      { step: 4, title: 'See at most three candidates', detail: 'With the referral and the walkthrough attached.' },
      { step: 5, title: 'Run the trial', detail: 'No PHI, no production systems. The information boundary is set before the student is named.' },
      { step: 6, title: 'Decide with the record', detail: 'Your acceptance is the strongest signal on the platform — a real reviewer confirming real work.' },
    ],
  },
  'consumer-retail': {
    vertical: 'Consumer & retail',
    vetting: { rails: ['instrumented_trial', 'rubric_defense'], connectors: ['sandbox_suite'] },
    companyWorkflow: [
      { step: 1, title: 'Open the batch', detail: 'Students whose numbers came from an instrumented run, not a slide.' },
      { step: 2, title: 'Read the challenge result', detail: 'The exercise, the budget, and what the platform measured.' },
      { step: 3, title: 'Scope one bounded task', detail: 'A test, a teardown, a merchandising analysis — one clear deliverable.' },
      { step: 4, title: 'See at most three candidates', detail: 'Evidence-cited, one honest gap each.' },
      { step: 5, title: 'Run the trial', detail: 'Sandboxed budgets and accounts first; spend authority is earned.' },
      { step: 6, title: 'Decide with the record', detail: 'Accepted work becomes verified evidence on the student’s record.' },
    ],
  },
  'professional-services': {
    vertical: 'Professional services',
    vetting: { rails: ['rubric_defense', 'structured_referral'], connectors: [] },
    companyWorkflow: [
      { step: 1, title: 'Open the batch', detail: 'Every student here has defended their own writing on record.' },
      { step: 2, title: 'Read the defence, not just the document', detail: 'The walkthrough score is the authorship signal. The document alone is not.' },
      { step: 3, title: 'Scope one bounded task', detail: 'A memo, a landscape scan, a documentation set — with a named reviewer.' },
      { step: 4, title: 'See at most three candidates', detail: 'With the sample and the defence attached.' },
      { step: 5, title: 'Run the trial', detail: 'Public or de-identified sources at stage one.' },
      { step: 6, title: 'Decide with the record', detail: 'Acceptance compounds into the student’s verified record.' },
    ],
  },
};

// Shared requirement fragments, so a change to "what an artifact-tier skill means" lands in
// every batch that uses it rather than in fourteen hand-copied strings.
const REQ = {
  ownership: { key: 'ownership', kind: 'ownership_verified', min: 1, label: 'Connect the account that owns your work', detail: 'OAuth, read-only. A pasted link still counts as an artifact, but ownership-verified evidence is what clears this bar.' },
  history: (days = 90) => ({ key: 'history', kind: 'history_span_days', min: days, label: `At least ${days} days of accumulated history`, detail: 'Span, not volume. Work built over a term beats work built over a weekend.' }),
  skills: (n = 2, tier = 'artifact') => ({ key: 'skills', kind: 'skill_claims_at_tier', min: n, tier, label: `${n === 1 ? 'One skill' : `${n} skills`} evidenced by real artifacts`, detail: 'Each skill must point at the specific file, repo or document that justifies it.' }),
  defense: (what = 'your own work') => ({ key: 'defense', kind: 'defense_recorded', min: 1, label: `A recorded walkthrough of ${what}`, detail: 'Five minutes, unscripted follow-ups. This is the authorship check.' }),
  artifact: (n = 1, label = 'One work sample') => ({ key: 'artifact', kind: 'artifact_count', min: n, label, detail: null }),
  referral: { key: 'referral', kind: 'referral_count', min: 1, label: 'One structured referral', detail: 'From a supervisor, PI or professor who saw the work.' },
  trial: { key: 'trial', kind: 'instrumented_trial', min: 1, label: 'One instrumented challenge', detail: 'A bounded exercise with a fixed budget; Covenda records the outcome.' },
  hours: (n = 6) => ({ key: 'availability', kind: 'availability_hours', min: n, label: `${n} or more hours a week`, detail: null }),
};

// Five per vertical, at SECTOR level. The first pass split by skill — "financial modelling",
// "full-stack" — which is how a curriculum thinks, not how a company hires. A fund recruits
// for private equity, not for modelling; a robotics team recruits for physical AI, not for
// "engineering". Sector is also what a club maps onto: a consulting group feeds management
// consulting, a quant society feeds asset management.
const SPECIALISATIONS = [
  // ── Software & AI ───────────────────────────────────────────────────────────────────
  ['software-ai', 'ai-ml', 'AI & machine learning', 'elite', 24, 25,
   'Students who have trained, evaluated and shipped models — with the repo history behind it.',
   'Training runs, evaluation harnesses and inference code, read from the account that owns them so the commit timeline shows how the work accumulated.',
   [REQ.ownership, REQ.history(90), REQ.skills(2), REQ.defense('a model you trained'), REQ.hours(8)]],
  ['software-ai', 'physical-ai', 'Physical AI & robotics', 'elite', 20, 25,
   'Perception, control and hardware-in-the-loop work — where the code has to survive contact with the world.',
   'Robotics and control code with its history, plus a walkthrough of something that worked in simulation and failed on hardware.',
   [REQ.ownership, REQ.history(90), REQ.skills(2), REQ.defense('a system you got working'), REQ.hours(8)]],
  ['software-ai', 'infrastructure-data', 'Infrastructure & data', 'open', 20, 15,
   'Pipelines, warehousing and the unglamorous work everything else depends on.',
   'Pipeline and transformation code with its commit history, plus a walkthrough of a failure you had to trace.',
   [REQ.ownership, REQ.history(60), REQ.skills(2), REQ.defense('a pipeline you built'), REQ.hours(6)]],
  ['software-ai', 'product-engineering', 'Product engineering', 'elite', 24, 25,
   'Undergraduates who ship product and can work in a codebase they did not write.',
   'Application code judged on structure and testing habits rather than line count, with ownership verified through a connected account.',
   [REQ.ownership, REQ.history(90), REQ.skills(2), REQ.defense('a feature you shipped'), REQ.hours(8)]],
  ['software-ai', 'security-reliability', 'Security & reliability', 'open', 18, 15,
   'Students who find what breaks before a customer does.',
   'Test suites, incident write-ups and issue histories, read from the account that owns them.',
   [REQ.ownership, REQ.skills(1), REQ.defense('a bug or incident you traced'), REQ.hours(6)]],

  // ── Accounting & finance ────────────────────────────────────────────────────────────
  ['accounting-finance', 'investment-banking', 'Investment banking', 'elite', 24, 25,
   'Modelling and diligence work, parsed formula-by-formula and defended out loud.',
   'The workbook itself is read — formula integrity and structure against a published rubric. A model of pasted values scores low by construction.',
   [REQ.artifact(1, 'One financial model (.xlsx)'), REQ.skills(2), REQ.defense('your model'), REQ.hours(8)]],
  ['accounting-finance', 'private-equity', 'Private equity', 'elite', 20, 25,
   'LBO mechanics and diligence judgement, not a polished deck.',
   'An LBO or diligence model parsed for structure and circularity handling, plus a live defence of the assumptions driving returns.',
   [REQ.artifact(1, 'One LBO or diligence model'), REQ.skills(2), REQ.defense('your assumptions'), REQ.hours(8)]],
  ['accounting-finance', 'venture-capital', 'Venture capital', 'elite', 20, 25,
   'A thesis you can defend when the numbers do not exist yet.',
   'A written investment memo plus an unscripted defence — in early-stage work the reasoning is the whole artifact.',
   [REQ.artifact(1, 'One investment memo'), REQ.skills(2), REQ.defense('your thesis'), REQ.hours(6)]],
  ['accounting-finance', 'asset-wealth-management', 'Asset & wealth management', 'open', 20, 15,
   'Portfolio reasoning and risk discipline, scored on the record rather than on returns.',
   'A portfolio or research note with its assumptions stated, and where a paper-trading account is connected, a timestamped order trail read for risk discipline — never for P&L.',
   [REQ.artifact(1, 'One portfolio or research note'), REQ.skills(1), REQ.defense('your allocation'), REQ.hours(6)]],
  ['accounting-finance', 'accounting-audit', 'Accounting & audit', 'open', 24, 15,
   'Reconciliations, close-prep and cleanups — the work that actually slips.',
   'A worked reconciliation or close checklist parsed for structure, plus a walkthrough of how you found an error.',
   [REQ.artifact(1, 'One reconciliation or close artifact'), REQ.skills(1), REQ.defense('a cleanup you ran'), REQ.hours(6)]],

  // ── Healthcare operations ───────────────────────────────────────────────────────────
  ['healthcare-operations', 'clinical-operations', 'Clinical operations', 'elite', 16, 25,
   'Process work no API can verify — vetted by walkthrough and referral, and we say so.',
   'A de-identified process artifact, a walkthrough scored by two raters, and a named supervisor answering cross-checked questions.',
   [REQ.artifact(1, 'One de-identified process artifact'), REQ.defense('a process you mapped'), REQ.referral, REQ.hours(5)]],
  ['healthcare-operations', 'health-analytics', 'Health data & analytics', 'open', 16, 15,
   'Reporting and analysis on de-identified data, with the reasoning shown.',
   'An analysis you can walk through end to end, plus a referral from whoever reviewed it.',
   [REQ.artifact(1, 'One analysis on de-identified data'), REQ.skills(1), REQ.defense('your analysis'), REQ.hours(5)]],
  ['healthcare-operations', 'revenue-cycle', 'Payer & revenue cycle', 'open', 14, 15,
   'Claims, denials and the billing work that quietly decides whether a clinic survives.',
   'A de-identified claims or denials analysis, plus a walkthrough of what you changed and what it recovered.',
   [REQ.artifact(1, 'One de-identified claims or billing artifact'), REQ.defense('your analysis'), REQ.hours(5)]],
  ['healthcare-operations', 'regulatory-quality', 'Regulatory & quality', 'elite', 14, 25,
   'Documentation that has to survive an audit, not just a reader.',
   'A quality or compliance artifact plus a structured referral from the supervisor who signed off on it.',
   [REQ.artifact(1, 'One quality or compliance artifact'), REQ.defense('a control you documented'), REQ.referral, REQ.hours(5)]],
  ['healthcare-operations', 'digital-health-product', 'Digital health product', 'open', 14, 15,
   'Product work inside the constraints clinical software actually has.',
   'A product artifact — spec, flow, or research synthesis — with a walkthrough of the constraint that shaped it.',
   [REQ.artifact(1, 'One product artifact'), REQ.skills(1), REQ.defense('a constraint you designed around'), REQ.hours(5)]],

  // ── Consumer & retail ───────────────────────────────────────────────────────────────
  ['consumer-retail', 'growth-performance', 'Growth & performance', 'open', 24, 15,
   'Numbers from an instrumented run, never a self-reported campaign result.',
   'A bounded, budgeted exercise inside Covenda-provisioned tooling, where the platform recorded the outcome.',
   [REQ.trial, REQ.skills(1), REQ.defense('your test and what you changed'), REQ.hours(5)]],
  ['consumer-retail', 'brand-content', 'Brand & content', 'open', 20, 15,
   'Work judged on the thinking behind it, since anyone can generate the artifact now.',
   'A campaign or content artifact plus an unscripted defence of the choices — which is the part a model cannot sit for.',
   [REQ.artifact(1, 'One campaign or content artifact'), REQ.defense('your creative choices'), REQ.hours(5)]],
  ['consumer-retail', 'merchandising', 'Merchandising & assortment', 'open', 20, 15,
   'Assortment, pricing and category calls you can defend.',
   'A worked analysis with its assumptions stated, plus a recorded walkthrough.',
   [REQ.artifact(1, 'One category or pricing analysis'), REQ.skills(1), REQ.defense('your analysis'), REQ.hours(5)]],
  ['consumer-retail', 'supply-chain', 'Supply chain & operations', 'open', 18, 15,
   'Inventory, forecasting and the operations that decide whether growth is profitable.',
   'A forecast or inventory analysis, plus a walkthrough of where your model was wrong and why.',
   [REQ.artifact(1, 'One forecast or inventory analysis'), REQ.skills(1), REQ.defense('a forecast you missed'), REQ.hours(5)]],
  ['consumer-retail', 'ecommerce-marketplace', 'E-commerce & marketplace', 'open', 18, 15,
   'Conversion, listings and marketplace mechanics, measured rather than claimed.',
   'An instrumented exercise or a worked funnel analysis, defended on record.',
   [REQ.trial, REQ.skills(1), REQ.defense('your funnel analysis'), REQ.hours(5)]],

  // ── Professional services ───────────────────────────────────────────────────────────
  ['professional-services', 'management-consulting', 'Management consulting', 'elite', 24, 25,
   'Structured problem-solving, defended live — the closest thing to the actual interview.',
   'A written case or recommendation plus an unscripted defence of how you framed the problem.',
   [REQ.artifact(1, 'One case or recommendation'), REQ.defense('how you framed it'), REQ.skills(1), REQ.hours(6)]],
  ['professional-services', 'strategy-research', 'Strategy & research', 'open', 24, 15,
   'Authorship is the thing being checked, because AI can write the document.',
   'A research sample plus an unscripted defence on sources, method and the choices you made.',
   [REQ.artifact(1, 'One research or strategy sample'), REQ.defense('your research'), REQ.skills(1), REQ.hours(5)]],
  ['professional-services', 'market-intelligence', 'Market intelligence', 'open', 18, 15,
   'Getting credible on an unfamiliar industry fast, and showing your working.',
   'A landscape or competitive analysis with sources cited, defended on record.',
   [REQ.artifact(1, 'One landscape or competitive analysis'), REQ.defense('your sourcing'), REQ.hours(5)]],
  ['professional-services', 'legal-operations', 'Legal operations', 'open', 16, 15,
   'Contract, process and compliance work where precision is the whole job.',
   'A process or contract-review artifact plus a referral from whoever checked it.',
   [REQ.artifact(1, 'One process or review artifact'), REQ.defense('a process you tightened'), REQ.referral, REQ.hours(5)]],
  ['professional-services', 'technical-writing', 'Technical writing', 'open', 20, 15,
   'Documentation that survives contact with the thing it documents.',
   'A documentation sample and a walkthrough of what you had to learn to write it.',
   [REQ.artifact(1, 'One documentation sample'), REQ.defense('a doc you wrote'), REQ.hours(5)]],
];

export const BATCH_CATALOG = SPECIALISATIONS.map(
  ([verticalSlug, slug, name, tier, capacity, accessCredits, summary, description, requirements]) => {
    const base = VERTICALS_BASE[verticalSlug];
    return {
      slug, name, tier, capacity, accessCredits, summary, description, requirements,
      verticalSlug,
      discipline: base.vertical,
      vertical: base.vertical,
      vetting: base.vetting,
      companyWorkflow: base.companyWorkflow,
    };
  },
);

// Batches grouped by the vertical they belong to — what the board renders.
export function batchesByVertical() {
  return Object.entries(VERTICALS_BASE).map(([verticalSlug, base]) => ({
    verticalSlug,
    vertical: base.vertical,
    batches: BATCH_CATALOG.filter(b => b.verticalSlug === verticalSlug),
  }));
}


// The concrete signals each vertical's vetting reads. Named at this level of detail on
// purpose: a student deciding whether to apply, and a company deciding whether to trust it,
// both need to know what is actually inspected rather than that "vetting happens".
export const WHAT_WE_READ = {
  'software-ai': [
    ['Ownership', 'The OAuth login is matched against the repo owner. A pasted link proves nothing about who wrote it; a connected account does.'],
    ['Accumulation', 'Commit timestamps across the whole history — active weeks, gaps, and burst patterns. A single-dump history is flagged for human review, never auto-credited.'],
    ['Originality', 'Boilerplate and tutorial scaffolding are separated from work that diverges from it. Volume is not the signal.'],
    ['Authorship', 'A recorded walkthrough with unscripted follow-ups on decisions you made. This is the check AI cannot sit for.'],
  ],
  'accounting-finance': [
    ['Formula integrity', 'The .xlsx is unzipped and the formula layer parsed directly — not the displayed values. Hardcoded numbers where a calculation belongs score low by construction.'],
    ['Structure', 'The model is scored against a published DCF rubric: driver separation, circularity handling, and whether assumptions are isolated from outputs.'],
    ['Defence', 'A live pitch defence scored independently by two raters against anchored exemplars, with disagreements adjudicated.'],
    ['Track record (gated)', 'Where a paper-trading account is connected, the order audit trail gives span, cadence and drawdown. Scored on risk discipline, never on returns — rewarding P&L rewards gambling.'],
  ],
  'healthcare-operations': [
    ['The artifact', 'A de-identified process map, SOP or audit you produced. Reviewed for completeness and for the failure modes it accounts for.'],
    ['The walkthrough', 'Two raters score a recorded explanation against anchored exemplars — what broke before you fixed it, and what you would do differently.'],
    ['The referral', 'A named supervisor answers narrow, cross-checked questions under their own identity. Anonymous praise is not accepted.'],
    ['The boundary', 'No PHI and no production access at any point. Work that cannot be de-identified does not become a trial.'],
  ],
  'consumer-retail': [
    ['Instrumented outcome', 'The exercise runs inside Covenda-provisioned tooling with a fixed budget, so the platform records the result rather than the candidate reporting it.'],
    ['Reasoning', 'A scored debrief on what you changed between attempts and why — the part that predicts the next decision.'],
    ['Honesty check', 'Self-reported campaign numbers are not admission evidence. Nothing you cannot show us counts.'],
  ],
  'professional-services': [
    ['The sample', 'A written piece you produced, read for sourcing and for whether claims are supported.'],
    ['Authorship defence', 'Unscripted follow-ups on sources, method and the choices you made. A strong document proves very little about who wrote it; the interview is the proof.'],
    ['Two raters', 'Scored independently against anchored exemplars, adjudicated where they disagree, with inter-rater reliability tracked.'],
  ],
};

export function whatWeRead(verticalSlug) {
  return (WHAT_WE_READ[verticalSlug] || []).map(([signal, detail]) => ({ signal, detail }));
}


// Real screening questions, per specialisation. These are the questions the field actually
// asks — standard finance interview material, standard engineering material — not generic
// prompts about passion. A student should recognise them, and a company should recognise that
// we know what the job screens for.
//
// Two kinds on purpose: TECHNICAL (a right answer exists, and the reasoning is the signal)
// and JUDGEMENT (no right answer; how they bound the problem is the signal).
export const BATCH_QUESTIONS = {
  'ai-ml': [
    ['technical', 'Your model beats baseline on validation and fails in production. Name the four most likely causes, in order.'],
    ['technical', 'When is accuracy the wrong metric? Give a concrete case and say what you would use instead.'],
    ['judgement', 'Two weeks, a noisy dataset. What do you do first, and what do you deliberately not do?'],
  ],
  'physical-ai': [
    ['technical', 'It works in simulation and fails on hardware. Walk me through how you find out why.'],
    ['technical', 'Your sensor drifts over an hour of operation. How do you detect that, and how do you correct for it?'],
    ['judgement', 'The safe behaviour and the useful behaviour conflict. How do you decide?'],
  ],
  'infrastructure-data': [
    ['technical', 'A nightly pipeline silently produced wrong numbers for a week. How do you find when it started?'],
    ['technical', 'When would you denormalise, and what does it cost you?'],
    ['judgement', 'Upstream changes a schema without telling you. How should the pipeline have behaved?'],
  ],
  'product-engineering': [
    ['technical', 'A page is slow and you have no profiler. How do you find the cause?'],
    ['technical', 'Describe a race condition you have actually hit and how you fixed it.'],
    ['judgement', 'You inherit a codebase with no tests and a deadline. Where does the first test go, and why there?'],
  ],
  'security-reliability': [
    ['technical', 'Write the steps of a bug report a developer can act on without asking you a single question.'],
    ['technical', 'A test passes locally and fails in CI. What are your first three hypotheses?'],
    ['judgement', 'You can automate ten tests and no more. How do you choose which ten?'],
  ],

  'investment-banking': [
    ['technical', 'Depreciation increases by $10. Walk me through all three statements, and tell me where cash lands.'],
    ['technical', 'EBITDA is $100M, the multiple is 8x, net debt is $200M, 40M shares. Get me to a share price.'],
    ['technical', 'Why can a company be profitable on the income statement and still run out of cash?'],
    ['judgement', 'You are valuing a private company with no clean public comps. What do you actually do?'],
  ],
  'private-equity': [
    ['technical', 'In an LBO, what actually drives returns? Rank the drivers and say which you control.'],
    ['technical', 'Same company, same price, one deal uses 70% debt and one 30%. Where does the IRR difference come from?'],
    ['judgement', 'Diligence turns up one number that breaks the thesis. Everything else looks good. What do you do?'],
  ],
  'venture-capital': [
    ['judgement', 'A company has no revenue and no comps. How do you decide what it is worth?'],
    ['judgement', 'The market is right and the team is wrong, or the team is right and the market is wrong. Which do you back?'],
    ['technical', 'A founder shows you 20% month-on-month growth. What three questions do you ask before believing it?'],
  ],
  'asset-wealth-management': [
    ['technical', 'Two funds returned 12%. One has a Sharpe of 0.4, the other 1.6. What actually happened?'],
    ['technical', 'What does rebalancing cost you, and when is not rebalancing the bigger risk?'],
    ['judgement', 'A client wants out at the bottom. Walk me through the conversation.'],
  ],
  'accounting-audit': [
    ['technical', 'A reconciliation is off by an amount divisible by nine. What does that usually mean, and why?'],
    ['technical', 'Accrued expenses rise while cash is flat. What has happened, and where does it show?'],
    ['judgement', 'You find an error in a close that has already been reported. What do you do first?'],
  ],

  'clinical-operations': [
    ['judgement', 'Intake takes 40 minutes and should take 15. How do you find where the time actually goes?'],
    ['judgement', 'A process works only because one person knows a workaround. What do you do?'],
    ['technical', 'What has to be true before a process can be run by someone on their first day?'],
  ],
  'health-analytics': [
    ['technical', 'A report shows a 30% jump week on week. Before you tell anyone, what do you check?'],
    ['judgement', 'How do you present an analysis that is good enough to act on but not good enough to be certain?'],
  ],
  'revenue-cycle': [
    ['technical', 'Denials rise 15% in a month with no policy change. Where do you look, in what order?'],
    ['judgement', 'You can fix one step in the billing chain. How do you decide which one is costing the most?'],
  ],
  'regulatory-quality': [
    ['technical', 'What makes a control auditable rather than merely written down?'],
    ['judgement', 'A required step is being skipped because it is slow and everyone knows it. What do you do?'],
  ],
  'digital-health-product': [
    ['judgement', 'Clinicians want fewer clicks; compliance wants more confirmation. How do you decide?'],
    ['technical', 'What changes about a product spec once real patient data is involved?'],
  ],

  'growth-performance': [
    ['technical', 'A test shows a 20% lift on 200 visitors. Do you ship it? Show your reasoning.'],
    ['judgement', 'Your best channel stops working. What is the first thing you look at?'],
  ],
  'brand-content': [
    ['judgement', 'Everyone can generate the asset now. What is left that is actually hard?'],
    ['judgement', 'A campaign performs well and is off-brand. What do you do?'],
  ],
  'merchandising': [
    ['technical', 'Units are up and revenue is down. Give me three explanations and how to tell them apart.'],
    ['judgement', 'How would you decide which products to stop carrying?'],
  ],
  'supply-chain': [
    ['technical', 'Your forecast was 30% high. How do you work out whether the model or the input was wrong?'],
    ['judgement', 'Hold more inventory or risk stocking out. How do you frame that decision for a founder?'],
  ],
  'ecommerce-marketplace': [
    ['technical', 'Traffic is flat, conversion is up, revenue is down. What happened?'],
    ['judgement', 'Supply or demand first on a two-sided marketplace, and why?'],
  ],

  'management-consulting': [
    ['judgement', 'A client says revenue is falling and wants a marketing plan. How do you respond?'],
    ['technical', 'Estimate the annual market for replacement bicycle tyres in one city. Show the structure, not the number.'],
    ['judgement', 'Your recommendation is right and the client will not act on it. What now?'],
  ],
  'strategy-research': [
    ['judgement', 'Two days to get credible on an industry you know nothing about. What do you read, in what order?'],
    ['technical', 'A source supports your conclusion but you cannot verify it. What do you do with it?'],
  ],
  'market-intelligence': [
    ['technical', 'Two reports give market sizes 4x apart. How do you work out which to trust?'],
    ['judgement', 'How do you tell a real trend from a well-marketed one?'],
  ],
  'legal-operations': [
    ['technical', 'What are the first three things you check in a contract you have never seen before?'],
    ['judgement', 'A process is compliant and unusable. Which do you change?'],
  ],
  'technical-writing': [
    ['technical', 'Document a process you do not understand yet. What is your first move?'],
    ['judgement', 'Engineers say the docs are wrong; users say they are unclear. Which do you fix first?'],
  ],
};

export function questionsFor(slug) {
  return (BATCH_QUESTIONS[slug] || []).map(([kind, question]) => ({ kind, question }));
}


// Concrete evidence that counts, per batch. The requirements list what is needed in the
// abstract ("two skills evidenced by real artifacts"); a student needs to know whether the
// thing they actually have qualifies. Anything on this list does.
export const BATCH_ACCEPTS = {
  'ai-ml': ['A GitHub repo you own with commits across three or more months',
            'A model you trained end to end — training code plus the evaluation you ran',
            'A Kaggle or benchmark entry with the notebook behind it',
            'A course project you took materially past the assignment',
            'A paper, preprint or workshop submission you contributed code to',
            'Research assistant work in a lab, with the repo or the PI to confirm it'],
  'physical-ai': ['A robotics repo with commit history — ROS, control, perception, or firmware',
                  'A competition robot you built or programmed (FRC, RoboCup, university team)',
                  'A simulation project that you then ran on real hardware',
                  'CAD or mechanical design paired with the code that drove it',
                  'Lab work on autonomy or controls, with your PI to confirm it'],
  'infrastructure-data': ['A pipeline or ETL repo you own, with its commit history',
                          'A dbt project, warehouse schema, or orchestration DAG you built',
                          'A dataset you collected and cleaned, with the code that did it',
                          'Infrastructure work from an internship you can describe end to end'],
  'product-engineering': ['A shipped app or site with a repo you own',
                          'A meaningful pull request merged into a project you did not start',
                          'A hackathon build you kept working on afterwards',
                          'Internship or freelance work with code you can walk through'],
  'security-reliability': ['A public bug report, CVE, or responsible disclosure you filed',
                           'A CTF placement with your write-ups',
                           'A test suite you built for a real project',
                           'An incident or outage you helped diagnose, with the write-up'],

  'investment-banking': ['A three-statement or DCF model you built in Excel',
                         'A stock pitch you presented — deck plus the model behind it',
                         'Investment club or fund work where you owned the analysis',
                         'A summer analyst or internship deliverable you can defend',
                         'A case competition placement with your submission'],
  'private-equity': ['An LBO model you built, including the returns bridge',
                     'A diligence memo on a real or historical deal',
                     'Search fund, PE club, or independent sponsor work',
                     'A case competition where you sized and defended a buyout'],
  'venture-capital': ['An investment memo on a real company',
                      'A market map or thesis you researched and wrote',
                      'Scout, fellowship, or VC club work where you sourced deals',
                      'A company you founded, joined early, or advised'],
  'asset-wealth-management': ['A portfolio you manage, with your reasoning documented',
                              'A paper-trading or brokerage track record you can connect',
                              'A quant or investing club project with the code or model',
                              'A research note on an asset class with assumptions stated'],
  'accounting-audit': ['A reconciliation, close checklist, or audit workpaper you produced',
                       'Bookkeeping or controller work for a real organisation, even a club',
                       'An accounting internship deliverable you can walk through',
                       'A process you fixed, with what was wrong before'],

  'clinical-operations': ['A process map, SOP, or workflow you documented — de-identified',
                          'Clinic, hospital, or health-startup operations work',
                          'A quality-improvement project with what changed and why',
                          'Volunteer or scribe work where you owned a process'],
  'health-analytics': ['An analysis on de-identified health data, with your code',
                       'A dashboard or report you built for a clinical team',
                       'Public-health or epidemiology research you contributed to'],
  'revenue-cycle': ['A claims, denials, or billing analysis you produced',
                    'Revenue-cycle or medical-billing work, even part-time',
                    'A recovery or reconciliation project with the numbers'],
  'regulatory-quality': ['A compliance or quality artifact you wrote — SOP, CAPA, audit prep',
                         'Regulatory work in a lab, clinic, or health company',
                         'A control you designed or documented, with sign-off'],
  'digital-health-product': ['A product spec, flow, or research synthesis you wrote',
                             'A health app or tool you built or shaped',
                             'User research with clinicians or patients you ran'],

  'growth-performance': ['A campaign you ran with the account or dashboard to show it',
                         'A growth experiment with the result — including one that failed',
                         'Marketing work for a club, startup, or your own project',
                         'An analytics build (attribution, funnel, cohort) you own'],
  'brand-content': ['A content series, brand system, or campaign you made',
                    'A creative portfolio with the reasoning behind the choices',
                    'Social or community work with real reach you can show'],
  'merchandising': ['An assortment, pricing, or category analysis you built',
                    'Retail or e-commerce work where you owned a category',
                    'A buying or inventory project with the numbers'],
  'supply-chain': ['A forecast or inventory model you built',
                   'Operations work at a DTC brand, warehouse, or manufacturer',
                   'A logistics or sourcing project with what you changed'],
  'ecommerce-marketplace': ['A store you built or ran, with its numbers',
                            'A conversion or funnel analysis you produced',
                            'Marketplace ops work — supply, demand, or trust and safety'],

  'management-consulting': ['A case competition placement with your deck',
                            'A consulting club engagement you led or owned a workstream on',
                            'A pro-bono or nonprofit project with a real recommendation',
                            'An internship deliverable you can defend under questioning'],
  'strategy-research': ['A research report or strategy memo you wrote',
                        'A thesis, capstone, or independent study with sources',
                        'Research assistant work with your own written output'],
  'market-intelligence': ['A market map, landscape, or competitive analysis',
                          'Industry research you produced for a real audience',
                          'A data-backed piece on a sector you got credible in fast'],
  'legal-operations': ['A contract review, process, or compliance artifact you produced',
                       'Legal clinic, paralegal, or in-house internship work',
                       'A process you tightened, with what was going wrong'],
  'technical-writing': ['Documentation you wrote for a real project',
                        'A technical blog, tutorial, or explainer with an audience',
                        'API or developer docs you own or contributed to'],
};

export function acceptsFor(slug) {
  return BATCH_ACCEPTS[slug] || [];
}

export function batchBySlug(slug) {
  return BATCH_CATALOG.find(b => b.slug === slug) || null;
}

// The public, student-facing view of a batch: what it is and exactly what it takes to get in.
// Also the company-facing walkthrough. Safe to render unauthenticated — no weights, no
// applicant data, no connector scopes or partner terms.
// ---------------------------------------------------------------------------
// Compatibility: how well a student's stated skills line up with what a batch is about.
//
// Deliberately NOT the admission decision. `evaluateBatchAdmission` weighs real evidence
// against the published bar and is what actually gates entry. This is the softer question a
// student asks while browsing — "is this one even for me?" — and it must never be mistaken
// for the first. It reads stated skills, which are self-reported and therefore worth exactly
// what self-report is worth.
//
// Explainable by construction: it returns the terms that matched, so the UI can show why
// rather than presenting a number nobody can interrogate. The product's own line is that
// nothing here is a black-box score, and a compatibility bar is precisely where that
// promise would quietly break.
// ---------------------------------------------------------------------------

const COMPAT_STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'that', 'this', 'you', 'your', 'are', 'not', 'work',
  'real', 'into', 'each', 'must', 'point', 'their', 'them', 'they', 'has', 'have', 'who',
  'what', 'when', 'where', 'how', 'why', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'is', 'it',
]);

function compatTerms(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map(t => t.replace(/^[.]+|[.]+$/g, ''))
    .filter(t => t.length > 2 && !COMPAT_STOPWORDS.has(t));
}

// The words that describe what a batch is about. Name and discipline carry the most signal,
// so they are counted twice; the summary and requirement labels fill in the vocabulary.
function batchVocabulary(batch) {
  if (!batch) return new Set();
  const strong = [batch.name, batch.discipline, batch.verticalSlug, batch.discipline].join(' ');
  const rest = [batch.summary, (batch.requirements || []).map(r => r.label).join(' ')].join(' ');
  return new Set([...compatTerms(strong), ...compatTerms(rest)]);
}

export function batchCompatibility(batch, { skills = [], verticals = [], evidencedSkills = [] } = {}) {
  const vocab = batchVocabulary(batch);
  const stated = (skills || []).map(s => String(s || '').trim()).filter(Boolean);
  const evidenced = new Set((evidencedSkills || []).map(s => String(s || '').toLowerCase().trim()));

  if (!stated.length) {
    return {
      score: null, matched: [], evidencedMatched: [], verticalMatch: false,
      basis: 'no-skills',
      why: 'Add skills to your profile and every batch will show how well it lines up.',
    };
  }

  const matched = [];
  const evidencedMatched = [];
  for (const skill of stated) {
    const terms = compatTerms(skill);
    if (!terms.length) continue;
    // A skill counts if any of its words is part of how this batch describes itself.
    if (terms.some(t => vocab.has(t))) {
      matched.push(skill);
      if (evidenced.has(skill.toLowerCase())) evidencedMatched.push(skill);
    }
  }

  const verticalMatch = Boolean(batch?.verticalSlug && (verticals || []).includes(batch.verticalSlug));

  // Proportion of your skills this batch speaks to, lifted by an interest match and again by
  // any of those skills being backed by analysed code rather than only claimed.
  const overlap = matched.length / stated.length;
  let score = Math.round(overlap * 70);
  if (verticalMatch) score += 20;
  if (evidencedMatched.length) score += Math.min(10, evidencedMatched.length * 5);
  score = Math.max(0, Math.min(100, score));

  let why;
  if (!matched.length && !verticalMatch) why = 'Nothing on your profile points at this field yet.';
  else if (!matched.length) why = 'You listed this vertical as an interest, but none of your skills speak to it yet.';
  else {
    const names = matched.slice(0, 3).join(', ');
    why = `${matched.length} of your ${stated.length} skills line up — ${names}${matched.length > 3 ? ', and more' : ''}`
      + (verticalMatch ? ', and it is a vertical you follow.' : '.');
  }

  return { score, matched, evidencedMatched, verticalMatch, basis: 'stated-skills', why };
}

export function batchBrief(batch) {
  if (!batch) return null;
  const rails = (batch.vetting?.rails || []).map(id => VETTING_RAILS[id]).filter(Boolean);
  return {
    slug: batch.slug,
    name: batch.name,
    verticalSlug: batch.verticalSlug || null,
    discipline: batch.discipline,
    tier: batch.tier,
    capacity: batch.capacity,
    accessCredits: batch.accessCredits,
    summary: batch.summary,
    description: batch.description,
    // How this industry is technically vetted — including, honestly, when the answer is a
    // human rail because no API can reach the work.
    vetting: {
      rails: rails.map(r => ({ id: r.id, label: r.label, how: r.how, defeats: r.defeats })),
      apiVerified: rails.some(r => r.id === 'api_forensics' || r.id === 'artifact_parse' || r.id === 'instrumented_trial'),
      humanRailOnly: rails.length > 0 && rails.every(r => r.id === 'rubric_defense' || r.id === 'structured_referral'),
      connectors: (batch.vetting?.connectors || []).map(id => {
        const c = CONNECTORS[id];
        return c ? { id: c.connector_id, label: c.label, status: c.status } : { id, label: id, status: 'stub' };
      }),
    },
    requirements: (batch.requirements || []).map(r => ({ key: r.key, label: r.label, detail: r.detail || null })),
    whatWeRead: whatWeRead(batch.verticalSlug),
    questions: questionsFor(batch.slug),
    accepts: acceptsFor(batch.slug),
    companyWorkflow: batch.companyWorkflow || [],
    admissionVersion: BATCH_ADMISSION_VERSION,
  };
}

// ---------------------------------------------------------------------------
// The evaluator. Runs a batch's requirement descriptors against ONE applicant's evidence.
// Pure: no I/O, no clock, no randomness — the caller passes everything in.
//
// `applicant` shape (all optional; absent means "no evidence yet", never a penalty elsewhere):
//   skillClaims:  [{ skill, verification_tier, evidence_pointer, evidence_meta:{ownership_verified, history_span_days} }]
//   referrals:    [{ referrer, role, verified }]
//   completedTrials: [{ project_id, accepted_at }]
//   artifacts:    [{ type, url }]
//   defenses:     [{ kind, recorded_at }]
//   availabilityHoursPerWeek: number
// ---------------------------------------------------------------------------
function evidenceFor(kind, requirement, applicant) {
  const claims = Array.isArray(applicant.skillClaims) ? applicant.skillClaims : [];
  switch (kind) {
    case 'ownership_verified': {
      const hits = claims.filter(c => c.evidence_meta?.ownership_verified === true);
      return { count: hits.length, pointers: hits.map(c => c.evidence_pointer).filter(Boolean) };
    }
    case 'history_span_days': {
      const spans = claims.map(c => Number(c.evidence_meta?.history_span_days)).filter(n => Number.isFinite(n));
      const best = spans.length ? Math.max(...spans) : 0;
      const source = claims.find(c => Number(c.evidence_meta?.history_span_days) === best);
      return { count: best, pointers: source?.evidence_pointer ? [source.evidence_pointer] : [] };
    }
    case 'skill_claims_at_tier': {
      const hits = claims.filter(c => tierAtLeast(c.verification_tier, requirement.tier || 'artifact') && c.evidence_pointer);
      return { count: hits.length, pointers: hits.map(c => c.evidence_pointer) };
    }
    case 'referral_count': {
      const hits = (applicant.referrals || []).filter(r => r && r.verified !== false);
      return { count: hits.length, pointers: hits.map(r => r.referrer).filter(Boolean) };
    }
    case 'trial_count': {
      const hits = applicant.completedTrials || [];
      return { count: hits.length, pointers: hits.map(t => t.project_id).filter(Boolean) };
    }
    case 'instrumented_trial': {
      const hits = (applicant.completedTrials || []).filter(t => t.instrumented === true);
      return { count: hits.length, pointers: hits.map(t => t.project_id).filter(Boolean) };
    }
    case 'artifact_count': {
      const hits = applicant.artifacts || [];
      return { count: hits.length, pointers: hits.map(a => a.url).filter(Boolean) };
    }
    case 'defense_recorded': {
      const hits = applicant.defenses || [];
      return { count: hits.length, pointers: hits.map(d => d.kind).filter(Boolean) };
    }
    case 'availability_hours': {
      const hours = Number(applicant.availabilityHoursPerWeek);
      return { count: Number.isFinite(hours) ? hours : 0, pointers: [] };
    }
    default:
      return { count: 0, pointers: [] };
  }
}

export function evaluateBatchAdmission(batch, applicant = {}) {
  const requirements = batch?.requirements || [];
  const checks = requirements.map(requirement => {
    const { count, pointers } = evidenceFor(requirement.kind, requirement, applicant);
    const min = Number(requirement.min) || 0;
    const met = count >= min;
    return {
      key: requirement.key,
      kind: requirement.kind,
      label: requirement.label,
      detail: requirement.detail || null,
      required: min,
      observed: count,
      met,
      // No pointer, no claim: a requirement that "passes" with nothing to cite is reported
      // as unverified so a reviewer never sees a bare green check.
      evidence: met ? pointers.slice(0, 3) : [],
      unverified: met && requirement.kind !== 'availability_hours' && pointers.length === 0,
      gap: met ? null : gapText(requirement, count, min),
    };
  });

  const metCount = checks.filter(c => c.met).length;
  const total = checks.length;
  const allMet = total > 0 && metCount === total;
  const anyUnverified = checks.some(c => c.unverified);

  // A recommendation, never a decision. 'admit_recommended' still requires an operator to
  // accept the application and record a rationale — see acceptBatchApplication in api/admin.js.
  let recommendation;
  if (allMet && !anyUnverified) recommendation = 'admit_recommended';
  else if (allMet && anyUnverified) recommendation = 'review';
  else if (total > 0 && metCount >= Math.ceil(total / 2)) recommendation = 'review';
  else recommendation = 'not_yet';

  return {
    batchSlug: batch?.slug || null,
    meetsThreshold: allMet,
    metCount,
    total,
    checks,
    recommendation,
    // What to go earn. This is the whole point of a published bar.
    gaps: checks.filter(c => !c.met).map(c => ({ key: c.key, label: c.label, gap: c.gap })),
    decisionMakerNote: 'Recommendation only — an operator decides and records a rationale.',
    admissionVersion: BATCH_ADMISSION_VERSION,
  };
}

function gapText(requirement, observed, min) {
  if (requirement.kind === 'availability_hours') return `You listed ${observed || 0} hrs/week; this batch expects ${min}.`;
  if (requirement.kind === 'history_span_days') return `Your longest evidence span is ${observed || 0} days; this batch expects ${min}.`;
  const short = Math.max(0, min - observed);
  return `${short} more to go (${observed}/${min}).`;
}

// ---------------------------------------------------------------------------
// The demo walkthrough. A company asking "what does this look like for US" needs its own
// vertical, not a generic tour: the evidence a robotics team can audit is nothing like what
// a search fund can. Each entry names a concrete company type and walks the same six beats,
// so the shape is comparable across batches while the substance is specific to one.
// Illustrative by construction — no real company, no real student, no claimed outcome.
// ---------------------------------------------------------------------------
export const VERTICAL_DEMOS = {
  'software-ai': {
    company: 'A seed-stage AI startup, 6 engineers',
    need: 'Their regression suite is flaky and nobody owns it, so every release slips a day.',
    beats: [
      ['You describe the person', 'Backend-leaning, comfortable in a codebase they did not write. 10 hrs/week, 4 weeks, 60 min of your review time.'],
      ['We search the software batch', 'Only students who connected the GitHub account that owns their work — not a pasted link.'],
      ['The evidence you actually see', 'Eight months of commit history on one project, the specific files behind each language claim, and whether the cadence looks accumulated or dumped in a weekend.'],
      ['Three candidates, one gap each', 'Evidence-cited. If fewer than three clear your must-haves you get fewer — never a padded list.'],
      ['The trial', 'Fix the three flakiest specs and document why they failed. Useful to you whether or not you hire.'],
      ['What you learn', 'How they work in an unfamiliar codebase, how they explain a fix, whether they hit a checkpoint.'],
    ],
  },
  'accounting-finance': {
    company: 'A search fund screening its first analyst',
    need: 'Diligence models keep arriving as hardcoded numbers nobody can audit.',
    beats: [
      ['You describe the person', 'Modelling-heavy, comfortable being challenged on assumptions. 10 hrs/week, 4 weeks.'],
      ['We search the finance batch', 'Students whose model was parsed, not skimmed.'],
      ['The evidence you actually see', 'Formula integrity and DCF structure scored by a parser that reads the formula layer — a workbook of pasted values scores low by construction — plus a recorded pitch defence scored by two raters.'],
      ['Three candidates, one gap each', 'With the parsed model and the defence attached.'],
      ['The trial', 'Rebuild one segment of a model from public filings, with assumptions stated.'],
      ['What you learn', 'Whether they can defend a number under pressure, which is the job.'],
    ],
  },
  'healthcare-operations': {
    company: 'A clinical operations team at a 40-person health startup',
    need: 'Intake is undocumented and every new hire learns it by shadowing.',
    beats: [
      ['You describe the person', 'Process-minded, careful with sensitive material. 5 hrs/week.'],
      ['We search the operations batch', 'Vetted on the human rail — we say so plainly, because no API can verify this work.'],
      ['The evidence you actually see', 'A de-identified process artifact, a recorded walkthrough scored by two raters against anchored exemplars, and a named supervisor who answered cross-checked questions.'],
      ['Three candidates, one gap each', 'With the referrer named and the walkthrough attached.'],
      ['The trial', 'Map the intake process end to end from de-identified material.'],
      ['What you learn', 'Whether they ask the right questions before documenting the wrong thing. No PHI, no production access.'],
    ],
  },
  'consumer-retail': {
    company: 'A DTC brand doing its first paid tests',
    need: 'Every applicant claims growth numbers nobody can check.',
    beats: [
      ['You describe the person', 'Analytical, willing to be measured. 5 hrs/week.'],
      ['We search the consumer batch', 'Students whose numbers came from an instrumented run, not a slide.'],
      ['The evidence you actually see', 'A bounded, budgeted challenge executed inside Covenda-provisioned tooling, where the platform recorded the outcome rather than the candidate reporting it.'],
      ['Three candidates, one gap each', 'With the challenge, its budget, and what was measured.'],
      ['The trial', 'Run one bounded test against a hypothesis you already have.'],
      ['What you learn', 'How they reason about a result that disagrees with them.'],
    ],
  },
  'professional-services': {
    company: 'A boutique consultancy that keeps rewriting junior research',
    need: 'Written work arrives polished and hollow, and AI made that harder to spot.',
    beats: [
      ['You describe the person', 'Research and writing, sourced. 5 hrs/week.'],
      ['We search the research batch', 'Where authorship is the thing being checked, not the prose.'],
      ['The evidence you actually see', 'A writing sample plus a recorded defence with unscripted follow-ups on sources and method — because a strong document proves very little about who wrote it.'],
      ['Three candidates, one gap each', 'With the sample and the defence score.'],
      ['The trial', 'A landscape memo from public sources, with the reasoning shown.'],
      ['What you learn', 'Whether the thinking is theirs. The document gets them to the interview; the interview is the proof.'],
    ],
  },
};

export function demoForVertical(slug) {
  const demo = VERTICAL_DEMOS[slug];
  if (!demo) return null;
  const base = VERTICALS_BASE[slug];
  return {
    slug,
    name: base ? base.vertical : slug,
    company: demo.company,
    need: demo.need,
    beats: demo.beats.map(([title, detail], i) => ({ step: i + 1, title, detail })),
    // Never a case study: no real company, no real student, no claimed outcome.
    illustrative: true,
    admissionVersion: BATCH_ADMISSION_VERSION,
  };
}

// ---------------------------------------------------------------------------
// The wedge. Software is the only batch whose primary evidence is ownership-verified AND
// timestamp-forensic end to end — every other vertical routes at least partly to a human
// rail. That makes it the cheapest place to prove the thesis: the evidence is strongest, the
// supply is densest, and a founder can audit a claim themselves in under a minute.
//
// Derived, not asserted: leadVertical() reads the registry, so if a connector ships or is
// pulled the wedge moves with it instead of drifting out of date in a comment.
// ---------------------------------------------------------------------------
export function verticalStrength(batch) {
  const connectors = (batch?.vetting?.connectors || []).map(id => CONNECTORS[id]).filter(Boolean);
  const live = connectors.filter(c => c.status === 'live');
  return {
    slug: batch?.slug || null,
    liveConnectors: live.length,
    ownershipVerified: live.some(c => c.ownership === 'oauth'),
    historyForensic: live.some(c => c.history && c.history !== 'none'),
    humanRailOnly: connectors.length === 0,
  };
}

export function leadVertical() {
  const ranked = Object.entries(VERTICALS_BASE)
    .map(([slug, base]) => ({ batch: { slug, name: base.vertical, vetting: base.vetting }, strength: verticalStrength({ slug, vetting: base.vetting }) }))
    .sort((a, b) =>
      Number(b.strength.ownershipVerified) - Number(a.strength.ownershipVerified)
      || Number(b.strength.historyForensic) - Number(a.strength.historyForensic)
      || b.strength.liveConnectors - a.strength.liveConnectors);
  const top = ranked[0];
  if (!top || !top.strength.ownershipVerified) return null; // no batch earns the claim yet
  return {
    slug: top.batch.slug,
    name: top.batch.name,
    reason: 'The only batch where ownership and history are both machine-verified end to end — a founder can audit a claim themselves in under a minute.',
    strength: top.strength,
  };
}
