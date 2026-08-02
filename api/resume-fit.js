// Résumé → open roles: what your résumé covers, role by role.
//
// ── THE PROBLEM THIS SOLVES ───────────────────────────────────────────────────────────
// A student attaches a résumé and nothing happens with it. `resume-interview.js` says so
// out loud: "it does not store the résumé text, and it does not score anything." Meanwhile
// `rankOpportunities` already ranks open roles per student — but off the profile, not off
// the résumé the student just spent ten minutes attaching.
//
// ── WHAT THIS IS NOT ──────────────────────────────────────────────────────────────────
// It is NOT a compatibility score, NOT a shortlist score, and NOT a number about a person.
//
//   * D10 is permanent: no universal skill score, no universal employability score. Every
//     number here is bound to ONE role. There is no field in this output that scores the
//     student alone, and `assertNoUniversalScore` in the tests holds that line.
//
//   * A résumé is CLAIMED evidence — self-asserted, no pointer. api/match.js weights the
//     'claimed' tier at exactly 0 and excludes it from matching, which is right: a company
//     shortlist must not move on something nobody verified. So this deliberately does not
//     feed matchOpportunity(), and a company sees none of it.
//
// What it produces is a student-facing READING of their own résumé against each open role:
// which named skills the résumé mentions, which it does not, and precisely what would make
// each mention count as evidence. The useful output is the gap list, not the percentage.
//
// ── WHY COVERAGE AND NOT FIT ──────────────────────────────────────────────────────────
// "Coverage" is a claim about the document: this résumé mentions 4 of the 6 skills this
// role names. That is checkable by reading it. "Fit" would be a claim about the person,
// which nothing here is entitled to make.
//
// Pure functions, no I/O.

// EXTRACTION LIVES IN api/roles.js, NOT HERE.
// The first version of this file reimplemented skill extraction with its own probe list and
// its own matcher. api/roles.js already had one — a better one. Its regex uses lookarounds
// and its comments record a real bug that version had already fixed: a probe at the END of a
// sentence never matched, so "comfortable in Python and SQL." found neither. The duplicate
// would have shipped that bug again, and two extractors would tell a student two different
// stories about the same document. locateSkills() is extractSkills() plus the quote.
import { locateSkills } from './roles.js';
import { canonicalizeSkill, TAXONOMY_VERSION } from './skills-taxonomy.js';

export const RESUME_FIT_VERSION = 'resume-fit-1.0.0';

// Résumé text is self-asserted. This constant exists so the tier is never accidentally
// upgraded by a caller: everything this module emits is at this tier, always.
export const RESUME_EVIDENCE_TIER = 'claimed';

const asList = v => (Array.isArray(v) ? v : String(v || '').split(/[,\n]/))
  .map(s => String(s || '').trim()).filter(Boolean);

// Skills a résumé MENTIONS, each with the quote it was read from. Never a level, a rating or
// a score — a résumé cannot establish proficiency, only that a word appears in a document.
export function skillsFromResumeText(text) {
  return locateSkills(text).map(({ index, ...rest }) => ({ ...rest, tier: RESUME_EVIDENCE_TIER }));
}

// One role, read against one résumé. Returns coverage of the role's NAMED skills plus the
// gap list — and states its own limits in the payload, so a UI cannot render the number
// without the caveat travelling with it.
export function coverageForRole(opportunity, resumeSkills) {
  const required = asList(opportunity?.required_skills ?? opportunity?.desired_skills)
    .map(s => canonicalizeSkill(s).canonical);
  const preferred = asList(opportunity?.preferred_skills).map(s => canonicalizeSkill(s).canonical);
  const named = [...new Set([...required, ...preferred])];
  const have = new Map((resumeSkills || []).map(s => [s.skill, s]));

  const covered = [];
  const missing = [];
  for (const skill of named) {
    const hit = have.get(skill);
    if (hit) covered.push({ skill, matched_phrase: hit.matched_phrase, context: hit.context });
    else missing.push(skill);
  }
  const requiredMissing = required.filter(s => !have.has(s));

  return {
    opportunity_id: opportunity?.id ?? null,
    title: opportunity?.title || opportunity?.role || 'Open role',
    company: opportunity?.company_name || opportunity?.organization_name || null,
    // Coverage of the skills THIS role names. Not a fit score, not a person score.
    named_skill_count: named.length,
    covered_count: covered.length,
    coverage_pct: named.length ? Math.round((covered.length / named.length) * 100) : null,
    covered,
    missing,
    required_missing: requiredMissing,
    // The honest headline, computed not written: a résumé that names everything still
    // proves nothing, and the student should be told that in the same breath as the number.
    reading: named.length === 0
      ? 'This role has not named the skills it needs yet, so there is nothing to read your résumé against.'
      : requiredMissing.length
        ? `Your résumé does not mention ${requiredMissing.length} skill${requiredMissing.length === 1 ? '' : 's'} this role names as required.`
        : covered.length === named.length
          ? 'Your résumé mentions every skill this role names. Mentioning is not evidence — the next step is showing one of them.'
          : 'Your résumé mentions every required skill this role names.',
    evidence_tier: RESUME_EVIDENCE_TIER,
    caveat: 'Read from your résumé text only. Nothing here is verified, no company sees it, and it does not affect any shortlist.',
    scorer_version: RESUME_FIT_VERSION,
    taxonomy_version: TAXONOMY_VERSION,
  };
}

// The whole feature: one résumé, every open role, ordered by how much of each role the
// résumé speaks to. Returns a REFUSAL rather than a misleading empty ranking when the
// résumé yields nothing readable.
export function roleFitFromResume(text, opportunities, { limit = 10 } = {}) {
  const resumeSkills = skillsFromResumeText(text);
  const roles = Array.isArray(opportunities) ? opportunities : [];

  if (!resumeSkills.length) {
    return {
      refused: true,
      message: 'No recognisable skills were read from this résumé.',
      reasons: [
        'The document may be an image-only scan with no extractable text.',
        'It may describe work in words the seed taxonomy does not cover yet.',
      ],
      next_step: 'Add skills to your profile directly — the taxonomy is a seed vocabulary, not a judgement about your experience.',
      resume_skills: [],
      scorer_version: RESUME_FIT_VERSION,
    };
  }

  const scored = roles
    .map(o => coverageForRole(o, resumeSkills))
    .filter(r => r.named_skill_count > 0)
    .sort((a, b) => b.coverage_pct - a.coverage_pct || a.missing.length - b.missing.length)
    .slice(0, limit);

  // The gap list across roles is the actionable output: verify these first.
  const gapCounts = new Map();
  for (const r of scored) for (const skill of r.missing) {
    gapCounts.set(skill, (gapCounts.get(skill) || 0) + 1);
  }
  const worthVerifying = [...gapCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill, roles_wanting]) => ({ skill, roles_wanting }));

  return {
    refused: false,
    resume_skills: resumeSkills,
    roles: scored,
    // Explicitly per-role. There is no aggregate number here, by design (D10).
    worth_verifying: worthVerifying,
    evidence_tier: RESUME_EVIDENCE_TIER,
    caveat: 'Read from your résumé text only. Nothing here is verified, no company sees it, and it does not affect any shortlist.',
    scorer_version: RESUME_FIT_VERSION,
    taxonomy_version: TAXONOMY_VERSION,
  };
}
