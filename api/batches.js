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

// One batch per vertical. `vetting` names the technical process that actually applies to that
// industry; `requirements` is the published bar; `companyWorkflow` is the step-by-step a
// company walks when evaluating the admitted bench.
export const BATCH_CATALOG = [
  {
    slug: 'software-ai',
    name: 'Software & AI',
    discipline: 'Software & AI',
    vertical: 'Software & AI',
    workTypes: ['QA & testing', 'Data & spreadsheets'],
    tier: 'elite',
    capacity: 24,
    accessCredits: 25,
    summary: 'Undergraduates who ship code, evidenced by commit history you can audit rather than a résumé line.',
    description:
      'The software bench. Admission runs on your own GitHub account — connected, not pasted — so the repos credited to you are provably yours and their history is read from the commit timeline. Months of accumulated work is the signal; a polished one-session repo is not.',
    vetting: { rails: ['api_forensics', 'rubric_defense'], connectors: ['github'] },
    requirements: [
      { key: 'ownership', kind: 'ownership_verified', min: 1, label: 'Connect the GitHub account that owns your work', detail: 'OAuth, read-only. A pasted repo link still counts as an artifact, but ownership-verified evidence is what clears this bar.' },
      { key: 'history', kind: 'history_span_days', min: 90, label: 'At least 90 days of accumulated commit history', detail: 'Span, not volume. A repo built over a term beats a repo built over a weekend.' },
      { key: 'skills', kind: 'skill_claims_at_tier', min: 2, tier: 'artifact', label: 'Two skills evidenced by real artifacts', detail: 'Each skill must point at the specific repo or file that justifies it.' },
      { key: 'defense', kind: 'defense_recorded', min: 1, label: 'One recorded walkthrough of your own code', detail: 'Five minutes explaining a design decision you made and what you would change now.' },
      { key: 'availability', kind: 'availability_hours', min: 6, label: 'Six or more hours a week', detail: 'Bounded projects assume you can hold a weekly checkpoint.' },
    ],
    companyWorkflow: [
      { step: 1, title: 'Open the bench', detail: 'You see every admitted student in this batch with their evidence attached — not a ranked leaderboard, and not a résumé pile.' },
      { step: 2, title: 'Read the proof, not the pedigree', detail: 'Each skill shows the repo, the commit range, and whether the account was ownership-verified. School and name are not scoring inputs.' },
      { step: 3, title: 'Scope one bounded task', detail: 'Describe the work that keeps slipping. Covenda turns the safe part into a fixed-scope, fixed-price packet.' },
      { step: 4, title: 'See at most three candidates', detail: 'Evidence-cited, each with one honest gap. If fewer than three clear your must-haves, you get fewer — never a padded shortlist.' },
      { step: 5, title: 'Run the work-trial', detail: 'Milestones with dates. You review at checkpoints; deeper system access is earned, never granted up front.' },
      { step: 6, title: 'Decide with the record', detail: 'Accept and the outcome becomes part of the student’s verified record. Hire, re-hire, or stop — the evidence is yours either way.' },
    ],
  },
  {
    slug: 'accounting-finance',
    name: 'Accounting & finance',
    discipline: 'Accounting & finance',
    vertical: 'Accounting & finance',
    workTypes: ['Data & spreadsheets', 'Research'],
    tier: 'elite',
    capacity: 24,
    accessCredits: 25,
    summary: 'Students whose models are parsed formula-by-formula and defended out loud.',
    description:
      'The finance bench — the deepest technical vetting Covenda runs. You submit a real model and Covenda parses the workbook itself: formula integrity, structure against a DCF rubric, and whether the numbers are computed or hardcoded. Then you defend it live against anchored rubric questions.',
    vetting: { rails: ['artifact_parse', 'rubric_defense'], connectors: ['xlsx_model', 'pitch_defense', 'alpaca_track_record'] },
    requirements: [
      { key: 'model', kind: 'artifact_count', min: 1, label: 'One financial model (.xlsx)', detail: 'Parsed for formula integrity and DCF structure. A workbook of pasted values scores low by construction.' },
      { key: 'skills', kind: 'skill_claims_at_tier', min: 2, tier: 'artifact', label: 'Two evidenced finance skills', detail: 'Skills are inferred from the work — if the model contains a DCF, DCF becomes a scored skill.' },
      { key: 'defense', kind: 'defense_recorded', min: 1, label: 'A recorded pitch defense', detail: 'Two raters score it against anchored exemplars; disagreements are adjudicated.' },
      { key: 'availability', kind: 'availability_hours', min: 6, label: 'Six or more hours a week', detail: null },
    ],
    companyWorkflow: [
      { step: 1, title: 'Open the bench', detail: 'Admitted students, each with a parsed model and a scored defense on file.' },
      { step: 2, title: 'Read the model score', detail: 'You see what the parser found — formula integrity, structure, and where it was weak. Per-skill, never one overall number.' },
      { step: 3, title: 'Scope one bounded task', detail: 'Reconciliations, a model build, diligence support — the safe, self-contained slice.' },
      { step: 4, title: 'See at most three candidates', detail: 'With the specific evidence that fits your task, plus one honest gap each.' },
      { step: 5, title: 'Run the work-trial', detail: 'No production or client-record access at stage one. Sample or de-identified data until access is earned.' },
      { step: 6, title: 'Decide with the record', detail: 'Acceptance is recorded as employer-verified evidence and compounds on the student’s record.' },
    ],
  },
  {
    slug: 'healthcare-operations',
    name: 'Healthcare operations',
    discipline: 'Healthcare operations',
    vertical: 'Healthcare operations',
    workTypes: ['Operations', 'Research', 'Writing & documentation'],
    tier: 'elite',
    capacity: 16,
    accessCredits: 25,
    summary: 'Operations students vetted by walkthrough and referral — because no API can prove this work.',
    description:
      'Healthcare operations work is process work, and no platform API can verify it. Covenda does not pretend otherwise: this batch is vetted on the human rail — a recorded walkthrough scored by two raters against anchored exemplars, plus a structured referral from someone who supervised you. Every project here runs on de-identified material only.',
    vetting: { rails: ['rubric_defense', 'structured_referral'], connectors: [] },
    requirements: [
      { key: 'artifact', kind: 'artifact_count', min: 1, label: 'One process artifact', detail: 'A workflow map, SOP, or audit you actually produced. De-identified.' },
      { key: 'defense', kind: 'defense_recorded', min: 1, label: 'A recorded walkthrough', detail: 'Talk through the process you built and what broke before you fixed it.' },
      { key: 'referral', kind: 'referral_count', min: 1, label: 'One structured referral', detail: 'From a supervisor, professor, or clinical operations lead who saw the work.' },
      { key: 'availability', kind: 'availability_hours', min: 5, label: 'Five or more hours a week', detail: null },
    ],
    companyWorkflow: [
      { step: 1, title: 'Open the bench', detail: 'Each student shows a process artifact, a scored walkthrough, and a named referrer.' },
      { step: 2, title: 'Read the rail honestly', detail: 'Covenda labels this batch human-rail vetted. There is no API forensic here and we do not claim one.' },
      { step: 3, title: 'Scope one bounded task', detail: 'Intake mapping, documentation, scheduling analysis — de-identified by default.' },
      { step: 4, title: 'See at most three candidates', detail: 'With the referral and the walkthrough attached.' },
      { step: 5, title: 'Run the work-trial', detail: 'No PHI, no production systems. The information boundary is set before the student is named.' },
      { step: 6, title: 'Decide with the record', detail: 'Your acceptance is the strongest signal on the platform — a real reviewer confirming real work.' },
    ],
  },
  {
    slug: 'consumer-retail',
    name: 'Consumer & retail',
    discipline: 'Consumer & retail',
    vertical: 'Consumer & retail',
    workTypes: ['Research', 'Data & spreadsheets', 'Writing & documentation'],
    tier: 'open',
    capacity: 24,
    accessCredits: 15,
    summary: 'Growth and merchandising students proved by an instrumented challenge, not claimed metrics.',
    description:
      'Consumer work is full of unverifiable claims, so this batch runs an instrumented challenge: a bounded, budgeted exercise inside Covenda-provisioned tooling where the result is measured by the platform rather than reported by the candidate. Self-reported campaign numbers are not admission evidence.',
    vetting: { rails: ['instrumented_trial', 'rubric_defense'], connectors: ['sandbox_suite'] },
    requirements: [
      { key: 'trial', kind: 'instrumented_trial', min: 1, label: 'One instrumented challenge', detail: 'A bounded exercise with a fixed budget; Covenda records the outcome directly.' },
      { key: 'skills', kind: 'skill_claims_at_tier', min: 1, tier: 'artifact', label: 'One evidenced skill', detail: 'Pointing at the challenge output or prior work you can show.' },
      { key: 'defense', kind: 'defense_recorded', min: 1, label: 'A recorded walkthrough', detail: 'Explain your reasoning — what you tested and what you would change.' },
      { key: 'availability', kind: 'availability_hours', min: 5, label: 'Five or more hours a week', detail: null },
    ],
    companyWorkflow: [
      { step: 1, title: 'Open the bench', detail: 'Students whose numbers came from an instrumented run, not a slide.' },
      { step: 2, title: 'Read the challenge result', detail: 'The exercise, the budget, and what the platform measured.' },
      { step: 3, title: 'Scope one bounded task', detail: 'A test, a teardown, a merchandising analysis — one clear deliverable.' },
      { step: 4, title: 'See at most three candidates', detail: 'Evidence-cited, one honest gap each.' },
      { step: 5, title: 'Run the work-trial', detail: 'Sandboxed budgets and accounts first; spend authority is earned.' },
      { step: 6, title: 'Decide with the record', detail: 'Accepted work becomes verified evidence on the student’s record.' },
    ],
  },
  {
    slug: 'professional-services',
    name: 'Professional services',
    discipline: 'Professional services',
    vertical: 'Professional services',
    workTypes: ['Research', 'Writing & documentation', 'Operations'],
    tier: 'open',
    capacity: 24,
    accessCredits: 15,
    summary: 'Research and writing students vetted on authorship, because AI can generate the artifact.',
    description:
      'Research and writing are the easiest work to fake and the hardest to verify from the artifact alone — a strong document proves very little about who wrote it. So this batch vets authorship directly: you defend your own work on camera against unscripted follow-ups, and two raters score it. The document gets you to the interview; the interview is the proof.',
    vetting: { rails: ['rubric_defense', 'structured_referral'], connectors: [] },
    requirements: [
      { key: 'artifact', kind: 'artifact_count', min: 1, label: 'One research or writing sample', detail: 'Something you wrote and can defend in detail.' },
      { key: 'defense', kind: 'defense_recorded', min: 1, label: 'A recorded authorship defense', detail: 'Unscripted follow-ups on sources, method, and the choices you made.' },
      { key: 'skills', kind: 'skill_claims_at_tier', min: 1, tier: 'artifact', label: 'One evidenced skill', detail: null },
      { key: 'availability', kind: 'availability_hours', min: 5, label: 'Five or more hours a week', detail: null },
    ],
    companyWorkflow: [
      { step: 1, title: 'Open the bench', detail: 'Every student here has defended their own writing on record.' },
      { step: 2, title: 'Read the defense, not just the document', detail: 'The walkthrough score is the authorship signal. The document alone is not.' },
      { step: 3, title: 'Scope one bounded task', detail: 'A memo, a landscape scan, a documentation set — with a named reviewer.' },
      { step: 4, title: 'See at most three candidates', detail: 'With the sample and the defense attached.' },
      { step: 5, title: 'Run the work-trial', detail: 'Public or de-identified sources at stage one.' },
      { step: 6, title: 'Decide with the record', detail: 'Acceptance compounds into the student’s verified record.' },
    ],
  },
];

export function batchBySlug(slug) {
  return BATCH_CATALOG.find(b => b.slug === slug) || null;
}

// The public, student-facing view of a batch: what it is and exactly what it takes to get in.
// Also the company-facing walkthrough. Safe to render unauthenticated — no weights, no
// applicant data, no connector scopes or partner terms.
export function batchBrief(batch) {
  if (!batch) return null;
  const rails = (batch.vetting?.rails || []).map(id => VETTING_RAILS[id]).filter(Boolean);
  return {
    slug: batch.slug,
    name: batch.name,
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
// so the shape is comparable across benches while the substance is specific to one.
// Illustrative by construction — no real company, no real student, no claimed outcome.
// ---------------------------------------------------------------------------
export const VERTICAL_DEMOS = {
  'software-ai': {
    company: 'A seed-stage AI startup, 6 engineers',
    need: 'Their regression suite is flaky and nobody owns it, so every release slips a day.',
    beats: [
      ['You describe the person', 'Backend-leaning, comfortable in a codebase they did not write. 10 hrs/week, 4 weeks, 60 min of your review time.'],
      ['We search the software bench', 'Only students who connected the GitHub account that owns their work — not a pasted link.'],
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
      ['We search the finance bench', 'Students whose model was parsed, not skimmed.'],
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
      ['We search the operations bench', 'Vetted on the human rail — we say so plainly, because no API can verify this work.'],
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
      ['We search the consumer bench', 'Students whose numbers came from an instrumented run, not a slide.'],
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
      ['We search the research bench', 'Where authorship is the thing being checked, not the prose.'],
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
  const batch = batchBySlug(slug);
  return {
    slug,
    name: batch ? batch.name : slug,
    company: demo.company,
    need: demo.need,
    beats: demo.beats.map(([title, detail], i) => ({ step: i + 1, title, detail })),
    // Never a case study: no real company, no real student, no claimed outcome.
    illustrative: true,
    admissionVersion: BATCH_ADMISSION_VERSION,
  };
}

// ---------------------------------------------------------------------------
// The wedge. Software is the only bench whose primary evidence is ownership-verified AND
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
  const ranked = BATCH_CATALOG
    .map(batch => ({ batch, strength: verticalStrength(batch) }))
    .sort((a, b) =>
      Number(b.strength.ownershipVerified) - Number(a.strength.ownershipVerified)
      || Number(b.strength.historyForensic) - Number(a.strength.historyForensic)
      || b.strength.liveConnectors - a.strength.liveConnectors);
  const top = ranked[0];
  if (!top || !top.strength.ownershipVerified) return null; // no bench earns the claim yet
  return {
    slug: top.batch.slug,
    name: top.batch.name,
    reason: 'The only bench where ownership and history are both machine-verified end to end — a founder can audit a claim themselves in under a minute.',
    strength: top.strength,
  };
}
