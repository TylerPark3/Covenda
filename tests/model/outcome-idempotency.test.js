import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const admin = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../supabase/migrations/20260801100000_outcome_idempotency.sql', import.meta.url), 'utf8');

// The operator submits an outcome, the row commits, the response is lost to a dropped
// connection. They submit again. Before this change `placement_outcomes` held two rows for one
// introduction, and nothing in the schema said that was wrong.
//
// That is worse here than the usual duplicate-row annoyance. placement_outcomes is the table
// the north-star metric reads, and calibrationStatus is explicitly built to be honest about a
// very small n. With five pilot outcomes, one duplicate is a 20% error in the only number the
// company is steering by.

test('one introduction can only ever have one outcome row', () => {
  assert.match(migration, /create unique index if not exists placement_outcomes_introduction_unique/);
  // Partial, because introduction_id is legitimately null for outcomes with no formal
  // introduction. An unfiltered unique index would still permit unlimited null rows (Postgres
  // treats nulls as distinct), so the where clause states the intent rather than relying on it.
  assert.match(migration, /where introduction_id is not null/,
    'partial, so outcomes without an introduction are still allowed');
});

// A unique index on its own turns the retry into a 503. That is a different bug, not a fix:
// the operator sees a failure and cannot tell whether their first submission landed.
test('a retry succeeds rather than erroring', () => {
  const handler = admin.slice(admin.indexOf("'record-outcome'"), admin.indexOf('calibrationStatus(all'));
  assert.match(handler, /\.upsert\(row, \{ onConflict: 'introduction_id', ignoreDuplicates: false \}\)/,
    'the second submission overwrites the first and reports success');
  // Null introduction_id has nothing to conflict on, so it must still take the plain path.
  assert.match(handler, /row\.introduction_id\s*\n?\s*\?/,
    'outcomes with no introduction still insert normally');
  assert.match(handler, /: await operator\.supabase\.from\('placement_outcomes'\)\.insert\(row\)/);
});

// Building a unique index over a table that already has duplicates fails, and the bundle is
// pasted as one script — so a failure here stops every migration after it.
test('the migration cleans existing duplicates before it constrains', () => {
  const del = migration.indexOf('delete from public.placement_outcomes');
  const idx = migration.indexOf('create unique index');
  assert.notEqual(del, -1, 'existing duplicates are removed');
  assert.ok(del < idx, 'and removed BEFORE the index is built, or the whole bundle stops here');
  // Keep the earliest row: it is the one the operator actually confirmed. Anything later is the
  // retry that should never have been accepted.
  assert.match(migration, /\(a\.recorded_at, a\.ctid\) > \(b\.recorded_at, b\.ctid\)/,
    'keeps the first row, with ctid breaking ties on identical timestamps');
});

// Every migration in this repo is idempotent by contract: `npm run sql` emits all 60+ of them
// and the safe default is to re-run everything.
test('the migration is safe to run twice', () => {
  assert.match(migration, /create unique index if not exists/);
  assert.match(migration, /drop index if exists/);
  assert.doesNotMatch(migration, /^\s*create index (?!if not exists)/m,
    'no bare create that would fail on a second run');
});

// The plain index this replaces served the same worklist anti-join. Leaving both costs a write
// on every insert and an extra index in cache for no benefit.
test('the redundant non-unique index is dropped', () => {
  assert.match(migration, /drop index if exists public\.placement_outcomes_introduction_idx/);
});
