import test from 'node:test';
import assert from 'node:assert/strict';

import adminHandler, { AdminOperationalError, authorizeAdmin, listAdminProjectRequests, listAdminSubmissions, publishProjectRequest, requestAdminLink, saveProjectRequestPackaging, updateAdminSubmission, verifyPartnerSubmission } from '../api/admin.js';

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

test('admin magic link uses the configured deployed URL over the request host', async () => {
  let credentials;
  await requestAdminLink('configured-operator@covenda.com', {
    headers: { host: 'untrusted-preview.example', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.12' },
  }, {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', SUPABASE_PUBLISHABLE_KEY: 'publishable', COVENDA_ADMIN_EMAILS: 'configured-operator@covenda.com', COVENDA_APP_URL: 'https://app.covenda.com' },
    createSupabaseClient() { return { auth: { async signInWithOtp(input) { credentials = input; return { error: null }; } } }; },
  });
  assert.equal(credentials.options.emailRedirectTo, 'https://app.covenda.com/admin.html');
});

test('unlisted email receives a generic success without sending a link', async () => {
  let called = false;
  const result = await requestAdminLink('outsider@example.com', {
    headers: { host: 'proof-path.vercel.app', 'x-forwarded-for': '203.0.113.11' },
  }, {
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'secret', COVENDA_ADMIN_EMAILS: 'operator@covenda.com' },
    createSupabaseClient() { called = true; },
  });
  assert.deepEqual(result, { accepted: true, delivery: 'suppressed' });
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

test('admin magic link identifies Supabase project and delivery configuration failures', async () => {
  const cases = [
    ['otp_disabled', 'ADMIN_MAGIC_LINK_OTP_DISABLED', /same Supabase project connected to Vercel/],
    ['over_email_send_rate_limit', 'ADMIN_MAGIC_LINK_RATE_LIMITED', /rate-limited/],
    ['email_address_not_authorized', 'ADMIN_MAGIC_LINK_EMAIL_UNAUTHORIZED', /custom SMTP/],
    ['email_provider_disabled', 'ADMIN_MAGIC_LINK_EMAIL_DISABLED', /Email provider/],
  ];

  for (const [authCode, expectedCode, expectedMessage] of cases) {
    await assert.rejects(
      requestAdminLink('operator@covenda.com', {
        headers: { host: 'proof-path.vercel.app', 'x-forwarded-for': `203.0.113.${20 + cases.findIndex(item => item[0] === authCode)}` },
      }, {
        env: {
          SUPABASE_URL: 'https://project.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'publishable',
          COVENDA_ADMIN_EMAILS: 'operator@covenda.com',
        },
        createSupabaseClient() {
          return { auth: { async signInWithOtp() { return { error: { code: authCode, message: authCode } }; } } };
        },
      }),
      error => error instanceof AdminOperationalError
        && error.code === expectedCode
        && expectedMessage.test(error.publicMessage),
    );
  }
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

test('admin endpoint returns a traceable generic success without exposing allowlist state', async () => {
  const response = {
    headers: {}, statusCode: 0, payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
  };
  await adminHandler({
    method: 'POST',
    headers: { host: 'proof-path.vercel.app', 'x-forwarded-for': '203.0.113.14', 'x-vercel-id': 'iad1::trace-123' },
    body: { action: 'request-link', email: 'outsider@example.com' },
  }, response, { env: { COVENDA_ADMIN_EMAILS: 'operator@covenda.com' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.requestId, 'trace-123');
  assert.doesNotMatch(JSON.stringify(response.payload), /suppressed|outsider/i);
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
  await assert.rejects(() => updateAdminSubmission({ from() { throw new Error('must not query'); } }, { reference: 'STU-AB12CD34', status: 'deleted' }), /valid submission status/);
});

test('operator packaging is bounded and publishing requires every safety clearance', async () => {
  const request={id:'123e4567-e89b-12d3-a456-426614174000',status:'submitted'};
  let updateValue;
  const supabase={from(table){assert.equal(table,'project_requests');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:request,error:null};},update(value){updateValue=value;return this;},async single(){return {data:{...request,...updateValue},error:null};}};}};
  const saved=await saveProjectRequestPackaging(supabase,{requestId:request.id,packet:{title:'Research packet',credits:200}},'operator@covenda.com');
  assert.equal(saved.status,'in_packaging');
  assert.equal(saved.packet_draft.title,'Research packet');
  await assert.rejects(publishProjectRequest(supabase,{requestId:request.id,packet:{title:'Research packet',summary:'A useful public-source research summary.',deliverable:'A cited comparison and recommendation.',acceptanceCriteria:'All requested companies are cited.',safeInputs:'Only public websites and the supplied template.',credits:200},safety:{clientRecords:false,pii:false,productionAccess:false}}),/Clear every safety boundary/);
});

test('project request listing is bounded for the operator queue', async () => {
  const query={select(value){assert.equal(value,'*');return this;},order(column,options){assert.equal(column,'created_at');assert.equal(options.ascending,false);return this;},async limit(value){assert.equal(value,200);return {data:[{id:'r1'}],error:null};}};
  const result=await listAdminProjectRequests({from(table){assert.equal(table,'project_requests');return query;}});
  assert.equal(result.length,1);
});

test('admin workflow update validates and records private follow-up context', async () => {
  let update;
  const updateQuery = {
    update(value) { update = value; return this; },
    eq(column, value) { assert.equal(column, 'reference'); assert.equal(value, 'EMP-AB12CD34'); return this; },
    select(value) { assert.equal(value, '*'); return this; },
    async single() { return { data: { reference: 'EMP-AB12CD34', ...update }, error: null }; },
  };
  const result = await updateAdminSubmission(
    { from(table) { assert.equal(table, 'submissions'); return updateQuery; } },
    { reference: 'emp-ab12cd34', internal_note: 'Needs a scoped follow-up.', follow_up_at: '2026-07-24T15:30:00.000Z' },
    'OPERATOR@COVENDA.COM',
  );
  assert.equal(result.internal_note, 'Needs a scoped follow-up.');
  assert.equal(result.follow_up_at, '2026-07-24T15:30:00.000Z');
  assert.equal(result.reviewed_by, 'operator@covenda.com');
  assert.match(result.reviewed_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(result.updated_at, result.reviewed_at);

  await assert.rejects(
    () => updateAdminSubmission({ from() { throw new Error('must not query'); } }, { reference: 'EMP-AB12CD34', internal_note: 'x'.repeat(2_001) }),
    /under 2,000 characters/,
  );
  await assert.rejects(
    () => updateAdminSubmission({ from() { throw new Error('must not query'); } }, { reference: 'EMP-AB12CD34', follow_up_at: 'not-a-date' }),
    /valid follow-up date/,
  );
});

test('partner certification is founder-confirmed separately from submission approval', async () => {
  const current = { reference:'REF-AB12CD34', submission_type:'referrer_endorsement', status:'approved', partner_verified:false, founding_partner:false };
  let changes;
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data:current, error:null }; },
    update(value) { changes=value; return this; },
    async single() { return { data:{...current,...changes}, error:null }; },
  };
  const result = await verifyPartnerSubmission({ from(table) { assert.equal(table,'submissions'); return query; } }, {
    reference:'ref-ab12cd34', partnerVerified:true, foundingPartner:true,
  }, 'FOUNDER@COVENDA.APP');
  assert.equal(result.partner_verified,true);
  assert.equal(result.founding_partner,true);
  assert.equal(result.partner_verified_by,'founder@covenda.app');
  assert.match(result.partner_verified_at,/^\d{4}-\d{2}-\d{2}T/);

  const pendingQuery = { select(){return this;},eq(){return this;},async maybeSingle(){return {data:{...current,status:'reviewing'},error:null};} };
  await assert.rejects(
    verifyPartnerSubmission({from(){return pendingQuery;}},{reference:'REF-AB12CD34',partnerVerified:true},'founder@covenda.app'),
    /Approve the submission/,
  );
});
