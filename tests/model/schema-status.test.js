import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const admin = readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
const handler = admin.slice(admin.indexOf("input.action === 'schema-status'"), admin.indexOf("input.action === 'assessment-queue'"));

// Code deploys automatically here; migrations wait for a human to paste SQL. The schema is
// routinely behind the code, and that gap once left the client eleven migrations ahead with
// rate limiting inert but appearing active for days.
//
// Worse, the comment describing this probe sat in api/admin.js for a while before the probe
// existed — a note claiming a capability the system did not have, which is the same disease
// that cost this project three phantom findings.

test('the probe exists, not just the comment describing it', () => {
  assert.notEqual(admin.indexOf("input.action === 'schema-status'"), -1,
    'a comment promising an active probe must be backed by an active probe');
  assert.match(handler, /limit\(0\)/, 'probes cost nothing: no rows are read');
});

test('every probe names a real migration file', () => {
  const files = new Set(readdirSync(new URL('../../supabase/migrations', import.meta.url)).map(f => f.replace(/\.sql$/, '')));
  const named = [...handler.matchAll(/migration: '([^']+)'/g)].map(m => m[1]);
  assert.ok(named.length >= 5, 'the newest migrations are covered');
  for (const m of named) {
    assert.ok(files.has(m), `${m} is a real file in supabase/migrations`);
  }
});

// The two migrations added today are the ones most likely to be unapplied when this is read.
test('the newest migrations are the first probed', () => {
  const named = [...handler.matchAll(/migration: '([^']+)'/g)].map(m => m[1]);
  const sorted = [...named].sort().reverse();
  assert.deepEqual(named, sorted, 'newest first, because that is where the gap always is');
  assert.ok(named.includes('20260801200000_audit_events'));
  assert.ok(named.includes('20260801100000_outcome_idempotency'));
});

// A status that says "something is wrong" without saying what breaks is a status nobody acts on.
test('each unapplied migration says what it costs', () => {
  const breaks = [...handler.matchAll(/breaks: '([^']+)'/g)].map(m => m[1]);
  const migrations = [...handler.matchAll(/migration: '([^']+)'/g)].length;
  assert.equal(breaks.length, migrations, 'every probe explains its own consequence');
  for (const b of breaks) {
    assert.ok(b.length > 25, `"${b}" should describe a real consequence`);
  }
  // The one that matters most: it fails open, so it looks fine while protecting nothing.
  assert.ok(breaks.some(b => /fails open/i.test(b)));
});

test('it tells the operator how to fix it', () => {
  assert.match(handler, /npm run sql/, 'names the exact command');
  assert.match(handler, /upToDate: missing\.length === 0/, 'and gives a single honest boolean');
});

// This is operator-only data: it maps the database surface.
test('the probe sits behind operator authentication', () => {
  const before = admin.slice(0, admin.indexOf("input.action === 'schema-status'"));
  const auth = before.lastIndexOf('const operator = await authorizeAdmin(req, dependencies);');
  const guard = before.lastIndexOf("return res.status(401)");
  assert.notEqual(auth, -1, 'an authorized operator is resolved first');
  assert.ok(guard > auth, 'and the request is rejected when there is not one');
});

// ── The portal error path names what failed ────────────────────────────────────────────
// A student hit a 503 whose entire content was "temporarily unavailable, check Vercel Runtime
// Logs". The log line said "Portal API failed" and named the HTTP method — for any of 28
// actions. That is a starting point, not a diagnosis, and it cost a round trip.
test('a portal failure records which action failed', () => {
  const portal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  // Bound the block by where it actually ends, not by a character count. The magic 1800
  // silently excluded the recordError call the moment the catch grew, turning a real
  // assertion into a false failure about code that had not changed.
  const at = portal.lastIndexOf('} catch (error) {');
  const end = portal.indexOf('return res.status(failure.status)', at);
  assert.ok(end > at, 'the catch must still end by returning the mapped failure');
  const block = portal.slice(at, end);
  assert.match(block, /action: failedAction/, 'the log names the action');
  assert.match(block, /recordError\('portal', 'error', detail/,
    'and it goes to error_events, which is queryable, not only to ephemeral platform logs');
});

// Both `input` and `member` are const-scoped to the try. Reading either from the catch is a
// ReferenceError. For `member` it would have been swallowed by the logging try/catch, silently
// disabling the logging; for `input` it sat OUTSIDE that guard and would have turned every
// handled portal error into an unhandled crash.
test('the catch never reads a variable scoped to the try', () => {
  const portal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
  const at = portal.lastIndexOf('} catch (error) {');
  const block = portal.slice(at).replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(block, /\binput[?.]/, '`input` is declared inside the try');
  assert.doesNotMatch(block, /\bmember\?\.user/, '`member` is declared inside the try');
  // Hoisted before the try, so they survive into the catch.
  const tryAt = portal.lastIndexOf('  try {', at);
  const head = portal.slice(tryAt - 700, tryAt);
  assert.match(head, /let attemptedAction = null;/);
  assert.match(head, /let memberId = null;/);
});
