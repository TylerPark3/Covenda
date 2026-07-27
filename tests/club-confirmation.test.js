import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/portal.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../confirm.html', import.meta.url), 'utf8');
const route = readFileSync(new URL('../api/club-confirm.js', import.meta.url), 'utf8');

// The design constraint the whole feature rests on: officers are volunteers who will not
// sign up. If confirming ever requires an account, nobody confirms and the club-credibility
// model has no way to be earned.
test('an officer can confirm without an account', () => {
  // Check for signup AFFORDANCES, not the word "account" — the page reassures the officer it
  // "does not create an account", which an earlier version of this test read as a failure.
  assert.doesNotMatch(page, /type="password"/i);
  assert.doesNotMatch(page, /\b(sign in|sign up|log in|register)\b/i);
  assert.match(page, /does not create an account/i);
  // And the endpoint itself takes no session.
  assert.doesNotMatch(route, /requireMember|Authorization/);
});

test('the token is the credential, so it comes from the CSPRNG', () => {
  assert.match(api, /crypto\.getRandomValues/);
  assert.doesNotMatch(api, /Math\.random\(\)[\s\S]{0,80}token/i);
});

test('a token is single-use and expiring', () => {
  assert.match(api, /already been used/i);
  assert.match(api, /expired/i);
  // Requesting again retires the previous link, so an old message cannot still confirm.
  assert.match(api, /status: 'expired'[\s\S]{0,200}\.eq\('status', 'pending'\)/);
});

// A confirmation nobody put their name to carries nothing — the same rule the student side
// applies to referrals.
test('confirming requires the officer to name themselves', () => {
  assert.match(api, /Enter your name\. A confirmation nobody has put their name to is worth nothing/);
});

test('the route never echoes the token or the student user id back', () => {
  const getBlock = route.slice(route.indexOf("req.method === 'GET'"), route.indexOf("req.method === 'POST'"));
  assert.doesNotMatch(getBlock, /token: record\.token/);
  assert.doesNotMatch(getBlock, /student_user_id/);
});

test('a decline is recorded rather than silently dropped', () => {
  assert.match(api, /status: confirmed \? 'confirmed' : 'declined'/);
  assert.match(api, /status: confirmed \? 'confirmed' : 'rejected'/);
});
