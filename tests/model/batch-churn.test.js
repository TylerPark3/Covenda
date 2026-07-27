import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewMember, reviewBatch, CHURN_POLICY, removalMessage, productivity, memberActivity } from '../../api/batch-churn.js';

const NOW = '2026-07-27T00:00:00Z';
const ago = d => new Date(Date.parse(NOW) - d * 86400000).toISOString();

// The one rule with no exception.
test('a student mid-trial is never removed', () => {
  const r = reviewMember({ activeTrial: true, lastSubmissionAt: ago(200) }, { now: NOW, rank: 99, cohortSize: 10, waitlisted: 5 });
  assert.equal(r.action, 'keep');
  assert.equal(r.protected, true);
  assert.match(r.reason, /Never removed mid-trial/);
});

test('a declared absence is honoured', () => {
  const r = reviewMember({ declaredAbsenceUntil: ago(-30), lastSubmissionAt: ago(60) }, { now: NOW });
  assert.equal(r.action, 'keep');
  assert.equal(r.protected, true);
});

// A warning always lands before a removal.
test('the first message is a warning, never "you are out"', () => {
  const warned = reviewMember({ lastSubmissionAt: ago(CHURN_POLICY.warnAfterDays + 1) }, { now: NOW });
  assert.equal(warned.action, 'warn');
  assert.ok(warned.graceDays > 0);
  assert.ok(CHURN_POLICY.warnAfterDays < CHURN_POLICY.inactiveDays);
});

test('inactivity is an absolute bar, so it is explicable', () => {
  const r = reviewMember({ lastSubmissionAt: ago(CHURN_POLICY.inactiveDays + 5) }, { now: NOW });
  assert.equal(r.action, 'remove');
  assert.equal(r.basis, 'inactivity');
  assert.equal(r.appealable, true);
});

// Being bottom-5 in an exceptional cohort says nothing about you.
test('relative removal only runs when a seat is genuinely scarce', () => {
  const active = { lastSubmissionAt: ago(3) };
  const noWaitlist = reviewMember(active, { now: NOW, rank: 25, cohortSize: 20, waitlisted: 0 });
  assert.equal(noWaitlist.action, 'keep', 'no waitlist means no scarcity');

  const scarce = reviewMember(active, { now: NOW, rank: 25, cohortSize: 20, waitlisted: 4 });
  assert.equal(scarce.action, 'remove');
  assert.equal(scarce.basis, 'capacity');
  assert.match(scarce.reason, /for the seat, not for the work/);
});

test('productivity counts accepted work above applying above answering', () => {
  const a = memberActivity({ acceptedDeliverables: 1 }, NOW);
  const b = memberActivity({ applications: 3 }, NOW);
  const c = memberActivity({ correctAnswers: 20 }, NOW);
  assert.ok(productivity(a) > productivity(b));
  assert.ok(productivity(b) > productivity(c));
});

// Session time is deliberately absent from productivity.
test('being present is not productivity', () => {
  const src = memberActivity({ activeMinutes: 99999 }, NOW);
  assert.equal(productivity(src), 0);
});

test('a review caps removals and defers the rest for a human decision', () => {
  const stale = Array.from({ length: 12 }, (_, i) => ({ userId: `u${i}`, lastSubmissionAt: ago(90) }));
  const out = reviewBatch(stale, { now: NOW, capacity: 20, waitlisted: 0 });
  assert.equal(out.remove.length, CHURN_POLICY.maxRemovedPerReview);
  assert.equal(out.deferred.length, 12 - CHURN_POLICY.maxRemovedPerReview);
  assert.match(out.note, /not a cron job/);
});

test('nothing is ever automatic', () => {
  const out = reviewBatch([{ userId: 'a', lastSubmissionAt: ago(90) }], { now: NOW, capacity: 20 });
  assert.equal(out.binding, false);
});

// Removal has to be defensible to the club that vouched for them.
test('a capacity removal says it is not about their work', () => {
  const m = removalMessage({ basis: 'capacity' });
  assert.match(m.body, /not your work/);
  assert.equal(m.reapply, true);
});

test('nothing earned is lost on removal', () => {
  for (const basis of ['capacity', 'inactivity']) {
    assert.match(removalMessage({ basis }).body, /still stands|stays on your record/);
  }
});
