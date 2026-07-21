import test from 'node:test';
import assert from 'node:assert/strict';

import adminHandler, { AdminOperationalError, authorizeAdmin, listAdminSubmissions, requestAdminLink, updateAdminSubmission } from '../api/admin.js';

function authClient({ user, authError = null } = {}) {
  return {
    auth: {
      async getUser(token) { assert.equal(token, 'valid.jwt'); return { data: { user }, error: authError }; },
    },
  };
}

test('admin authorization requires both an authentic user and the operator allowlist', async () => {
  const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', COVENDA_ADMIN_EMAILS: 'operator@covenda.com' };
  const allowed = await authorizeAdmin({ headers: { authorization: 'Bearer valid.jwt' } }, {
    env,
    createSupabaseClient() { return authClient({ user: { id: 'user-1', email: 'operator@covenda.com' } }); },
  });
  assert.equal(allowed.email, 'operator@covenda.com');

  const denied = await authorizeAdmin({ headers: { authorization: 'Bearer valid.jwt' } }, {
    env,
    createSupabaseClient() { return authClient({ user: { id: 'user-2', email: 'outsider@example.com' } }); },
  });
  assert.equal(denied, null);
});

test('admin magic link never creates users and uses the current admin URL', async () => {
  let credentials;
  let clientKey;
  await requestAdminLink('operator@covenda.com', {
    headers: { host: 'proof-path.vercel.app', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.10' },
  }, {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', SUPABASE_PUBLISHABLE_KEY: 'publishable', COVENDA_ADMIN_EMAILS: 'operator@covenda.com' },
    createSupabaseClient(url, key) {
      assert.equal(url, 'https://project.supabase.co');
      clientKey = key;
      return { auth: { async signInWithOtp(input) { credentials = input; return { error: null }; } } };
    },
  });
  assert.equal(clientKey, 'publishable');
  assert.deepEqual(credentials, {
    email: 'operator@covenda.com',
    options: { shouldCreateUser: false, emailRedirectTo: 'https://proof-path.vercel.app/admin.html' },
  });
});

test('unlisted email receives a generic success without sending a link', async () => {
  let called = false;
  const result = await requestAdminLink('outsider@example.com', {
    headers: { host: 'proof-path.vercel.app', 'x-forwarded-for': '203.0.113.11' },
  }, {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', COVENDA_ADMIN_EMAILS: 'operator@covenda.com' },
    createSupabaseClient() { called = true; },
  });
  assert.deepEqual(result, { sent: true });
  assert.equal(called, false);
});

test('admin magic link reports the missing publishable key without exposing a server secret', async () => {
  await assert.rejects(
    requestAdminLink('operator@covenda.com', {
      headers: { host: 'proof-path.vercel.app', 'x-forwarded-for': '203.0.113.12' },
    }, {
      env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', COVENDA_ADMIN_EMAILS: 'operator@covenda.com' },
    }),
    error => error instanceof AdminOperationalError
      && error.code === 'ADMIN_SUPABASE_PUBLISHABLE_KEY_MISSING'
      && !error.publicMessage.includes('secret'),
  );
});

test('admin endpoint returns an actionable allowlist diagnostic', async () => {
  const response = {
    headers: {},
    statusCode: 0,
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
  };
  await adminHandler({
    method: 'POST',
    headers: { host: 'proof-path.vercel.app', 'x-forwarded-for': '203.0.113.13', 'x-vercel-id': 'test-request' },
    body: { action: 'request-link', email: 'operator@covenda.com' },
  }, response, { env: {} });
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.code, 'ADMIN_ALLOWLIST_MISSING');
  assert.match(response.payload.error, /COVENDA_ADMIN_EMAILS/);
});

test('admin list is bounded and status update accepts only lifecycle states', async () => {
  const calls = [];
  const listQuery = {
    select(value) { calls.push(['select', value]); return this; },
    order(column, options) { calls.push(['order', column, options]); return this; },
    async limit(value) { calls.push(['limit', value]); return { data: [{ reference: 'STU-AB12CD34' }], error: null }; },
  };
  const rows = await listAdminSubmissions({ from(table) { assert.equal(table, 'submissions'); return listQuery; } });
  assert.equal(rows.length, 1);
  assert.deepEqual(calls.at(-1), ['limit', 100]);

  const updateQuery = {
    update(value) { calls.push(['update', value.status]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    select(value) { calls.push(['select-update', value]); return this; },
    async single() { return { data: { reference: 'STU-AB12CD34', status: 'reviewing' }, error: null }; },
  };
  const updated = await updateAdminSubmission({ from() { return updateQuery; } }, { reference: 'stu-ab12cd34', status: 'reviewing' });
  assert.equal(updated.status, 'reviewing');
  await assert.rejects(() => updateAdminSubmission({ from() { throw new Error('must not query'); } }, { reference: 'STU-AB12CD34', status: 'deleted' }), /valid submission and status/);
});
