import test from 'node:test';
import assert from 'node:assert/strict';
import { VERTICALS, WORK_TYPES } from '../../api/portal.js';
import { matchOpportunity } from '../../api/match.js';
import {
  REQUIREMENT_VERSION, REQUIREMENT_VERTICALS, REQUIREMENT_WORK_TYPES,
  buildTalentRequirement, requirementCompleteness, candidatesForRequirement,
} from '../../api/talent-profile.js';

// Drift guard: the requirement card declares the taxonomy locally to avoid a circular
// import, so it must be pinned to the portal's canonical sets.
test('requirement taxonomy stays in sync with the portal', () => {
  assert.deepEqual(REQUIREMENT_VERTICALS, [...VERTICALS].filter(v => !v.startsWith('Not sure')));
  assert.deepEqual(REQUIREMENT_WORK_TYPES, [...WORK_TYPES]);
});

test('a requirement card is opportunity-shaped, so the existing matcher takes it directly', () => {
  const req = buildTalentRequirement({
    verticals: ['Software & AI'], workTypes: ['QA & testing'],
    requiredSkills: 'JS, Testing', hoursPerWeek: 10, durationWeeks: 4,
    reviewMinutesPerWeek: 60, problem: 'Our regression suite is flaky and nobody owns it, so releases keep slipping.',
  });
  for (const key of ['required_skills', 'hours_week', 'duration_weeks', 'referral_requirement', 'experience_requirement']) {
    assert.ok(key in req, `matcher reads ${key}`);
  }
  assert.equal(req.version, REQUIREMENT_VERSION);
  // A company typing "JS" must reach a student whose evidence says "JavaScript".
  assert.ok(req.required_skills.includes('JavaScript'), `expected canonicalised skill, got ${req.required_skills}`);
});

test('off-taxonomy verticals are dropped rather than passed through', () => {
  const req = buildTalentRequirement({ verticals: ['Software & AI', 'Crypto moonshots'], workTypes: ['Nonsense'] });
  assert.deepEqual(req.verticals, ['Software & AI']);
  assert.deepEqual(req.work_types, []);
});

test('a half-filled card still matches, and says what would sharpen it', () => {
  const req = buildTalentRequirement({ verticals: ['Software & AI'] });
  assert.equal(req.completeness.matchable, true, 'must not gate on a complete form');
  assert.ok(req.completeness.gaps.length > 0);
  for (const gap of req.completeness.gaps) assert.ok(gap.gain, `gap ${gap.key} must say what it buys`);
});

test('an empty card is not matchable and says so plainly', () => {
  const req = buildTalentRequirement({});
  assert.equal(req.completeness.matchable, false);
  assert.equal(req.completeness.ready, 0);
});

test('the company problem statement is kept verbatim and never scored', () => {
  const problem = 'Vendor invoices pile up for three years and month-end close slips a week every time.';
  const req = buildTalentRequirement({ verticals: ['Accounting & finance'], problem });
  assert.equal(req.problem, problem);
  assert.equal(req.problemScore, undefined);
});

test('candidates are narrowed to the requested batch before ranking', () => {
  const req = buildTalentRequirement({ verticals: ['Software & AI'], batchSlug: 'software-ai' });
  const pool = [
    { id: 'a', batch_slug: 'software-ai', verticals: ['Software & AI'] },
    { id: 'b', batch_slug: 'accounting-finance', verticals: ['Accounting & finance'] },
    { id: 'c', verticals: [] }, // unstated vertical is never excluded on missing data
  ];
  const ids = candidatesForRequirement(req, pool).map(c => c.id);
  assert.deepEqual(ids, ['a', 'c']);
});

// End to end: a card built by a company runs through the real engine and honours its caps.
test('a requirement card runs through the real matcher and keeps k=3 and the refusal path', () => {
  const req = buildTalentRequirement({
    verticals: ['Software & AI'], requiredSkills: 'JavaScript', hoursPerWeek: 8, durationWeeks: 4,
  });
  const candidate = n => ({
    id: `s${n}`, availability_hours_week: 20, completed_projects: 1,
    skill_claims: [{ skill: 'JavaScript', verification_tier: 'artifact', evidence_pointer: `https://github.com/x/${n}` }],
  });
  const many = matchOpportunity(req, [1, 2, 3, 4, 5].map(candidate), { k: 3 });
  assert.ok((many.shortlist || many.candidates || []).length <= 3, 'the k=3 cap must survive');

  // Nobody with the must-have skill -> refuse rather than pad.
  const none = matchOpportunity(req, [{ id: 'x', availability_hours_week: 20, skill_claims: [] }], { k: 3 });
  const picked = none.shortlist || none.candidates || [];
  assert.equal(picked.length, 0, 'a weak pool must produce a refusal, never a padded shortlist');
});

test('completeness is pure and repeatable', () => {
  const req = buildTalentRequirement({ verticals: ['Software & AI'], requiredSkills: 'JavaScript' });
  assert.deepEqual(requirementCompleteness(req), requirementCompleteness(req));
});
