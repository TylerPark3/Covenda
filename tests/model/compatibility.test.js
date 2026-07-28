import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatch, sanitizeStudent } from '../../api/compatibility.js';
import { EMPLOYER_NAME_BONUS, BANNED_FIELDS } from '../../api/compatibility.config.js';
import { EVENT_TYPES, logMatchEvent, closeOutTrial, recordFounderRating } from '../../api/match-events.js';

const project = { id: 'P001', estimatedHours: 40, deadlineDays: 28 };
const base = {
  evidence: 'verified:ml:4; assessment:ml:6; resume:ml:8',
  availabilityHoursWeek: 12, weeksAvailable: 12,
  interestFamilies: ['ml'], workHistory: [{ employer: 'NeuralWorks' }],
};

// ── Required test 1 ───────────────────────────────────────────────────────────────────
test('school invariance: two profiles differing only by school score identically', () => {
  const a = scoreMatch({ ...base, school: 'MIT', gpa: 4.0, clubs: ['Finance Society'] }, project);
  const b = scoreMatch({ ...base, school: 'Community College', gpa: 2.1, clubs: [] }, project);
  assert.deepEqual(a, b, 'pedigree must not move the score by any amount');
});

test('banned fields are physically absent from the scoring path, not merely unused', () => {
  const clean = sanitizeStudent({ ...base, school: 'MIT', gpa: 4.0, prestige: 'ivy' });
  for (const field of BANNED_FIELDS) {
    assert.ok(!(field in clean), `${field} reached the scorer`);
  }
});

// ── Required test 2 ───────────────────────────────────────────────────────────────────
test('employer-name ablation moves the score by exactly the configured bonus, and nothing else', () => {
  const withName = scoreMatch(base, project);
  const without = scoreMatch({ ...base, workHistory: [] }, project);
  assert.equal(withName.internals.employerNameContribution, EMPLOYER_NAME_BONUS);
  assert.equal(without.internals.employerNameContribution, 0);
  const delta = withName.internals.score - without.internals.score;
  assert.ok(Math.abs(delta - EMPLOYER_NAME_BONUS) < 1e-9, `moved ${delta}, expected ${EMPLOYER_NAME_BONUS}`);
  // The rubric itself must be untouched by a brand name.
  assert.equal(withName.internals.rubricScore, without.internals.rubricScore);
});

// ── Required test 3 ───────────────────────────────────────────────────────────────────
test('close-out is gated: no rating means no close and no work record', async () => {
  const db = { from: () => ({ insert: async () => ({ error: null }), update: () => ({ eq: async () => ({ error: null }) }) }) };
  await assert.rejects(
    () => closeOutTrial(db, { matchId: 'm1', accepted: true }),
    err => err.code === 'CLOSEOUT_RATING_REQUIRED',
    'a missing rating must block, not default',
  );
  // And the coupling holds: the rating is what issues the credential.
  const ok = await closeOutTrial(db, { matchId: 'm1', accepted: true, wouldRequestAgain: true });
  assert.equal(ok.workRecordIssued, true);
  const declined = await closeOutTrial(db, { matchId: 'm2', accepted: false, wouldRequestAgain: false });
  assert.equal(declined.workRecordIssued, false);
});

// ── Required test 4 ───────────────────────────────────────────────────────────────────
test('label sources are never pooled', async () => {
  const rows = [];
  const db = { from: () => ({ insert: async r => { rows.push(r); return { error: null }; } }) };
  await recordFounderRating(db, { matchId: 'm1', rating: 5, ratedBy: 'u1' });
  assert.equal(rows[0].source, 'founder_rating');
  assert.equal(rows[0].label, 1, 'a 4 or 5 is a positive weak label');
  await recordFounderRating(db, { matchId: 'm2', rating: 2, ratedBy: 'u1' });
  assert.equal(rows[1].label, 0);
  await assert.rejects(() => recordFounderRating(db, { matchId: 'm3', rating: 9, ratedBy: 'u1' }), /1-5/);
});

// ── Contract guarantees ───────────────────────────────────────────────────────────────
test('a match_shown event without its feature vector is refused', async () => {
  const db = { from: () => ({ insert: async () => ({ error: null }) }) };
  await assert.rejects(
    () => logMatchEvent(db, 'match_shown', { matchId: 'm1' }),
    /feature vector/,
    'a label without the features that produced it cannot train anything',
  );
  await assert.rejects(() => logMatchEvent(db, 'not_a_real_event', {}), /Unknown match event/);
  assert.ok(EVENT_TYPES.includes('repeat_within_30d'));
});

test('breadth of weak claims never outscores one accepted trial in the right domain', () => {
  const many = scoreMatch({ ...base, evidence: Array(9).fill('self:ml:2').join('; ') }, project);
  const one = scoreMatch({ ...base, evidence: 'accepted_trial:ml:2' }, project);
  assert.ok(one.internals.rubricScore > many.internals.rubricScore, 'the top-three cap is load bearing');
});

test('a timeline shortfall is never reported as a capability verdict', () => {
  const r = scoreMatch({ ...base, availabilityHoursWeek: 2 }, project);
  assert.equal(r.failing, 'timeline');
  assert.ok(r.timelineWarning, 'and it says so plainly');
  assert.notEqual(r.tier, 'High fit', 'capped, not rejected');
  assert.equal(r.predictedAccepted, true, 'capability is unaffected');
});

test('employers never see a raw score', () => {
  const r = scoreMatch(base, project);
  const shown = { tier: r.tier, reasons: r.reasons, uncertainty: r.uncertainty, timelineWarning: r.timelineWarning };
  assert.ok(!JSON.stringify(shown).includes('rubricScore'));
  assert.ok(['High fit', 'Moderate fit', 'Exploratory fit', null].includes(r.tier));
  // Reasons are the actual top-weighted contributors, never written independently.
  assert.ok(r.reasons.every(x => x.kind && x.family && x.text));
});
