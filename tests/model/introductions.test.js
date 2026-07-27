import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkIntroduction, applyResponse, STUDENT_RESPONSES,
  OUTCOME_QUESTIONS, REQUIRED_OUTCOME_KEYS, normaliseOutcome,
  referralStatus, REFERRAL_GATES,
} from '../../api/introductions.js';

const FULL = {
  roleSummary: 'Two-week data cleanup', whyRelevant: 'You shipped a similar pipeline',
  compensation: '$600 flat', timeCommitment: '10 hrs/week for 2 weeks', nextStep: 'A 20-minute call',
};

// An introduction missing the money or the hours is how students get strung along.
test('an introduction must state the work, the money, the time and the next step', () => {
  assert.equal(checkIntroduction(FULL).ok, true);
  for (const key of Object.keys(FULL)) {
    const r = checkIntroduction({ ...FULL, [key]: '' });
    assert.equal(r.ok, false, `${key} should be required`);
  }
});

test('"competitive" is not compensation a student can weigh', () => {
  for (const pay of ['TBD', 'Competitive', 'negotiable', 'DOE']) {
    const r = checkIntroduction({ ...FULL, compensation: pay });
    assert.equal(r.ok, false, pay);
    assert.match(r.reason, /Say the number, a range, or "unpaid"/);
  }
  // Unpaid is allowed — a student can accept that. A vague promise they cannot.
  assert.equal(checkIntroduction({ ...FULL, compensation: 'Unpaid' }).ok, true);
});

// Declining and reporting are first-class, not buried.
test('a student can accept, ask, decline or report', () => {
  assert.deepEqual(STUDENT_RESPONSES, ['accepted', 'question', 'declined', 'reported']);
  assert.equal(applyResponse({ status: 'sent' }, 'declined').status, 'declined');
  assert.equal(applyResponse({ status: 'sent' }, 'reported').status, 'reported');
});

test('a question needs the question attached', () => {
  assert.throws(() => applyResponse({ status: 'sent' }, 'question'), /Add your question/);
  assert.equal(applyResponse({ status: 'sent' }, 'question', 'Is this remote?').student_response, 'Is this remote?');
});

test('an answered introduction cannot be answered again', () => {
  assert.throws(() => applyResponse({ status: 'declined' }, 'accepted'), /already been answered/);
});

// ── Outcomes ──────────────────────────────────────────────────────────────────────────
test('all seven outcome questions exist and only the two that change what we do are required', () => {
  assert.equal(OUTCOME_QUESTIONS.length, 7);
  assert.deepEqual(REQUIRED_OUTCOME_KEYS, ['shortlistRelevant', 'wouldUseAgain']);
  const r = normaliseOutcome({ shortlistRelevant: 4, wouldUseAgain: 'yes' });
  assert.equal(r.ok, true);
});

test('an incomplete survey names what is missing rather than failing silently', () => {
  const r = normaliseOutcome({ timeSaved: 6 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['shortlistRelevant', 'wouldUseAgain']);
});

test('answers are typed so they can be compared across engagements', () => {
  const r = normaliseOutcome({
    shortlistRelevant: '9', wouldUseAgain: 'yes', timeSaved: '12.6',
    performedAsExpected: 0, missingFromProfile: '  writing samples  ',
  });
  assert.equal(r.answers.shortlistRelevant, 5, 'scales clamp to 1-5');
  assert.equal(r.answers.performedAsExpected, 1);
  assert.equal(r.answers.wouldUseAgain, true);
  assert.equal(r.answers.timeSaved, 13);
  assert.equal(r.answers.missingFromProfile, 'writing samples');
});

// ── Referrals ─────────────────────────────────────────────────────────────────────────
// A reward on signup pays for noise.
test('a referral pays only after all four gates clear', () => {
  const none = referralStatus({});
  assert.equal(none.earned, false);
  assert.equal(none.passed, 0);
  assert.match(none.summary, /Pays out once/);

  const partial = referralStatus({ verified_at: 'x', brief_at: 'x' });
  assert.equal(partial.earned, false);
  assert.equal(partial.remaining.length, 2);

  const all = referralStatus(Object.fromEntries(REFERRAL_GATES.map(g => [g, 'x'])));
  assert.equal(all.earned, true);
  assert.match(all.summary, /All four cleared/);
});

test('an already-rewarded referral is not earned twice', () => {
  const row = Object.fromEntries(REFERRAL_GATES.map(g => [g, 'x']));
  const r = referralStatus({ ...row, rewarded_at: 'x' });
  assert.equal(r.earned, false);
  assert.equal(r.alreadyRewarded, true);
});

test('remaining gates are described in words a founder can act on', () => {
  const r = referralStatus({ verified_at: 'x' });
  assert.ok(r.remaining.every(x => /\w \w/.test(x)), 'not raw column names');
});
