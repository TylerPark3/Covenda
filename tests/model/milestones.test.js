import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MILESTONE_VERSION, SILENCE_GRACE_HOURS,
  buildMilestoneSchedule, evaluateMilestones, reassignmentDecision,
  founderTimeVariance, outcomeSummary,
} from '../../api/milestones.js';

const START = '2026-08-01T09:00:00.000Z';
const at = (isoDays, hours = 0) => new Date(Date.parse(isoDays) + hours * 3600_000).toISOString();

test('the first checkpoint lands inside the 24-72h window the spec requires', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  assert.equal(rows.length, 3);
  const gapHours = (Date.parse(rows[0].due_at) - Date.parse(START)) / 3600_000;
  assert.ok(gapHours >= 24 && gapHours <= 72, `first checkpoint at ${gapHours}h is outside 24-72h`);
  // Due dates strictly increase and the last one lands on the finish date, not past it.
  for (let i = 1; i < rows.length; i++) {
    assert.ok(Date.parse(rows[i].due_at) > Date.parse(rows[i - 1].due_at));
  }
  const spanDays = (Date.parse(rows.at(-1).due_at) - Date.parse(START)) / 86_400_000;
  assert.ok(spanDays <= 28.01, `final milestone at ${spanDays}d overruns a 4-week project`);
});

test('milestones unlock sequentially — N+1 stays locked until N is submitted', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  const evaluation = evaluateMilestones(rows, at(START, 1));
  assert.equal(evaluation.milestones[0].status, 'open');
  assert.equal(evaluation.milestones[1].status, 'locked');
  assert.equal(evaluation.milestones[2].status, 'locked');
  assert.equal(evaluation.activeIndex, 0);
});

test('submitting the first milestone unlocks the second', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  rows[0].submitted_at = at(START, 40);
  const evaluation = evaluateMilestones(rows, at(START, 41));
  assert.equal(evaluation.milestones[0].status, 'submitted');
  assert.equal(evaluation.milestones[0].onTime, true);
  assert.equal(evaluation.milestones[1].status, 'open');
  assert.equal(evaluation.submittedCount, 1);
  assert.equal(evaluation.onTimeCount, 1);
});

test('a late submission is recorded as submitted but not on time', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  rows[0].submitted_at = at(START, 60); // due at 48h
  const evaluation = evaluateMilestones(rows, at(START, 61));
  assert.equal(evaluation.milestones[0].status, 'submitted');
  assert.equal(evaluation.milestones[0].onTime, false);
  assert.equal(evaluation.onTimeCount, 0);
});

// The distinction the whole flake defense rests on.
test('late-but-communicating never escalates to missed, however long it runs', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  rows[0].student_notice_at = at(START, 47); // told us before the 48h due date
  const evaluation = evaluateMilestones(rows, at(START, 48 + SILENCE_GRACE_HOURS + 200));
  assert.equal(evaluation.milestones[0].status, 'late');
  assert.equal(evaluation.milestones[0].communicated, true);
  const decision = reassignmentDecision(evaluation, { backup_user_id: 'backup-1' });
  assert.equal(decision.action, 'none');
  assert.match(decision.reason, /gave notice/i);
});

test('silence inside the grace window notifies rather than reassigning', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  const evaluation = evaluateMilestones(rows, at(START, 52)); // 4h past due
  assert.equal(evaluation.milestones[0].status, 'late');
  const decision = reassignmentDecision(evaluation, { backup_user_id: 'backup-1' });
  assert.equal(decision.action, 'notify');
  assert.ok(decision.overdueHours > 0);
});

test('silence past the grace window reassigns to the pre-selected backup, and records it', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  rows[0].notified_at = at(START, 52);
  const now = at(START, 48 + SILENCE_GRACE_HOURS + 1);
  const evaluation = evaluateMilestones(rows, now);
  assert.equal(evaluation.milestones[0].status, 'missed');
  const decision = reassignmentDecision(evaluation, { backup_user_id: 'backup-1' }, now);
  assert.equal(decision.action, 'reassign');
  assert.equal(decision.backupUserId, 'backup-1');
  assert.equal(decision.record.reassigned, true);
  assert.ok(decision.record.reassigned_at, 'reassignment must be timestamped, never silent');
});

// Dropping the company without a replacement is not a defense.
test('a missed milestone with no backup escalates to an operator instead of reassigning', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  const now = at(START, 48 + SILENCE_GRACE_HOURS + 1);
  const evaluation = evaluateMilestones(rows, now);
  const decision = reassignmentDecision(evaluation, {}, now);
  assert.equal(decision.action, 'escalate');
  assert.equal(decision.requiresOperator, true);
  assert.equal(decision.backupUserId, undefined);
});

test('founder time variance names an overrun as loose scope, not a bad student', () => {
  assert.equal(founderTimeVariance({}).known, false);
  const within = founderTimeVariance({ founder_time_budget_min_week: 60, founder_time_actual_min_week: 45 });
  assert.equal(within.withinBudget, true);
  assert.equal(within.verdict, 'within_budget');
  const over = founderTimeVariance({ founder_time_budget_min_week: 60, founder_time_actual_min_week: 80 });
  assert.equal(over.verdict, 'over_budget');
  assert.equal(over.deltaMin, 20);
  const blown = founderTimeVariance({ founder_time_budget_min_week: 60, founder_time_actual_min_week: 200 });
  assert.equal(blown.verdict, 'scope_too_loose');
});

test('outcome summary carries difficulty alongside the result', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  rows[0].submitted_at = at(START, 40);
  const summary = outcomeSummary(
    { id: 'p1', completed_at: at(START, 700), complexity_rating: 5, ambiguity_rating: 4,
      founder_time_budget_min_week: 60, founder_time_actual_min_week: 55, milestones: rows },
    evaluateMilestones(rows, at(START, 700)),
  );
  assert.equal(summary.shipped, true);
  assert.equal(summary.complexityRating, 5);
  assert.equal(summary.ambiguityRating, 4);
  assert.equal(summary.founderTime.withinBudget, true);
  assert.equal(summary.version, MILESTONE_VERSION);
  // No overall person score here either.
  assert.equal(summary.score, undefined);
});

test('evaluation is pure — same inputs, same output, no clock of its own', () => {
  const rows = buildMilestoneSchedule({ duration_weeks: 4 }, { startAt: START });
  const a = evaluateMilestones(rows, at(START, 52));
  const b = evaluateMilestones(rows, at(START, 52));
  assert.deepEqual(a, b);
});

test('missing or malformed data degrades instead of throwing', () => {
  assert.deepEqual(buildMilestoneSchedule({}, {}), []);
  const empty = evaluateMilestones(null, START);
  assert.equal(empty.total, 0);
  assert.equal(empty.activeIndex, -1);
  assert.equal(reassignmentDecision(empty, {}).action, 'none');
  const junk = evaluateMilestones([{ due_at: 'not-a-date' }], START);
  assert.equal(junk.milestones[0].status, 'open');
});

// Stage 4 was fully built, fully tested, and imported by NOTHING — the flake defense never
// ran. These pin the two seams that make it real.
// The schedule now starts when the STUDENT starts, not when the company approves them.
// A clock that begins at approval makes someone late for work they never agreed to open.
test('the milestone clock starts when the student starts, in one write', async () => {
  const portal = await readFile(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(portal, /import \{ buildMilestoneSchedule/);
  assert.match(portal, /const milestones = buildMilestoneSchedule\(project, \{ startAt: now \}\)/);
  // Written in the same update that moves the project in progress — not a second write that
  // can fail on its own and leave a running project with no schedule.
  assert.match(portal, /status: 'in_progress',[\s\S]{0,200}milestones/);
  // And approving no longer lays a schedule down.
  const accept = portal.slice(portal.indexOf('export async function acceptApplication'));
  const acceptBody = accept.slice(0, accept.indexOf('export async function startTrial'));
  assert.doesNotMatch(acceptBody, /buildMilestoneSchedule/);
});

test('submitting a deliverable marks the milestone rather than asserting on-time later', async () => {
  const portal = await readFile(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(portal, /function markMilestoneSubmitted\(/);
  assert.match(portal, /function projectMilestoneState\(/);
  // The action is a recommendation the operator acts on, never an automatic mutation.
  assert.match(portal, /action: reassignmentDecision\(evaluation, project \|\| \{\}, now\)/);
});
