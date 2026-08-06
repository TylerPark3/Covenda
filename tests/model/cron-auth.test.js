import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isAuthorisedCron, rejectUnauthorisedCron } from '../../api/cron-auth.js';

const apiDir = new URL('../../api/', import.meta.url);
const request = (headers = {}) => ({ headers });
const response = () => ({
  code: 0,
  body: null,
  status(c) { this.code = c; return this; },
  json(b) { this.body = b; return this; },
});

// ── The two holes this closes ──────────────────────────────────────────────────────────

// CRON_SECRET was never set in production. `Bearer ${process.env.CRON_SECRET || ''}` therefore
// compared against the literal string "Bearer ", so a request sending exactly that ran the job.
test('an unset secret admits nobody, including the empty bearer it used to admit', () => {
  assert.equal(isAuthorisedCron(request({ authorization: 'Bearer ' }), {}), false);
  assert.equal(isAuthorisedCron(request({ authorization: 'Bearer' }), {}), false);
  assert.equal(isAuthorisedCron(request({ authorization: '' }), {}), false);
  assert.equal(isAuthorisedCron(request({}), {}), false);
});

// The header is written by the caller, so it was never evidence of anything. The new host does
// not send it at all, which makes trusting it both unsafe and pointless.
test('a self-declared cron header is not a credential', () => {
  const env = { CRON_SECRET: 'real-secret' };
  assert.equal(isAuthorisedCron(request({ 'x-vercel-cron': '1' }), env), false);
  assert.equal(isAuthorisedCron(request({ 'x-vercel-cron': '1', authorization: 'Bearer wrong' }), env), false);
});

test('no handler still reads that header', () => {
  for (const f of readdirSync(apiDir).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(new URL(f, apiDir), 'utf8');
    const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(code, /headers\[['"]x-vercel-cron['"]\]/, `api/${f} must not trust it`);
  }
});

// ── What still works ───────────────────────────────────────────────────────────────────

test('the configured secret is accepted, and near-misses are not', () => {
  const env = { CRON_SECRET: 'real-secret' };
  assert.equal(isAuthorisedCron(request({ authorization: 'Bearer real-secret' }), env), true);
  assert.equal(isAuthorisedCron(request({ authorization: 'Bearer real-secre' }), env), false);
  assert.equal(isAuthorisedCron(request({ authorization: 'Bearer real-secrets' }), env), false);
  assert.equal(isAuthorisedCron(request({ authorization: 'real-secret' }), env), false);
  assert.equal(isAuthorisedCron(request({ authorization: 'bearer real-secret' }), env), false);
});

test('a length mismatch is a rejection, not a thrown timingSafeEqual', () => {
  assert.doesNotThrow(() => isAuthorisedCron(request({ authorization: 'x' }), { CRON_SECRET: 'longer-secret' }));
});

// ── The gate the handlers call ─────────────────────────────────────────────────────────

test('an unauthorised request gets 401 and the handler stops', () => {
  const res = response();
  assert.equal(rejectUnauthorisedCron(request({}), res, { CRON_SECRET: 's', NODE_ENV: 'production' }), true);
  assert.equal(res.code, 401);
  assert.equal(res.body.ok, false);
});

test('an authorised request is not answered here', () => {
  const res = response();
  assert.equal(rejectUnauthorisedCron(request({ authorization: 'Bearer s' }), res, { CRON_SECRET: 's' }), false);
  assert.equal(res.code, 0, 'the gate wrote nothing, so the handler owns the response');
});

// A deploy that loses NODE_ENV is exactly the situation where the old check opened the door:
// it only enforced when NODE_ENV was *present and* equal to production.
test('a missing NODE_ENV locks the door rather than opening it', () => {
  const res = response();
  assert.equal(rejectUnauthorisedCron(request({}), res, {}), true);
  assert.equal(res.code, 401);
});

test('local development can still run the job by hand', () => {
  const res = response();
  assert.equal(rejectUnauthorisedCron(request({}), res, { NODE_ENV: 'development' }), false);
  assert.equal(res.code, 0);
});

// ── Every scheduled endpoint goes through it ───────────────────────────────────────────
test('each cron handler gates on the shared check', () => {
  const vercelJson = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  for (const cron of vercelJson.crons) {
    const file = `${cron.path.split('/').pop()}.js`;
    const src = readFileSync(new URL(file, apiDir), 'utf8');
    assert.match(src, /import \{ rejectUnauthorisedCron \} from '\.\/cron-auth\.js'/, `${file} imports it`);
    assert.match(src, /if \(rejectUnauthorisedCron\(req, res\)\) return;/, `${file} calls it and returns`);
  }
});
