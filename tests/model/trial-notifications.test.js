import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deliverableSubmittedEmail, deliverableReviewedEmail, trialStartedEmail, introductionEmail } from '../../api/notify.js';

const portal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const fn = name => portal.slice(portal.indexOf(`export async function ${name}`), portal.indexOf('export async function', portal.indexOf(`export async function ${name}`) + 30));

// A trial does not die from a bug. It dies from somebody waiting on somebody who never found
// out it was their turn.
test('every moment where one side acts, the other is told', () => {
  assert.match(fn('submitDeliverable'), /deliverableSubmittedEmail/, 'the company must learn work arrived');
  assert.match(fn('reviewDeliverable'), /accepted: true/, 'the student must learn they were accepted');
  assert.match(fn('reviewDeliverable'), /accepted: false/, 'and must learn what to change');
  assert.match(fn('startTrial'), /trialStartedEmail/, 'both sides must know the clock started');
  assert.match(fn('requestIntroduction'), /introductionEmail/, 'an unseen introduction never happened');
});

// Two reviews of the same project must not send two identical emails.
test('every send is idempotent', () => {
  for (const key of ['covenda-submitted-', 'covenda-accepted-', 'covenda-revise-', 'covenda-trial-start-', 'covenda-intro-']) {
    assert.ok(portal.includes(key), `missing idempotency key: ${key}`);
  }
});

// The subject line has to say whose turn it is; a state change alone leaves the reader to
// work out whether it concerns them.
test('subjects name the person who must act', () => {
  assert.match(deliverableSubmittedEmail({ to: 'a', from: 'b', projectTitle: 'Audit', studentName: 'Maya' }).subject, /your review/);
  assert.match(deliverableReviewedEmail({ to: 'a', from: 'b', projectTitle: 'Audit', accepted: true }).subject, /accepted/);
  assert.match(deliverableReviewedEmail({ to: 'a', from: 'b', projectTitle: 'Audit', accepted: false }).subject, /Changes requested/);
  assert.match(introductionEmail({ to: 'a', from: 'b', companyName: 'Cursor' }).subject, /Cursor would like an introduction/);
});

test('an acceptance says what the student actually gained', () => {
  const e = deliverableReviewedEmail({ to: 'a', from: 'b', projectTitle: 'Audit', accepted: true });
  assert.match(e.text, /verified work record/, 'the credential is the point, not the status change');
});

test('a change request carries the note, so nobody has to go and look for it', () => {
  const e = deliverableReviewedEmail({ to: 'a', from: 'b', projectTitle: 'Audit', accepted: false, note: 'Add the source list.' });
  assert.match(e.text, /Add the source list/);
  assert.match(e.html, /Add the source list/);
});

test('an introduction says the student decides', () => {
  const e = introductionEmail({ to: 'a', from: 'b', companyName: 'Cursor', roleSummary: 'Ten hours a week' });
  assert.match(e.text, /You decide/);
  assert.match(e.text, /Nothing is shared until you do/);
});

test('the trial start reaches both sides, not just one', () => {
  assert.match(fn('startTrial'), /assigned_student_user_id, started\?\.owner_user_id/);
});

test('a notification failure never loses the underlying action', () => {
  // The write happens first and its result is returned; the send is best-effort after it.
  assert.match(fn('submitDeliverable'), /const submitted = await checked\([\s\S]*?notifyMember[\s\S]*?return submitted;/);
});
