import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGES, stageState, adjudicate, decide, processSummary, PASS_MARK, RATER_SPLIT_THRESHOLD,
} from '../../api/vetting-software.js';

const FULL = {
  ownershipVerified: true, analysedRepos: 3, historyDays: 180,
  defenseRecordedAt: '2026-07-27T00:00:00Z', raterScores: [{ score: 7 }, { score: 6 }],
};

// The rule the whole process rests on.
test('automated signal alone can never admit anyone', () => {
  const automatedOnly = { ownershipVerified: true, analysedRepos: 5, historyDays: 900 };
  const r = decide({ evidence: automatedOnly });
  assert.equal(r.decision, 'in_progress');
  assert.equal(r.nextStage, 'defense', 'the human stage is what is left');
});

test('the summary says plainly what reading code cannot tell you', () => {
  const s = processSummary();
  assert.match(s.honesty, /cannot tell anyone whether the thinking was good/);
  assert.equal(s.human >= 1, true);
});

// A missing prerequisite is a queue position, not a rejection.
test('a stage that cannot run yet says "not yet", never "failed"', () => {
  const s = stageState('defense', { ownershipVerified: true });
  assert.equal(s.state, 'waiting');
  assert.match(s.message, /Analyse a repository first/);
  assert.equal(s.canStart, false);
});

test('stages unlock in order', () => {
  assert.equal(stageState('connect', {}).state, 'open');
  assert.equal(stageState('analyse', {}).state, 'waiting');
  assert.equal(stageState('analyse', { ownershipVerified: true }).state, 'open');
  assert.equal(stageState('connect', { ownershipVerified: true }).state, 'done');
});

// Averaging 4 and 9 gives 6.5 — a number neither rater would defend.
test('a wide rater split goes to a third reader instead of being averaged', () => {
  const r = adjudicate([{ score: 4 }, { score: 9 }]);
  assert.equal(r.resolved, false);
  assert.equal(r.needsThirdRater, true);
  assert.match(r.reason, /neither of them would defend/);
  assert.ok(r.spread >= RATER_SPLIT_THRESHOLD);
});

test('close raters resolve without a third', () => {
  const r = adjudicate([{ score: 6 }, { score: 7 }]);
  assert.equal(r.resolved, true);
  assert.equal(r.score, 6.5);
});

test('three raters take the median, so the outlier does not drag the result', () => {
  const r = adjudicate([{ score: 4 }, { score: 9 }, { score: 7 }]);
  assert.equal(r.resolved, true);
  assert.equal(r.score, 7);
});

test('one rater is never enough', () => {
  assert.equal(adjudicate([{ score: 9 }]).resolved, false);
});

// Admission stays a person's decision.
test('clearing the bar is a recommendation, not an admission', () => {
  const r = decide({ evidence: FULL, adjudication: { resolved: true, score: 8 } });
  assert.equal(r.decision, 'admit');
  assert.equal(r.binding, false);
  assert.match(r.message, /operator confirms every admission/);
});

test('falling short points at the cheapest thing to improve', () => {
  const r = decide({ evidence: FULL, adjudication: { resolved: true, score: 4 } });
  assert.equal(r.decision, 'not_yet');
  assert.match(r.message, /walkthrough is the fastest thing to improve/);
  assert.ok(r.score < PASS_MARK);
});

test('a student is told how long the rest of it takes', () => {
  const r = decide({ evidence: { ownershipVerified: true } });
  assert.ok(r.minutesRemaining > 0);
  assert.ok(processSummary().totalMinutes >= r.minutesRemaining);
});

test('every stage explains why it exists, not just what it is', () => {
  for (const s of STAGES) {
    assert.ok(s.why && s.why.length > 20, `${s.key} needs a why`);
    assert.ok(s.blockedMessage, `${s.key} needs an actionable blocked message`);
  }
});
