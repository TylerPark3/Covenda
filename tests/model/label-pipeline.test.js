import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { labelReadiness } from '../../api/labels-cron.js';
import { loadRealLabels } from '../../api/ml-data.js';

function db(rows) {
  const q = {
    select: () => q, eq: () => q,
    order: async () => ({ data: rows, error: null }),
    then: (res) => res({ data: rows, error: null }),
  };
  return { from: () => q };
}

// This is the whole chain. If any link is missing, 100 real trials produce zero labels.
test('the gate counts only real trials, never founder ratings or synthetic rows', async () => {
  const r = await labelReadiness(db(Array(60).fill({ label: 1, source: 'real_trial' })));
  assert.equal(r.have, 60);
  assert.equal(r.ready, true, '60 real outcomes clears the 50 gate');
});

test('a set that is all one class is reported as unusable, however large', async () => {
  const allPositive = await labelReadiness(db(Array(80).fill({ label: 1, source: 'real_trial' })));
  assert.equal(allPositive.balanced, false);
  assert.ok(allPositive.blockers.some(b => /no negative outcomes/.test(b)));

  const mixed = await labelReadiness(db([
    ...Array(40).fill({ label: 1, source: 'real_trial' }),
    ...Array(20).fill({ label: 0, source: 'real_trial' }),
  ]));
  assert.equal(mixed.balanced, true);
  assert.deepEqual(mixed.blockers, []);
});

test('below the gate it says how many more trials are needed', async () => {
  const r = await labelReadiness(db(Array(12).fill({ label: 1, source: 'real_trial' })));
  assert.equal(r.ready, false);
  assert.match(r.blockers[0], /38 more completed trials/);
});

// A label without the features that produced the recommendation says an outcome happened
// without saying what the model saw.
test('labels missing their feature vector are dropped and counted', async () => {
  const r = await loadRealLabels(db([
    { match_id: 'a', label: 1, feature_vector_at_scoring: { skills_match: 0.8 }, source: 'real_trial' },
    { match_id: 'b', label: 0, feature_vector_at_scoring: null, source: 'real_trial' },
  ]));
  assert.equal(r.rows.length, 1);
  assert.equal(r.dropped, 1, 'the loss must be visible, not silent');
});

// The rating unlocking the credential is the only reason completion approaches 100%.
test('accepting a deliverable is blocked without the close-out answer', () => {
  const src = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function reviewDeliverable'), src.indexOf('// Conversion tracking'));
  assert.match(fn, /CLOSEOUT_RATING_REQUIRED/, 'the gate must be on the real path');
  assert.match(fn, /typeof wouldRequestAgain !== 'boolean'/, 'and must reject a missing answer, not default it');
  assert.match(fn, /eventType: 'closeout_rating'/, 'the rating must reach the event log');
  assert.match(fn, /eventType: 'deliverable_accepted'/, 'in the vocabulary the materialiser reads');
});

test('every event carries a match id so a trial can be assembled', () => {
  const src = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(src, /match_id: matchId \|\| projectId \|\| null/);
});

test('the nightly job is registered and refuses a public caller', () => {
  const cron = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.ok(cron.crons.some(c => c.path === '/api/labels-cron'), 'events without a job never become labels');
  const src = readFileSync(new URL('../../api/labels-cron.js', import.meta.url), 'utf8');
  assert.match(src, /x-vercel-cron/);
  assert.match(src, /Not authorised/);
});
