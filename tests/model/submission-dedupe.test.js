import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findRecentDuplicate, DOUBLE_SUBMIT_WINDOW_MS } from '../../api/submissions.js';

const at = '2026-07-28T12:00:00.000Z';
const record = (over = {}) => ({
  reference: 'REF-NEW', type: 'student-interest', status: 'received', source: 'web',
  createdAt: at, consent: { agreed: true },
  details: { contact: { name: 'Sam Rivera', email: 'Sam@Example.com' }, school: 'State' },
  ...over,
});

// A stub that records the query it was built with, so the filters can be asserted.
function stubSupabase(rows, { error = null } = {}) {
  const calls = {};
  const chain = {
    select() { return chain; },
    eq(k, v) { calls[k] = v; return chain; },
    ilike(k, v) { calls.ilike = [k, v]; return chain; },
    gte(k, v) { calls.gte = [k, v]; return chain; },
    order() { return chain; },
    limit() { return Promise.resolve({ data: rows, error }); },
  };
  return { from() { return chain; }, calls };
}

test('an identical resend moments later is recognised as the same act', async () => {
  const r = record();
  // The summary is derived from the record, so a real duplicate row carries the same one.
  const db = stubSupabase([{ reference: 'REF-OLD', created_at: at, summary: 'Call requested.' }]);
  const hit = await findRecentDuplicate(db, r);
  assert.ok(hit, 'a resend of the same form was treated as a new person');
  assert.equal(hit.reference, 'REF-OLD');
});

// The submissions table is an event log and stays one. Two genuinely different submissions
// are two real events, each carrying its own consent timestamp.
test('a different form from the same person is not a duplicate', async () => {
  const db = stubSupabase([]);
  assert.equal(await findRecentDuplicate(db, record()), null);
  assert.equal(db.calls.submission_type, 'student-interest', 'the form type must be part of the match');
});

test('the match is scoped to a window, not to all of history', async () => {
  const db = stubSupabase([]);
  await findRecentDuplicate(db, record());
  const [column, since] = db.calls.gte;
  assert.equal(column, 'created_at');
  assert.equal(new Date(at) - new Date(since), DOUBLE_SUBMIT_WINDOW_MS);
  assert.ok(DOUBLE_SUBMIT_WINDOW_MS <= 10 * 60 * 1000, 'too wide a window swallows real second submissions');
});

test('email matching ignores case, which is where the duplicates came from', async () => {
  const db = stubSupabase([]);
  await findRecentDuplicate(db, record());
  assert.deepEqual(db.calls.ilike, ['submitter_email', 'sam@example.com']);
});

// Losing a real submission to prevent a duplicate is the worse trade.
test('the check fails open', async () => {
  const erroring = stubSupabase(null, { error: { message: 'relation does not exist' } });
  assert.equal(await findRecentDuplicate(erroring, record()), null);

  const throwing = { from() { throw new Error('network'); } };
  assert.equal(await findRecentDuplicate(throwing, record(), { logger: { error() {} } }), null);
});

test('a submission with no email is never matched against another', async () => {
  const db = stubSupabase([{ reference: 'REF-OLD', created_at: at, summary: 'Call requested.' }]);
  const anon = record({ details: { contact: { name: 'Sam', email: '  ' } } });
  assert.equal(await findRecentDuplicate(db, anon), null);
});

// Hiding the panel on failure is what made this read as "the admin is broken": no directory,
// no error, and nothing to click.
test('the operator is told why the directory is empty', () => {
  const api = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
  const block = api.slice(api.indexOf("input.action === 'people-directory'"), api.indexOf("input.action === 'simulation-runs'"));
  assert.match(block, /peopleResult\.error/, 'the Supabase error is still being destructured away');
  assert.match(block, /needsMigration/, 'a missing view must be distinguishable from an empty table');
  assert.match(block, /people_directory migration/, 'the operator must be told what to run');

  const client = readFileSync(new URL('../../admin.js', import.meta.url), 'utf8');
  const render = client.slice(client.indexOf('async function renderPeopleDirectory'), client.indexOf('async function renderPeopleDirectory') + 1800);
  assert.ok(!/catch \{ host\.hidden = true; return; \}/.test(render), 'the panel still vanishes on error');
  assert.match(render, /people-error/);
});

test('a missing duplicates view does not take the whole directory down', () => {
  const api = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
  const block = api.slice(api.indexOf("input.action === 'people-directory'"), api.indexOf("input.action === 'simulation-runs'"));
  assert.match(block, /dupeResult\.error \? \[\]/);
});

// Same person, same form, same window, but they actually changed their answer. That is a
// correction and a second real event, not a double-click.
test('a changed answer inside the window is still recorded', async () => {
  const db = stubSupabase([{ reference: 'REF-OLD', created_at: at, summary: 'Something else entirely.' }]);
  assert.equal(await findRecentDuplicate(db, record()), null);
});
