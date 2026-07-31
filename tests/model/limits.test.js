import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLimit, recordError, safeDetail, windowStart, LIMITS } from '../../api/limits.js';

function fakeClient({ counts = {}, throwOn = null } = {}) {
  return {
    rpc: async (_fn, args) => {
      if (throwOn === 'rpc') return { data: null, error: { message: 'relation does not exist' } };
      const key = `${args.p_subject}:${args.p_action}:${args.p_window_start}`;
      counts[key] = (counts[key] || 0) + 1;
      return { data: counts[key], error: null };
    },
    from: () => ({ insert: async () => (throwOn === 'insert' ? { error: { message: 'no table' } } : { error: null }) }),
  };
}

// Every instance must agree which bucket a request falls in, without coordinating.
test('the window floors so all instances agree', () => {
  const a = windowStart(Date.parse('2026-07-27T15:01:00Z'), 3600);
  const b = windowStart(Date.parse('2026-07-27T15:59:59Z'), 3600);
  assert.equal(a, b);
  assert.notEqual(a, windowStart(Date.parse('2026-07-27T16:00:00Z'), 3600));
});

test('a caller is allowed up to the cap and refused past it', async () => {
  const counts = {};
  const client = fakeClient({ counts });
  const max = LIMITS['resume-interview'].max;
  for (let i = 0; i < max; i++) {
    const r = await checkLimit('resume-interview', 'stu', { client, now: 0 });
    assert.equal(r.allowed, true, `call ${i + 1} should be allowed`);
  }
  const over = await checkLimit('resume-interview', 'stu', { client, now: 0 });
  assert.equal(over.allowed, false);
  assert.ok(over.resetIn > 0, 'and says when to come back');
});

test('callers are counted separately', async () => {
  const counts = {};
  const client = fakeClient({ counts });
  for (let i = 0; i < LIMITS['resume-interview'].max + 1; i++) await checkLimit('resume-interview', 'a', { client, now: 0 });
  const other = await checkLimit('resume-interview', 'b', { client, now: 0 });
  assert.equal(other.allowed, true, 'one caller hitting the cap must not block another');
});

// A limiter that takes the product down when its own table is missing has caused more damage
// than the abuse it guarded against.
test('a broken limiter fails open, not closed', async () => {
  const r = await checkLimit('resume-interview', 'stu', { client: fakeClient({ throwOn: 'rpc' }), now: 0 });
  assert.equal(r.allowed, true);
  assert.match(r.skipped, /unavailable/);
});

test('an unconfigured deployment is not rate limited into a wall', async () => {
  const r = await checkLimit('resume-interview', 'stu', { env: {}, now: 0 });
  assert.equal(r.allowed, true);
});

// A log that quietly accumulates user data is a breach waiting to be found.
test('error detail drops credentials, contact details, and anything nested', () => {
  const out = safeDetail({
    slug: 'ai-ml', size: 42, ok: true,
    apiKey: 'sk-live-1', authorization: 'Bearer x', email: 'a@b.c', phone: '555',
    password: 'hunter2', nested: { a: 1 }, arr: [1, 2],
  });
  assert.deepEqual(out, { slug: 'ai-ml', size: 42, ok: true });
});

test('recording a failure never fails the request', async () => {
  const r = await recordError('media', 'error', 'boom', { client: fakeClient({ throwOn: 'insert' }) });
  assert.equal(r.stored, false, 'it reports it could not store, rather than throwing');
});

test('long values are truncated rather than stored whole', () => {
  // Deliberately not `note`: that key is now stripped outright as prose about a person, which
  // would make this assert the wrong thing. Truncation is about size, so the fixture is a key
  // that is allowed through.
  const out = safeDetail({ summary: 'x'.repeat(1000) });
  assert.equal(out.summary.length, 200);
});

// Prose written about a named person does not belong in a log. `rationale` is an operator's
// candid assessment of a candidate, `note` a founder's comment on an outcome, and `need` an
// accommodation request that can describe a disability. None is a secret; all three are worse
// to leak than a token, because a token can be rotated.
test('safeDetail strips prose written about a person', () => {
  const out = safeDetail({
    rationale: 'strong systems thinker, weak on communication',
    note: 'left after two weeks',
    need: 'I need longer than the timer allows',
    humanRationale: 'nested naming still caught',
    projectId: 'p1',
    count: 3,
  });
  assert.equal('rationale' in out, false);
  assert.equal('note' in out, false);
  assert.equal('need' in out, false);
  assert.equal('humanRationale' in out, false, 'the match is on the word, not the exact key');
  assert.equal(out.projectId, 'p1', 'ordinary identifiers still pass');
  assert.equal(out.count, 3);
});
