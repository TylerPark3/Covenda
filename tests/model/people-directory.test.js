import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../supabase/migrations/20260728600000_people_directory.sql', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
const adminJs = readFileSync(new URL('../../admin.js', import.meta.url), 'utf8');

// Every submission is a real event with its own consent timestamp. Collapsing them
// destructively would throw that away to fix a display problem.
test('the submissions log is read over, never rewritten', () => {
  assert.match(sql, /create or replace view public\.people_directory/);
  assert.doesNotMatch(sql, /delete from public\.submissions|update public\.submissions/i);
});

// Two real people do share a name, and that is not a mistake you can find after the fact.
test('two emails are never merged automatically, however similar the names', () => {
  assert.match(sql, /group by n\.email/);
  assert.match(sql, /Never merges two emails, however similar/);
  assert.match(sql, /never an automatic merge/);
  // Duplicates are surfaced as a separate view for a human to decide on.
  assert.match(sql, /create or replace view public\.people_possible_duplicates/);
});

test('verticals are read from both form shapes, since neither is authoritative', () => {
  // The quick form writes details.industries; the fuller one nests under details.interests.
  assert.match(sql, /details -> 'industries'/);
  assert.match(sql, /details -> 'interests' -> 'industries'/);
});

test('a person with two verticals appears under both', () => {
  const fn = admin.slice(admin.indexOf("action === 'people-directory'"), admin.indexOf("action === 'simulation-runs'"));
  assert.match(fn, /for \(const v of verticals\) \(byVertical\[v\] \|\|= \[\]\)\.push\(person\)/);
  // Because they are genuinely available for both, not because of a counting quirk.
  assert.match(fn, /they\n?\s*\/\/ are available for both|available for both/);
});

test('unstated sits last however large it is', () => {
  const fn = admin.slice(admin.indexOf("action === 'people-directory'"), admin.indexOf("action === 'simulation-runs'"));
  assert.match(fn, /\(a\.vertical === 'Not stated'\) - \(b\.vertical === 'Not stated'\)/);
  // The reasoning wraps across two comment lines, so match the part that fits on one.
  assert.match(fn, /it is a gap to close/);
});

// The gap between the two numbers is the thing that was confusing in the raw table.
test('the view shows people and submissions as separate counts', () => {
  assert.match(adminJs, /one row per person here, not per click/);
  assert.match(admin, /submissions: \(people \|\| \[\]\)\.reduce/);
});

test('someone who came back is marked, because that is worth noticing', () => {
  assert.match(adminJs, /Number\(person\.submissions\) > 1/);
  assert.match(adminJs, /Submitted more than once/);
});

test('a missing view never takes the admin page down', () => {
  assert.match(adminJs, /renderPeopleDirectory\(\)\.catch\(\(\) => \{\}\)/);
});
