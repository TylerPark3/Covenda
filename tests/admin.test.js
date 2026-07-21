import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeAdmin, listAdminSubmissions, requestAdminLink, updateAdminSubmission } from '../api/admin.js';

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
  await requestAdminLink('operator@covenda.com', {
    headers: { host: 'proof-path.vercel.app', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.10' },
  }, {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', COVENDA_ADMIN_EMAILS: 'operator@covenda.com' },
    createSupabaseClient() {
      return { auth: { async signInWithOtp(input) { credentials = input; return { error: null }; } } };
    },
  });
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
