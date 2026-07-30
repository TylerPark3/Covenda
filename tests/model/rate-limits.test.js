import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIMITS, checkLimit, requestSubject, windowStart } from '../../api/limits.js';

// A stub Postgres counter: one bucket per (subject, action, window), incremented atomically the
// way bump_rate_limit does, so these test the decision and not the driver.
function fakeSupabase() {
  const counts = new Map();
  return {
    counts,
    rpc(fn, { p_subject, p_action, p_window_start }) {
      assert.equal(fn, 'bump_rate_limit');
      const key = `${p_subject}|${p_action}|${p_window_start}`;
      const next = (counts.get(key) || 0) + 1;
      counts.set(key, next);
      return Promise.resolve({ data: next, error: null });
    },
  };
}

// The client address is the FIRST entry in x-forwarded-for. Reading the last one limits the
// proxy instead of the caller, which caps nothing while looking like it caps something.
test('the subject is the caller, not the proxy chain', () => {
  assert.equal(requestSubject({ headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' } }), '203.0.113.7');
  assert.equal(requestSubject({ headers: {}, socket: { remoteAddress: '198.51.100.4' } }), '198.51.100.4');
  assert.equal(requestSubject({ headers: {} }), 'unknown');
  assert.equal(requestSubject(undefined), 'unknown');
  // Never unbounded: the subject is a database key.
  const long = 'x'.repeat(500);
  assert.ok(requestSubject({ headers: { 'x-forwarded-for': long } }).length <= 120);
});

// Every instance has to agree which bucket a request falls in without talking to the others.
test('the window is floored so instances agree without coordinating', () => {
  // Anchored to a bucket boundary. An arbitrary timestamp sits partway through a window, so
  // "+59 minutes" can legitimately cross into the next one and says nothing about the flooring.
  const hour = 3600;
  const boundary = Math.floor(1_000_000_000_000 / (hour * 1000)) * hour * 1000;
  assert.equal(windowStart(boundary, hour), windowStart(boundary + 59 * 60_000, hour),
    'two requests inside one hourly bucket were assigned different windows');
  assert.notEqual(windowStart(boundary, hour), windowStart(boundary + 61 * 60_000, hour),
    'a request in the next hour reused the previous bucket');
  // The floor is what lets separate instances agree without coordinating.
  assert.equal(windowStart(boundary + 1, hour), windowStart(boundary + hour * 1000 - 1, hour));
});

test('a caller is refused on the request after the limit, not before', async () => {
  const client = fakeSupabase();
  const rule = LIMITS.submission;
  for (let i = 1; i <= rule.max; i += 1) {
    const verdict = await checkLimit('submission', '203.0.113.7', { client });
    assert.equal(verdict.allowed, true, `refused on request ${i} of an allowed ${rule.max}`);
  }
  const over = await checkLimit('submission', '203.0.113.7', { client });
  assert.equal(over.allowed, false);
  assert.ok(over.resetIn > 0 && over.resetIn <= rule.windowSeconds, 'no usable retry hint');
});

test('one caller being refused does not refuse anybody else', async () => {
  const client = fakeSupabase();
  for (let i = 0; i <= LIMITS.submission.max; i += 1) await checkLimit('submission', 'noisy', { client });
  assert.equal((await checkLimit('submission', 'noisy', { client })).allowed, false);
  assert.equal((await checkLimit('submission', 'someone-else', { client })).allowed, true);
});

// The two keys guard different attacks and neither is sufficient alone.
test('a magic link is capped by caller AND by the address it would email', async () => {
  const client = fakeSupabase();
  // One host, many addresses: the per-caller cap has to stop it.
  let refused = false;
  for (let i = 0; i < LIMITS['magic-link-ip'].max + 1; i += 1) {
    const v = await checkLimit('magic-link-ip', '203.0.113.7', { client });
    if (!v.allowed) refused = true;
  }
  assert.ok(refused, 'one host could request unlimited links to different addresses');

  // Many hosts, one address: the per-address cap has to stop it.
  refused = false;
  for (let i = 0; i < LIMITS['magic-link-address'].max + 1; i += 1) {
    const v = await checkLimit('magic-link-address', 'target@example.com', { client });
    if (!v.allowed) refused = true;
  }
  assert.ok(refused, 'a botnet could fill one inbox from rotating addresses');

  // And the two counters are independent, so exhausting one does not exhaust the other.
  assert.equal((await checkLimit('magic-link-address', 'someone@example.com', { client })).allowed, true);
});

// Documented and deliberate: a limiter that takes the product down when its own table is
// missing has done more damage than the abuse it guarded against.
test('a broken limiter allows the request rather than becoming an outage', async () => {
  const throwing = { rpc: () => Promise.resolve({ data: null, error: { message: 'relation does not exist' } }) };
  const verdict = await checkLimit('submission', '203.0.113.7', { client: throwing });
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.skipped, 'limiter unavailable');

  // Same when Supabase is not configured at all, which is every local dev environment.
  const unconfigured = await checkLimit('submission', '203.0.113.7', { env: {} });
  assert.equal(unconfigured.allowed, true);
  // And an unknown action is not silently limited to zero.
  assert.equal((await checkLimit('no-such-action', 'x', { env: {} })).allowed, true);
});

// The point of this change: the two endpoints open to the internet were guarded by in-process
// Maps, which reset on every cold start and count one instance out of however many are warm.
// The header of api/limits.js already called that worse than no limiter.
test('the public endpoints use the durable counter, not just a Map', () => {
  const portal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  assert.match(portal, /checkLimit\('magic-link-ip', requestSubject\(req\)/);
  assert.match(portal, /checkLimit\('magic-link-address', email/);
  // Both keys are consulted before the decision, so either can refuse.
  assert.match(portal, /await Promise\.all\(\[[\s\S]{0,200}magic-link-address/);
  // The in-process check may remain as a burst backstop, but it must not be the only gate.
  const guard = portal.slice(portal.indexOf('async function magicLinkLimited'));
  assert.match(guard.slice(0, 700), /burstLimited\(req, email\)/, 'the burst backstop was dropped');

  const submissions = readFileSync(new URL('../../api/submissions.js', import.meta.url), 'utf8');
  assert.match(submissions, /await checkLimit\('submission', requestSubject\(req\)\)/);
  assert.match(submissions, /retryAfterSeconds/, 'a 429 with no retry hint tells a caller nothing');
  // The old name is gone, so nothing can call the Map and believe it is rate limited.
  assert.ok(!/isRateLimited/.test(submissions), 'the in-process-only limiter is still reachable');
});

test('every limit has a window and a ceiling a person would never reach', () => {
  for (const [action, rule] of Object.entries(LIMITS)) {
    assert.ok(rule.windowSeconds > 0, `${action} has no window`);
    assert.ok(rule.max > 0, `${action} allows nothing`);
    // A cap of one or two is a person double-clicking, not an attacker.
    assert.ok(rule.max >= 5, `${action} caps at ${rule.max}, low enough to refuse a real person`);
  }
});
