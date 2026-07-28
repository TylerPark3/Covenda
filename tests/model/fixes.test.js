import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gatherMembers } from '../../api/batch-review-cron.js';
import { CHURN_POLICY } from '../../api/batch-churn.js';

const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');

// SPEC §4: "Three tiers only. Never expose a raw percentage to an employer."
test('employer-facing surfaces show a tier, not a number', () => {
  const applicant = portal.slice(portal.indexOf('function applicantCard'), portal.indexOf('function applicantCard') + 2500);
  assert.match(applicant, /fitTier\(application\.fit_score/, 'the applicant card is employer-facing');
  assert.doesNotMatch(applicant, /fitPill\(application\.fit_score/);
  // The number stays reachable for an operator, just never rendered.
  const fn = portal.slice(portal.indexOf('function fitTier'), portal.indexOf('function fitPill'));
  assert.match(fn, /dataset\.score/);
  assert.doesNotMatch(fn, /% fit/, 'no percentage in the employer label');
});

test('a talent card no longer carries the school name', () => {
  // Banned as a scoring input by SPEC §3; showing it on a card is the same proxy by another route.
  assert.doesNotMatch(portal, /app\.applicant\?\.school_name/);
});

test('students still see their own fit — the clause is about employers', () => {
  assert.match(portal, /fitPill\(project\.fitScore/, 'discover is student-facing');
});

// A list that never turns over stops meaning anything, and this policy never ran.
test('the batch review is scheduled and reports rather than executes', () => {
  const cron = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.ok(cron.crons.some(c => c.path === '/api/batch-review-cron'));
  const src = readFileSync(new URL('../../api/batch-review-cron.js', import.meta.url), 'utf8');
  assert.match(src, /executed: false/, 'nobody is removed by a cron job');
  assert.doesNotMatch(src, /\.delete\(\)/, 'and nothing is deleted');
  assert.match(src, /x-vercel-cron/, 'and a public caller is refused');
});

test('activity is read from what a member did, never from a login', () => {
  const src = readFileSync(new URL('../../api/batch-review-cron.js', import.meta.url), 'utf8');
  assert.match(src, /match_events/);
  assert.match(src, /member_projects/);
  assert.doesNotMatch(src, /last_sign_in|last_login/, 'being logged in is not participation');
});

test('gatherMembers survives a batch with no admitted students', async () => {
  const db = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [] }) }), in: async () => ({ data: [] }) }) }) };
  assert.deepEqual(await gatherMembers(db, 'b1'), []);
});

test('the policy protects anyone mid-trial and caps how many go at once', () => {
  assert.equal(CHURN_POLICY.maxRemovedPerReview, 5);
  assert.equal(CHURN_POLICY.requiresWaitlistForRelative, true, 'no relative removal without someone waiting');
  assert.ok(CHURN_POLICY.warnAfterDays < CHURN_POLICY.inactiveDays, 'a warning must precede removal');
});
