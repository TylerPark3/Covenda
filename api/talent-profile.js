// The Talent Requirement Card — the company-side counterpart to the student's narrowing flow.
//
// A company picks industry → focus area → work type → skills through the same boxes the
// student uses, says how much review time and how many hours a week the work needs, and
// describes the problem in their own words. That produces an OPPORTUNITY-SHAPED object,
// which is the input the existing compatibility engine (api/match.js) already takes. No new
// scoring system: this closes the loop so the matcher finally has a company-authored request
// to rank against, instead of only a posted project.
//
// ── ON "ML" ────────────────────────────────────────────────────────────────────────────
// There is no learned model here, and this file will not pretend otherwise. Covenda's
// scoring is rule-based and versioned (match-1.0.0), and Stage 5 — learned re-ranking — is
// gated at >= 50 completed outcomes by scorerGate() in api/hardening.js. That gate is the
// honest part of the product: a model trained on a handful of outcomes would be noise
// wearing a lab coat, and "AI-powered" over 6 data points is the exact overclaim the model
// card exists to prevent. What IS real and defensible today: hard filters that cannot be
// averaged away, transparent weights, evidence-cited explanations, a refusal path, and an
// offline eval harness. The flywheel this file feeds is what earns the model later.

import '../industry-taxonomy.js';
import { canonicalizeSkill } from './skills-taxonomy.js';

export const REQUIREMENT_VERSION = 'talent-requirement-1.0.0';

// Read the dependency-free shared taxonomy instead of importing the portal API and creating
// a circular graph. Legacy labels remain accepted while stored records migrate forward.
const TAXONOMY = globalThis.CovendaIndustryTaxonomy;
export const REQUIREMENT_VERTICALS = [
  ...TAXONOMY.groups.map(group => group.label),
  TAXONOMY.openChoice,
  ...Object.keys(TAXONOMY.legacyGroups).filter(label => !label.startsWith('Not sure')),
];
export const REQUIREMENT_WORK_TYPES = TAXONOMY.workTypes.map(workType => workType.value);

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const num = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const list = value => (Array.isArray(value) ? value : String(value ?? '').split(/[,\n]/))
  .map(v => clean(v, 60)).filter(Boolean).slice(0, 12);

// Build the requirement card. Everything is optional — a half-filled card still matches,
// just more loosely, and `completeness` says exactly what would sharpen it. Refusing to
// match until a form is perfect is how you lose the founder who had 90 seconds.
export function buildTalentRequirement(input = {}) {
  const verticals = list(input.verticals).filter(v => REQUIREMENT_VERTICALS.includes(v));
  const workTypes = list(input.workTypes).filter(w => REQUIREMENT_WORK_TYPES.includes(w));

  // Skills are canonicalised on the way in, so a company typing "JS" matches a student whose
  // evidence says "JavaScript". Unknown skills pass through unchanged — normalisation
  // unifies, it never drops.
  const required = list(input.requiredSkills).map(s => canonicalizeSkill(s).canonical || s);
  const preferred = list(input.preferredSkills).map(s => canonicalizeSkill(s).canonical || s);

  const requirement = {
    // Opportunity-shaped: these keys are what api/match.js already reads.
    title: clean(input.title, 160) || (verticals[0] ? `${verticals[0]} support` : 'Scoped project'),
    verticals,
    work_types: workTypes,
    required_skills: required,
    preferred_skills: preferred,
    hours_week: num(input.hoursPerWeek),
    duration_weeks: num(input.durationWeeks),
    complexity_rating: num(input.complexity),
    ambiguity_rating: num(input.ambiguity),
    founder_time_budget_min_week: num(input.reviewMinutesPerWeek),
    referral_requirement: ['required', 'preferred', 'none'].includes(input.referralRequirement)
      ? input.referralRequirement : 'preferred',
    experience_requirement: ['none', 'relevant_project', 'prior_internship', 'professional'].includes(input.experienceRequirement)
      ? input.experienceRequirement : 'none',
    // The company's own words. Kept verbatim and never scored — it is context for the human
    // reading the shortlist, and the raw input a future extractor re-runs over.
    problem: clean(input.problem, 4000),
    pastProject: clean(input.pastProject, 2000),
    batchSlug: clean(input.batchSlug, 60) || null,
    version: REQUIREMENT_VERSION,
  };
  return { ...requirement, completeness: requirementCompleteness(requirement) };
}

// What is missing, and what each gap costs the company in match quality. Explainable for the
// same reason every score is: a company should know why its shortlist is thin.
export function requirementCompleteness(requirement = {}) {
  const checks = [
    { key: 'verticals', ok: (requirement.verticals || []).length > 0,
      gain: 'Pick an industry — it decides which batch is searched at all.' },
    { key: 'required_skills', ok: (requirement.required_skills || []).length > 0,
      gain: 'Name a must-have skill — this becomes a hard filter, not a preference.' },
    { key: 'hours_week', ok: Boolean(requirement.hours_week),
      gain: 'State hours a week — availability is filtered, not averaged.' },
    { key: 'duration_weeks', ok: Boolean(requirement.duration_weeks),
      gain: 'Give a rough length so the work reads as bounded.' },
    { key: 'problem', ok: (requirement.problem || '').length >= 40,
      gain: 'Describe the problem — the shortlist explanation quotes it back to you.' },
    { key: 'review_time', ok: Boolean(requirement.founder_time_budget_min_week),
      gain: 'Set review minutes a week; we measure actual against it afterwards.' },
  ];
  const ready = checks.filter(c => c.ok).length;
  return {
    ready,
    total: checks.length,
    // A card can match from the first two answers. This is guidance, never a gate.
    matchable: (requirement.verticals || []).length > 0 || (requirement.required_skills || []).length > 0,
    gaps: checks.filter(c => !c.ok).map(({ key, gain }) => ({ key, gain })),
  };
}

// Narrow a candidate pool to the requirement's batch before ranking. Matching inside a batch
// is the whole point of batches: the pool is pre-vetted for that vertical, so the ranking
// runs over people who already cleared a published bar.
export function candidatesForRequirement(requirement, candidates = []) {
  const wantVerticals = new Set(requirement?.verticals || []);
  const batch = requirement?.batchSlug || null;
  return (candidates || []).filter(c => {
    if (batch && c.batch_slug && c.batch_slug !== batch) return false;
    if (!wantVerticals.size) return true;
    const theirs = Array.isArray(c.verticals) ? c.verticals : [];
    return theirs.length === 0 || theirs.some(v => wantVerticals.has(v));
  });
}
