import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewerLine, reviewerCoverage, reviewerFor } from '../../api/reviewers.js';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');

// Twenty minutes of work lost to a closed tab is something people do not come back from.
test('a draft survives the dialog closing', () => {
  assert.match(portal, /function saveBatchDraft/);
  assert.match(portal, /function restoreBatchDraft/);
  assert.match(portal, /addEventListener\('input'/, 'saved as they type, not only on navigation');
  assert.match(portal, /clearBatchDraft\(e\.batchId\.value\)/, 'and cleared once it is actually sent');
});

test('the draft never leaves the browser', () => {
  const fn = portal.slice(portal.indexOf('function saveBatchDraft'), portal.indexOf('function baStepDone'));
  assert.match(fn, /localStorage/);
  assert.doesNotMatch(fn, /portalRequest|fetch\(/, 'a half-finished application belongs to nobody else');
});

// "Step 2 of 4" is a page number, not an answer to what a student is asking.
test('progress reports what is left, not where you are', () => {
  assert.match(portal, /left === 0 \? 'Everything done, ready to send'|left===0\?'Everything done, ready to send'/);
  assert.match(portal, /function baStepDone/);
});

test('a step counts as done when it is finished, not when it is visited', () => {
  const fn = portal.slice(portal.indexOf('function baStepDone'), portal.indexOf('function renderBatchWizard'));
  assert.match(fn, /videoUrl/, 'the walkthrough must actually exist');
  assert.match(fn, /exerciseNeeded/, 'and the exercise too, when the batch has one');
  assert.match(fn, /length >= 40|length>=40/, 'and the written answer must be real');
});

// No practitioner has agreed to anything yet. Claiming otherwise is the fastest way to lose
// a company that checks.
test('a vertical nobody has signed off says so plainly', () => {
  const line = reviewerLine('Software & AI');
  assert.equal(line.state, 'none');
  assert.match(line.headline, /Bar set by Covenda/);
  assert.match(line.detail, /No outside practitioner has signed off/);
});

test('a name never escapes before somebody has actually agreed', () => {
  const r = reviewerFor('Software & AI');
  assert.equal(r.name, null);
  const src = readFileSync(new URL('../../api/reviewers.js', import.meta.url), 'utf8');
  assert.match(src, /Do not add a name at 'invited'/, 'a name on a page reads as endorsement');
});

test('the claim is gated on full coverage, not partial', () => {
  const c = reviewerCoverage();
  assert.equal(c.confirmed, 0);
  assert.equal(c.mayClaimProfessionalVetting, false);
  assert.equal(c.none, c.total);
});

// The real reason used to be discarded, so every failure looked identical.
test('a failed verification email records why', () => {
  const api = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const fn = api.slice(api.indexOf('export async function requestSchoolVerification'), api.indexOf('export async function confirmSchoolVerification'));
  assert.match(fn, /recordError\('school-verification'/);
  assert.match(fn, /unverified/, 'an unverified sending domain is named rather than hidden behind "try again"');
});
