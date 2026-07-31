import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const adminApi = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
const adminJs  = readFileSync(new URL('../../admin.js', import.meta.url), 'utf8');
const adminHtml = readFileSync(new URL('../../admin.html', import.meta.url), 'utf8');
const adminCss = readFileSync(new URL('../../admin.css', import.meta.url), 'utf8');
const migDir = new URL('../../supabase/migrations/', import.meta.url);
const migrations = readdirSync(migDir).filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(new URL(f, migDir), 'utf8')).join('\n');

// placement_outcomes has existed since 20260729100000 and record-outcome nearly as long, with no
// caller anywhere. Chapter 32's north star and Chapter 31.5's economic unit both terminate in a
// recorded outcome; until this wiring existed, every system downstream read an empty table.
test('the outcome table is reachable from the operator UI', () => {
  assert.match(adminHtml, /id="adminOutcomes"/, 'the section exists');
  assert.match(adminJs, /function renderOutcomeWorklist\(/, 'a renderer exists');
  assert.match(adminJs, /renderOutcomeWorklist\(\)\.catch/, 'and runs on load');
  assert.match(adminJs, /action: 'record-outcome'/, 'the form calls the existing action');
});

test('the worklist action exists and is an anti-join on accepted introductions', () => {
  const fn = adminApi.slice(adminApi.indexOf("input.action === 'outcome-worklist'"), adminApi.indexOf("input.action === 'schema-health'"));
  assert.match(fn, /\.eq\('status', 'accepted'\)/, 'only accepted introductions can have an outcome');
  assert.match(fn, /ascending: true/, 'oldest first — the forgotten ones are the point');
  assert.match(fn, /introduction_id/, 'closed introductions are excluded by id, not by a fuzzy match');
});

// This action deliberately sits AFTER record-outcome. tests/model/reviewer.test.js slices the
// source between record-observation and record-outcome and asserts no numeric language appears
// there; anything inserted between those two markers is read as part of the reviewer route. The
// first version of this action sat in that gap and failed the assertion on the word "operating".
test('the worklist does not sit inside the reviewer slice', () => {
  const observation = adminApi.indexOf("input.action === 'record-observation'");
  const outcome = adminApi.indexOf("input.action === 'record-outcome'");
  const worklist = adminApi.indexOf("input.action === 'outcome-worklist'");
  assert.ok(worklist > outcome, 'outcome-worklist must come after record-outcome');
  assert.ok(observation < outcome, 'and record-observation must stay immediately before it');
});

// A closed vocabulary, not free text: "which accepted introductions are still open" is not
// answerable against a note field.
test('result is a closed vocabulary, enforced in both places', () => {
  const RESULTS = ['no_response', 'interviewed', 'no_fit', 'project', 'trial', 'hired', 'withdrawn'];
  for (const r of RESULTS) {
    assert.ok(adminApi.includes(`'${r}'`), `API accepts ${r}`);
    assert.ok(migrations.includes(`'${r}'`), `the database constrains ${r}`);
  }
  assert.match(adminApi, /Choose one of the listed outcomes/, 'an unknown result is rejected');
});

// Nullable on purpose. Every row and every caller that predates these columns stays valid, so
// adding them cannot break the already-shipped record-outcome action.
test('the new columns are additive', () => {
  assert.match(migrations, /add column if not exists result text/);
  assert.match(migrations, /add column if not exists introduction_id uuid/);
  assert.doesNotMatch(migrations, /alter table public\.placement_outcomes[\s\S]{0,200}?set not null/i);
});

test('placement_outcomes is revoked from the browser roles', () => {
  assert.match(migrations, /revoke all on table public\.placement_outcomes from public, anon, authenticated/i);
  assert.match(migrations, /grant select, insert, update on table public\.placement_outcomes to service_role/i);
});

// Asking a founder for numbers they never measured produces invented ones, which is worse than
// absent ones for a product whose entire claim is evidence quality.
test('only what-happened is required', () => {
  const fn = adminJs.slice(adminJs.indexOf('function outcomeRow('), adminJs.indexOf('async function renderReviewQueue'));
  assert.match(fn, /if \(!select\.value\)/, 'result is required');
  assert.doesNotMatch(fn, /daysToContribution|seniorHours/, 'the quantitative fields are not demanded in the operator form');
  assert.match(fn, /optional/i, 'the note is marked optional to the operator');
});

test('the ratio is reported even when it is bad', () => {
  assert.match(adminJs, /accepted introductions closed out/);
  const fn = adminApi.slice(adminApi.indexOf("input.action === 'outcome-worklist'"), adminApi.indexOf("input.action === 'schema-health'"));
  assert.match(fn, /accepted: rows\.length/);
  assert.match(fn, /recorded: rows\.length - outstanding\.length/);
});

test('a long-waiting introduction is marked, not left to blend in', () => {
  assert.match(adminJs, /daysWaiting >= 14/);
  assert.match(adminCss, /\.outcome-row\.is-stale/);
});

test('the operator form is keyboard reachable', () => {
  assert.match(adminCss, /\.outcome-save:focus-visible/);
  assert.match(adminJs, /aria-live/, 'the result of recording is announced');
});
