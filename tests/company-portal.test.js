import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const portalJs = readFileSync(new URL('../portal.js', import.meta.url), 'utf8');
const apiJs = readFileSync(new URL('../api/portal.js', import.meta.url), 'utf8');

// A company profile is only what a student judges the company on once the company says so.
test('a company profile is a draft until it is explicitly published', () => {
  assert.match(apiJs, /\.eq\('published', true\)/);
  assert.match(portalJs, /Draft — not visible to students/);
});

// The whole point of the company-verification module: the caveat travels with the signal
// into the UI, not just the API. Checked against rendered strings — an earlier version of
// this test matched a source comment and passed for the wrong reason.
test('the portal shows what a confirmed work email does NOT prove', () => {
  assert.match(portalJs, /Does not prove: /);
  assert.match(portalJs, /not a Covenda endorsement of the company/);
  const rendered = portalJs.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(rendered, /verified company/i);
});

test('a student can open the company behind a project', () => {
  assert.match(portalJs, /openCompanyProfile\(project\.owner_user_id/);
  assert.match(apiJs, /action === 'company-profile'/);
});

test('only company accounts can write a company profile', () => {
  assert.match(apiJs, /Only company accounts have a company profile/);
});
