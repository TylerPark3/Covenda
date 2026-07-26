import test from 'node:test';
import assert from 'node:assert/strict';

import { signState, verifyState, buildAuthorizeUrl } from '../api/connect-github.js';
import { analyzeRepo } from '../api/github.js';

const SECRET = 'test-connector-secret';

// ---- Signed OAuth state (CSRF defense, no server session table) ---------------------------

test('state round-trips the user id under a valid HMAC', () => {
  const state = signState('user-123', SECRET);
  assert.deepEqual(verifyState(state, SECRET), { userId: 'user-123' });
});

test('a tampered state is rejected', () => {
  const state = signState('user-123', SECRET);
  const tampered = state.slice(0, -3) + 'xyz';
  assert.equal(verifyState(tampered, SECRET), null);
  assert.equal(verifyState(state, 'wrong-secret'), null); // wrong key can't verify
});

test('an expired state is rejected', () => {
  const past = Date.now() - 20 * 60 * 1000;
  const state = signState('user-123', SECRET, { now: past });
  assert.equal(verifyState(state, SECRET), null); // TTL elapsed
});

test('authorize URL requests read-only scopes and carries the state', () => {
  const url = buildAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://covenda.app/api/connect-github?action=callback', state: 'STATE' });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('state'), 'STATE');
  assert.equal(u.searchParams.get('scope'), 'read:user public_repo'); // read-only, minimal
  assert.ok(!/write|admin|delete/.test(u.searchParams.get('scope')));
});

// ---- analyzeRepo now exposes the commit timeline + owner login for the framework ----------

test('analyzeRepo exposes commit timestamps + owner login for forensics/ownership', () => {
  const now = Date.UTC(2026, 5, 1);
  const DAY = 86_400_000;
  const commits = Array.from({ length: 8 }, (_, i) => ({
    commit: { author: { date: new Date(now - (7 - i) * 20 * DAY).toISOString() } },
    author: { login: 'octocat' },
  }));
  const analysis = analyzeRepo({
    repo: { full_name: 'octocat/proj', html_url: 'https://github.com/octocat/proj', owner: { login: 'octocat' }, created_at: new Date(now - 200 * DAY).toISOString() },
    languages: { Python: 50000 }, commits, contents: [{ type: 'file', name: 'README.md' }],
  });
  assert.equal(analysis.ownerLogin, 'octocat');
  assert.ok(Array.isArray(analysis.commitTimestamps) && analysis.commitTimestamps.length === 8);
  // ascending order preserved
  const ts = analysis.commitTimestamps;
  assert.ok(ts.every((t, i) => i === 0 || t >= ts[i - 1]));
});
