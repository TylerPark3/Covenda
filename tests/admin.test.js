import test from 'node:test';
import assert from 'node:assert/strict';

import adminHandler, { AdminOperationalError, authorizeAdmin, caseStudyMetrics, deleteAdminProject, deleteAdminUser, listAdminProjects, listAdminRequests, listAdminSubmissions, requestAdminLink, reviewStudentVisibility, summarizeLedger, updateAdminRequest, updateAdminSubmission, verifyAdminCode } from '../api/admin.js';

test('deleteAdminUser removes a member but never the operator themselves', async () => {
  const uid = 'f65be0ad-7607-4c38-a1e1-095c34ad4f11';
  let deletedId = '';
  const supabase = {
    auth: { admin: {
      getUserById: async (id) => ({ data: { user: { email: id === uid ? 'member@x.com' : 'ops@covenda.com' } } }),
      deleteUser: async (id) => { deletedId = id; return { error: null }; },
    } },
  };
  const out = await deleteAdminUser(supabase, { userId: uid }, 'ops@covenda.com');
  assert.equal(out.deleted, uid);
  assert.equal(deletedId, uid);

  // Self-delete: the target's email matches the operator → blocked, deleteUser never called.
  deletedId = '';
  const selfSupabase = { auth: { admin: {
    getUserById: async () => ({ data: { user: { email: 'ops@covenda.com' } } }),
    deleteUser: async (id) => { deletedId = id; return { error: null }; },
  } } };
  await assert.rejects(deleteAdminUser(selfSupabase, { userId: uid }, 'ops@covenda.com'), /cannot delete your own/);
  assert.equal(deletedId, '');
});

test('deleteAdminUser rejects a malformed user id', async () => {
  await assert.rejects(deleteAdminUser({}, { userId: 'nope' }, 'ops@covenda.com'), /valid user/);
});

test('deleteAdminProject deletes by id (cascade handles children) and validates the id', async () => {
  const pid = 'f65be0ad-7607-4c38-a1e1-095c34ad4f11';
  let deletedFrom = '', deletedId = '';
  const supabase = { from: (table) => ({ delete: () => ({ eq: async (_col, val) => { deletedFrom = table; deletedId = val; return { error: null }; } }) }) };
  const out = await deleteAdminProject(supabase, { projectId: pid });
  assert.equal(out.deleted, pid);
  assert.equal(deletedFrom, 'member_projects');
  assert.equal(deletedId, pid);
  await assert.rejects(deleteAdminProject({}, { projectId: 'nope' }), /valid project/);
  const failing = { from: () => ({ delete: () => ({ eq: async () => ({ error: { message: 'boom' } }) }) }) };
  await assert.rejects(deleteAdminProject(failing, { projectId: pid }), /deleting this project failed/);
});

test('listAdminProjects returns rows and degrades to [] on error', async () => {
  const ok = { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [{ id: 'a', title: 'T', status: 'open' }], error: null }) }) }) }) };
  assert.deepEqual(await listAdminProjects(ok), [{ id: 'a', title: 'T', status: 'open' }]);
  const bad = { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'x' } }) }) }) }) };
  assert.deepEqual(await listAdminProjects(bad), []);
});

const codeEnv = { COVENDA_ADMIN_EMAILS: 'ops@covenda.com', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pub' };

test('verifyAdminCode exchanges a valid 6-digit code for a session token', async () => {
  const createSupabaseClient = () => ({ auth: { verifyOtp: async ({ token }) => (
    token === '123456'
      ? { data: { session: { access_token: 'tok-123', user: { email: 'ops@covenda.com' } }, user: { email: 'ops@covenda.com' } }, error: null }
      : { data: null, error: { message: 'invalid' } }
  ) } });
  const out = await verifyAdminCode('ops@covenda.com', '123456', { env: codeEnv, createSupabaseClient });
  assert.equal(out.accessToken, 'tok-123');
  await assert.rejects(verifyAdminCode('ops@covenda.com', '999999', { env: codeEnv, createSupabaseClient }), /invalid or has expired/);
});

test('verifyAdminCode rejects a short code and a non-allowlisted operator', async () => {
  await assert.rejects(verifyAdminCode('ops@covenda.com', '12', { env: codeEnv }), /6-digit code/);
  const createSupabaseClient = () => ({ auth: { verifyOtp: async () => ({ data: { session: { access_token: 'tok', user: { email: 'evil@x.com' } }, user: { email: 'evil@x.com' } }, error: null }) } });
  await assert.rejects(verifyAdminCode('evil@x.com', '123456', { env: codeEnv, createSupabaseClient }), /not an authorized operator/);
});

test('caseStudyMetrics computes acceptance, repeat, and avg value from real rows', () => {
  const completed = [
    { owner_user_id: 'co-a', credits_listed: 400 },
    { owner_user_id: 'co-a', credits_listed: 600 }, // co-a is a repeat buyer
    { owner_user_id: 'co-b', credits_listed: 500 },
  ];
  const m = caseStudyMetrics(completed, { applications: 10, accepted: 4 });
  assert.equal(m.delivered, 3);
  assert.equal(m.acceptanceRate, 40);
  assert.equal(m.repeatRate, 50, '1 of 2 companies delivered 2+');
  assert.equal(m.avgDeliveredCredits, 500);
});

test('caseStudyMetrics is zero-safe with no data', () => {
  assert.deepEqual(caseStudyMetrics(), { delivered: 0, acceptanceRate: 0, repeatRate: 0, avgDeliveredCredits: 0 });
});

test('summarizeLedger splits money-in, platform revenue, and student payouts', () => {
  const rows = [
    { entry_type: 'purchase', credits: 500, user_id: 'co' },
    { entry_type: 'purchase', credits: 100, user_id: 'co' },
    { entry_type: 'reach_fee', credits: 25, user_id: null },        // platform revenue
    { entry_type: 'reach_fee', credits: -25, user_id: 'co' },       // company side, ignored
    { entry_type: 'batch_access', credits: 50, user_id: null },     // platform revenue
    { entry_type: 'escrow_release', credits: 200, user_id: 'stu' }, // paid to a student
    { entry_type: 'escrow_hold', credits: -200, user_id: 'co' },    // ignored
  ];
  const out = summarizeLedger(rows);
  assert.equal(out.purchased, 600);
  assert.equal(out.platformRevenue, 75);
  assert.equal(out.toStudents, 200);
});

test('summarizeLedger is zero-safe on empty input', () => {
  assert.deepEqual(summarizeLedger(), { purchased: 0, platformRevenue: 0, toStudents: 0 });
});

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

test('admin request triage validates and updates status + resolution, and lists degrade if unmigrated', async () => {
  const REQ = 'f65be0ad-7607-4c38-a1e1-095c34ad4f11';
  const updateQuery = { update(v) { this._v = v; return this; }, eq() { return this; }, select() { return this; }, async single() { return { data: { id: REQ, status: 'in_packaging', resolution_note: 'packaging now' }, error: null }; } };
  const updated = await updateAdminRequest({ from() { return updateQuery; } }, { id: REQ, status: 'in_packaging', resolution_note: 'packaging now' });
  assert.equal(updated.status, 'in_packaging');
  await assert.rejects(() => updateAdminRequest({ from() { throw new Error('must not query'); } }, { id: REQ, status: 'nope' }), /valid request status/);
  await assert.rejects(() => updateAdminRequest({ from() { throw new Error('must not query'); } }, { id: 'not-a-uuid', status: 'closed' }), /valid request/);
  // listAdminRequests returns [] when the table isn't there yet, so the inbox never breaks.
  const rows = await listAdminRequests({ from() { return { select() { return this; }, order() { return this; }, async limit() { return { data: null, error: { message: 'relation "project_requests" does not exist' } }; } }; } });
  assert.deepEqual(rows, []);
});

test('operator visibility approval requires a rationale and rechecks the objective gates', async () => {
  const reviewId='f65be0ad-7607-4c38-a1e1-095c34ad4f11';
  const calls=[];
  const rows={
    student_visibility_reviews:{id:reviewId,student_user_id:'student-1',status:'pending'},
    member_profiles:{display_name:'Sam',school_name:'Columbia',headline:'Data builder',capability_areas:['AI & data'],identity_verified:true},
    student_evidence_items:[{id:'evidence-1'}],
  };
  const supabase={
    from(table){
      const query={select(){return query;},eq(){return query;},limit(){return query;},maybeSingle:async()=>({data:rows[table],error:null}),then(resolve){return Promise.resolve({data:rows[table],error:null}).then(resolve);}};
      return query;
    },
    async rpc(name,args){calls.push({name,args});return {data:{id:reviewId,status:'approved'},error:null};},
  };
  await assert.rejects(reviewStudentVisibility(supabase,{reviewId,decision:'approved',note:''},'ops@covenda.com'),/Record the reason/);
  const result=await reviewStudentVisibility(supabase,{reviewId,decision:'approved',note:'Evidence is attributable and the profile is complete.'},'ops@covenda.com');
  assert.equal(result.status,'approved');
  assert.equal(calls[0].name,'review_student_visibility');
  assert.equal(calls[0].args.p_reviewed_by,'ops@covenda.com');
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

test('repeatCompanyRate: companies with a second accepted project over companies with one', async () => {
  const { repeatCompanyRate } = await import('../api/admin.js');
  const rows = [
    { owner_user_id: 'a' }, { owner_user_id: 'a' }, { owner_user_id: 'b' },
    { owner_user_id: 'c' }, { owner_user_id: 'c' }, { owner_user_id: 'c' }, { owner_user_id: null },
  ];
  assert.deepEqual(repeatCompanyRate(rows), { companiesWithOne: 3, companiesWithRepeat: 2, rate: 2 / 3 });
  assert.deepEqual(repeatCompanyRate([]), { companiesWithOne: 0, companiesWithRepeat: 0, rate: 0 });
});

test('decideMatch demands a rationale — every human decision is a training label', async () => {
  const { decideMatch } = await import('../api/admin.js');
  const mid = 'f65be0ad-7607-4c38-a1e1-095c34ad4f11';
  await assert.rejects(decideMatch({}, { matchId: mid, decision: 'selected', rationale: '' }), /rationale/);
  await assert.rejects(decideMatch({}, { matchId: 'nope', decision: 'selected', rationale: 'x' }), /valid match/);
  await assert.rejects(decideMatch({}, { matchId: mid, decision: 'hired', rationale: 'x' }), /Choose a decision/);
  let updated = null;
  const supabase = { from: () => ({ update(row) { updated = row; return this; }, eq() { return this; }, select() { return this; }, async single() { return { data: { id: mid, ...updated }, error: null }; } }) };
  const out = await decideMatch(supabase, { matchId: mid, decision: 'selected', rationale: 'Trial-proven ROS work; vouch from coach.' });
  assert.equal(out.human_decision, 'selected');
  assert.ok(out.human_rationale.length > 0);
});
