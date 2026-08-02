// The résumé reader. The tests that matter here are the ones that stop it becoming the
// thing D10 permanently forbids: a number about a person.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  skillsFromResumeText, coverageForRole, roleFitFromResume,
  RESUME_EVIDENCE_TIER, RESUME_FIT_VERSION,
} from '../../api/resume-fit.js';

const RESUME = `
Jordan Ellis — Columbia University, Class of 2027
Built a data pipeline in Python with pandas, shipped a React front-end,
and wrote the PostgreSQL schema. Comfortable with Git and Docker.
Interned on a team doing user research.
`;

const ROLE = {
  id: 'op-1',
  title: 'Backend intern',
  company_name: 'Northwind',
  required_skills: ['Python', 'SQL'],
  preferred_skills: ['Docker', 'Go'],
};

test('reads canonical skills out of résumé text', () => {
  const skills = skillsFromResumeText(RESUME).map(s => s.skill);
  assert.ok(skills.includes('Python'));
  assert.ok(skills.includes('React'));
  assert.ok(skills.includes('SQL'));       // via "PostgreSQL"
  assert.ok(skills.includes('Cloud & DevOps')); // via "Docker"
});

test('every extracted skill carries the quote it was read from', () => {
  const [first] = skillsFromResumeText(RESUME);
  assert.ok(first.context.length > 0);
  assert.ok(first.matched_phrase.length > 0);
  // A student must be able to see where a claim about their document came from.
  assert.ok(RESUME.toLowerCase().includes(first.matched_phrase.toLowerCase()));
});

test('every extracted skill is claimed-tier and nothing can quietly upgrade it', () => {
  for (const s of skillsFromResumeText(RESUME)) {
    assert.equal(s.tier, RESUME_EVIDENCE_TIER);
    assert.equal(s.tier, 'claimed');
  }
});

test('extraction never emits a level, rating or score for a skill', () => {
  for (const s of skillsFromResumeText(RESUME)) {
    for (const key of ['score', 'level', 'rating', 'proficiency', 'strength', 'value']) {
      assert.equal(key in s, false, `résumé skills must not carry a ${key}`);
    }
  }
});

test('word boundaries hold — "Go" does not match "going", "R" does not match everything', () => {
  const skills = skillsFromResumeText('I am going to the store and running errands.').map(s => s.skill);
  assert.equal(skills.includes('Go'), false);
});

test('punctuation-tailed skills still match (C++, C#, CI/CD)', () => {
  const skills = skillsFromResumeText('Wrote C++ for the solver.').map(s => s.skill);
  assert.ok(skills.includes('C++'));
});

test('coverage is per-role and names what is missing', () => {
  const result = coverageForRole(ROLE, skillsFromResumeText(RESUME));
  assert.equal(result.opportunity_id, 'op-1');
  assert.ok(result.covered.map(c => c.skill).includes('Python'));
  assert.ok(result.missing.includes('Go'));
  assert.equal(result.required_missing.length, 0); // Python + SQL both present
  assert.equal(result.evidence_tier, 'claimed');
});

test('coverage percentage is a claim about the document, and says so', () => {
  const result = coverageForRole(ROLE, skillsFromResumeText(RESUME));
  assert.equal(typeof result.coverage_pct, 'number');
  assert.match(result.caveat, /not verified|Nothing here is verified/i);
  assert.match(result.caveat, /does not affect any shortlist/i);
});

test('a role that names no skills yields no coverage number to misread', () => {
  const result = coverageForRole({ id: 'x', title: 'Vague role' }, skillsFromResumeText(RESUME));
  assert.equal(result.coverage_pct, null);
  assert.match(result.reading, /has not named the skills/);
});

test('full coverage still says mentioning is not evidence', () => {
  const role = { id: 'r', title: 'Py', required_skills: ['Python'] };
  const result = coverageForRole(role, skillsFromResumeText(RESUME));
  assert.equal(result.coverage_pct, 100);
  assert.match(result.reading, /Mentioning is not evidence/);
});

test('D10 — the output contains no universal score for the person', () => {
  const out = roleFitFromResume(RESUME, [ROLE, { id: 'op-2', title: 'Data', required_skills: ['Python', 'Data analysis'] }]);
  const json = JSON.stringify(out);
  // Every number must be attached to a role. There must be no top-level person score.
  for (const forbidden of ['overall_score', 'employability', 'skill_score', 'candidate_score',
    'total_score', 'rating', 'percentile', 'rank_overall']) {
    assert.equal(json.includes(forbidden), false, `must not emit ${forbidden}`);
  }
  assert.equal('score' in out, false);
  assert.equal('coverage_pct' in out, false, 'coverage exists per role, never for the person');
  for (const role of out.roles) assert.equal(typeof role.opportunity_id !== 'undefined', true);
});

test('roles are ranked by coverage, and the gap list is the actionable output', () => {
  const roles = [
    { id: 'a', title: 'A', required_skills: ['Python', 'SQL'] },
    { id: 'b', title: 'B', required_skills: ['Rust', 'Go'] },
  ];
  const out = roleFitFromResume(RESUME, roles);
  assert.equal(out.refused, false);
  assert.equal(out.roles[0].opportunity_id, 'a');
  assert.ok(out.worth_verifying.length > 0);
  assert.ok(out.worth_verifying.every(w => typeof w.roles_wanting === 'number'));
});

test('an unreadable résumé refuses rather than returning an empty ranking', () => {
  const out = roleFitFromResume('   ', [ROLE]);
  assert.equal(out.refused, true);
  assert.equal(out.roles, undefined);
  assert.ok(out.reasons.some(r => /image-only scan/.test(r)));
  // The refusal must not read as a judgement about the person.
  assert.match(out.next_step, /not a judgement about your experience/);
});

test('a résumé with no taxonomy hits refuses for the same reason', () => {
  const out = roleFitFromResume('I enjoy long walks and thinking about problems.', [ROLE]);
  assert.equal(out.refused, true);
});

test('roles with no named skills are dropped, not shown as 0%', () => {
  const out = roleFitFromResume(RESUME, [ROLE, { id: 'empty', title: 'Unscoped' }]);
  assert.equal(out.roles.some(r => r.opportunity_id === 'empty'), false);
});

test('output is versioned so a change in reading is traceable', () => {
  const out = roleFitFromResume(RESUME, [ROLE]);
  assert.equal(out.scorer_version, RESUME_FIT_VERSION);
  assert.ok(out.taxonomy_version);
});

test('handles a missing opportunity list without throwing', () => {
  assert.equal(roleFitFromResume(RESUME, null).roles.length, 0);
  assert.equal(roleFitFromResume(RESUME, undefined).refused, false);
});
