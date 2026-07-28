import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');

// This exact failure has now happened twice: a query filtering on a column added by a
// migration, run before that migration is applied, fails and takes the whole portal with it.
test('no core read filters on a new column without a fallback', () => {
  const bare = portal.match(/checked\([^)]*\.eq\('synthetic', false\)/g) || [];
  assert.equal(bare.length, 0, 'a synthetic filter inside checked() is a portal outage waiting to happen');
  assert.match(portal, /async function excludingSynthetic/);
});

test('the fallback returns real data rather than an empty list', () => {
  const fn = portal.slice(portal.indexOf('async function excludingSynthetic'), portal.indexOf('async function optional'));
  assert.match(fn, /const fallback = await build\(false\)/, 'it re-runs unfiltered');
  // `?? []` on a successful empty result is correct; what must never happen is swallowing
  // the error and returning [] as though the query had succeeded.
  assert.doesNotMatch(fn, /catch[\s\S]*?return \[\]/, 'an error must never masquerade as an empty result');
  // A database without the column has no synthetic rows, so unfiltered is correct there.
  // The reasoning lives in the comment above the declaration, so check the file not the body.
  assert.match(portal, /has no synthetic rows in it/);
});

test('a genuine error still surfaces rather than being swallowed as a missing column', () => {
  const fn = portal.slice(portal.indexOf('async function excludingSynthetic'), portal.indexOf('async function optional'));
  assert.match(fn, /throw new Error\(error\.message\)/, 'only a missing-column error may fall back');
});

test('the operator is told which migration to run', () => {
  assert.match(portal, /run the newest migration/);
});
