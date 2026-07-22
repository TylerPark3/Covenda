import test from 'node:test';
import assert from 'node:assert/strict';

import { acceptApplication, authorizeMember, buyCredits, cancelProject, createMemberProject, creditBalance, fulfilPayout, loadMemberIntakes, looksLikeAccountNumber, memberAuthReadiness, projectCreditCost, rankOpportunities, requestGoogleLogin, requestMemberLink, requestPayout, reviewDeliverable, saveMemberProfile, sendProjectMessage, submitDeliverable } from '../api/portal.js';

// A queued Supabase double: each from() call consumes the next step in order. A step
// resolves maybeSingle()/single()/await to its `result` and can `capture` an update/
// insert payload — enough to assert the close-the-loop state transitions.
function queuedSupabase(steps) {
  let index = 0;
  const rpcCalls = [];
  return {
    rpcCalls,
    rpc(name, args) {
      const step = steps[index++] || { result: null };
      rpcCalls.push({ name, args });
      step.capture?.(args);
      return Promise.resolve({ data: step.result, error: null });
    },
    from() {
      const step = steps[index++] || { result: null };
      const query = {};
      const same = () => query;
      for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit']) query[method] = same;
      query.update = value => { step.capture?.(value); return query; };
      query.insert = value => { step.capture?.(value); return query; };
      query.maybeSingle = () => Promise.resolve({ data: step.result, error: null });
      query.single = () => Promise.resolve({ data: step.result, error: null });
      query.then = (onFulfilled, onRejected) => Promise.resolve({ data: step.result, error: null }).then(onFulfilled, onRejected);
      return query;
    },
  };
}
const PROJECT_UUID = 'f65be0ad-7607-4c38-a1e1-095c34ad4f11';
const APPLICATION_UUID = 'a1b2c3d4-7607-4c38-a1e1-095c34ad4f11';

const authEnv = { SUPABASE_URL:'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY:'publishable', SUPABASE_SECRET_KEY:'secret' };

test('member magic link creates a user and returns to the current portal URL', async () => {
  let input;
  await requestMemberLink('student@example.com', { headers:{ host:'covenda.vercel.app','x-forwarded-proto':'https','x-forwarded-for':'203.0.113.80' } }, {
    env:authEnv,
    createSupabaseClient(url,key) {
      assert.equal(url,authEnv.SUPABASE_URL); assert.equal(key,'publishable');
      return { auth:{ async signInWithOtp(value){input=value;return {error:null};} } };
    },
  });
  assert.deepEqual(input,{ email:'student@example.com',options:{shouldCreateUser:true,emailRedirectTo:'https://covenda.vercel.app/portal.html'} });
});

test('Google member login returns a Supabase OAuth URL without a browser-side secret', async () => {
  let input;
  const result=await requestGoogleLogin({headers:{host:'covenda.vercel.app','x-forwarded-proto':'https'}},{
    env:authEnv,
    createSupabaseClient(url,key){assert.equal(key,'publishable');return {auth:{async signInWithOAuth(value){input=value;return {data:{url:'https://accounts.google.com/o/oauth2/auth'},error:null};}}};},
  });
  assert.equal(result.url,'https://accounts.google.com/o/oauth2/auth');
  assert.deepEqual(input,{provider:'google',options:{redirectTo:'https://covenda.vercel.app/portal.html',skipBrowserRedirect:true}});
});

test('auth readiness reports whether Google is enabled in the connected Supabase project', async () => {
  let requestedUrl;
  const result=await memberAuthReadiness({env:authEnv,async fetchImpl(url,options){requestedUrl=url;assert.equal(options.headers.apikey,'publishable');return {ok:true,async json(){return {external:{google:true}};}};}});
  assert.equal(requestedUrl,'https://project.supabase.co/auth/v1/settings');
  assert.equal(result.googleConfigured,true);
});

test('member authorization validates the bearer token with the server-side Supabase client', async () => {
  const result=await authorizeMember({headers:{authorization:'Bearer valid.jwt'}},{
    env:authEnv,
    createSupabaseClient(url,key){assert.equal(key,'secret');return {auth:{async getUser(token){assert.equal(token,'valid.jwt');return {data:{user:{id:'user-1',email:'MEMBER@example.com',user_metadata:{full_name:'Member'}}},error:null};}}};},
  });
  assert.equal(result.user.email,'member@example.com');
  assert.equal(result.user.metadata.full_name,'Member');
});

test('member intake receipts are loaded only for the authenticated email', async () => {
  const expected=[{reference:'STU-ABC12345',submission_type:'student_interest',status:'received'}];
  const supabase={from(table){assert.equal(table,'submissions');return {select(columns){assert.match(columns,/reference,submission_type,status/);return this;},eq(column,value){assert.equal(column,'submitter_email');assert.equal(value,'student@example.com');return this;},order(column,options){assert.equal(column,'created_at');assert.equal(options.ascending,false);return this;},async limit(value){assert.equal(value,100);return {data:expected,error:null};}};}};
  const intakes=await loadMemberIntakes({user:{email:'student@example.com'},supabase});
  assert.deepEqual(intakes,expected);
});

test('profile onboarding persists a fixed role and sanitized member fields', async () => {
  let saved;
  const supabase={from(table){assert.equal(table,'member_profiles');return {
    select(){return this;},eq(){return this;},async maybeSingle(){return {data:null,error:null};},
    upsert(value){saved=value;return this;},async single(){return {data:saved,error:null};},
  };}};
  const profile=await saveMemberProfile({user:{id:'user-1'},supabase},{role:'student',displayName:' Dylan Wang ',schoolName:'Columbia',skills:'Research, Excel, Research',graduationYear:'2028',portfolioVisibility:'members'});
  assert.equal(profile.role,'student');
  assert.deepEqual(profile.skills,['Research','Excel']);
  assert.equal(profile.school_name,'Columbia');
  assert.equal(profile.onboarding_complete,true);
});

test('onboarding persists only whitelisted verticals and work types plus an avatar url', async () => {
  let saved;
  const supabase={from(table){assert.equal(table,'member_profiles');return {
    select(){return this;},eq(){return this;},async maybeSingle(){return {data:null,error:null};},
    upsert(value){saved=value;return this;},async single(){return {data:saved,error:null};},
  };}};
  const profile=await saveMemberProfile({user:{id:'user-1'},supabase},{
    role:'student',displayName:'Maya',
    verticals:['Software & AI','Not a real vertical','Accounting & finance'],
    workTypes:['Research','Nonsense','QA & testing'],
    avatarUrl:'https://blob.example/a.png',portfolioVisibility:'members',
  });
  assert.deepEqual(profile.verticals,['Software & AI','Accounting & finance']);
  assert.deepEqual(profile.work_types,['Research','QA & testing']);
  assert.equal(profile.avatar_url,'https://blob.example/a.png');
});

test('the existing profile modal save omits onboarding columns so it works before the migration', async () => {
  let saved;
  const supabase={from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:null,error:null};},upsert(value){saved=value;return this;},async single(){return {data:saved,error:null};}};}};
  await saveMemberProfile({user:{id:'user-1'},supabase},{role:'student',displayName:'Maya',portfolioVisibility:'members'});
  assert.equal('verticals' in saved,false);
  assert.equal('work_types' in saved,false);
  assert.equal('avatar_url' in saved,false);
});

test('credit cost charges the platform fee ON TOP so the student keeps the full listed amount', () => {
  const publicPost = projectCreditCost(200, 'public');
  assert.deepEqual(publicPost, { listed: 200, reachFee: 0, platformFee: 20, total: 220 });
  const targeted = projectCreditCost(200, 'targeted');
  assert.deepEqual(targeted, { listed: 200, reachFee: 25, platformFee: 20, total: 245 });
  // the listed amount is never reduced by the fee — that is the student's payout
  assert.equal(targeted.listed, 200);
  assert.equal(projectCreditCost(0, 'public').total, 0);
  assert.equal(projectCreditCost(-50, 'public').listed, 0);
});

test('balance is the signed sum of the ledger, and platform rows never touch it', async () => {
  const supabase = { from() { return { select() { return this; }, eq(column, value) { assert.equal(column, 'user_id'); assert.equal(value, 'company-1'); return Promise.resolve({ data: [{ credits: 500 }, { credits: -25 }, { credits: -220 }], error: null }); } }; } };
  assert.equal(await creditBalance({ user: { id: 'company-1' }, supabase }), 255);
});

test('posting a priced project holds escrow, charges the reach fee, and books both sides', async () => {
  let inserted, ledger;
  const supabase = { from(table) {
    if (table === 'member_profiles') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role: 'company' }, error: null }; } };
    if (table === 'credit_ledger') return {
      select() { return this; },
      eq() { return Promise.resolve({ data: [{ credits: 1000 }], error: null }); },
      insert(value) { ledger = value; return this; },
      then(onF, onR) { return Promise.resolve({ data: [], error: null }).then(onF, onR); },
    };
    return { insert(value) { inserted = value; return this; }, select() { return this; }, async single() { return { data: { id: 'proj-1', ...inserted }, error: null }; } };
  } };
  const project = await createMemberProject({ user: { id: 'company-1' }, supabase }, {
    title: 'Pricing scan', summary: 'A public-source competitor pricing scan.', visibility: 'members',
    creditsListed: 200, targeting: 'targeted',
  });
  assert.equal(project.credits_listed, 200);
  assert.equal(project.credits_held, 200);
  assert.equal(project.platform_fee_credits, 20);
  assert.equal(project.targeting, 'targeted');
  const byType = Object.fromEntries(ledger.map(row => [`${row.entry_type}:${row.user_id === null ? 'platform' : 'member'}`, row.credits]));
  assert.equal(byType['reach_fee:member'], -25);
  assert.equal(byType['reach_fee:platform'], 25);   // platform revenue is booked, not implied
  assert.equal(byType['escrow_hold:member'], -220); // listed + fee held together
});

test('a project is rejected when the balance cannot cover listed + fee + reach', async () => {
  const supabase = { from(table) {
    if (table === 'member_profiles') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role: 'company' }, error: null }; } };
    return { select() { return this; }, eq() { return Promise.resolve({ data: [{ credits: 100 }], error: null }); } };
  } };
  await assert.rejects(
    createMemberProject({ user: { id: 'company-1' }, supabase }, { title: 'Scan', summary: 'A public-source scan of competitors.', creditsListed: 200, targeting: 'targeted' }),
    /needs 245 credits.*balance is 100/,
  );
});

test('credits cannot be minted unless the deployment enables it', async () => {
  const supabase = { from() { return { insert() { return this; }, select() { return this; }, async single() { return { data: { id: 'l1' }, error: null }; }, eq() { return Promise.resolve({ data: [{ credits: 100 }], error: null }); } }; } };
  const member = { user: { id: 'company-1', email: 'ops@acme.com' }, supabase };
  await assert.rejects(buyCredits(member, { credits: 100 }, {}), /does not have credit purchases enabled/);
  await assert.rejects(buyCredits(member, { credits: 7 }, { COVENDA_CREDIT_GRANTS_ENABLED: 'true' }), /Choose one of the available/);
  const result = await buyCredits(member, { credits: 100 }, { COVENDA_CREDIT_GRANTS_ENABLED: 'true' });
  assert.equal(result.balance, 100);
  // an operator on the allowlist can grant without the flag
  await buyCredits(member, { credits: 500 }, { COVENDA_ADMIN_EMAILS: 'ops@acme.com' });
});

test('a payout request is bounded by the balance and never stores an account number', async () => {
  const ledger = credits => ({ select() { return this; }, eq() { return Promise.resolve({ data: [{ credits }], error: null }); } });
  const db = (balance, existingOpen = null, capture) => ({
    from(table) {
      if (table === 'credit_ledger') return ledger(balance);
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: existingOpen, error: null }; },
        insert(value) { capture?.(value); return this; },
        async single() { return { data: { id: 'req-1', ...value_ }, error: null }; },
      };
      function value_() {}
    },
  });
  // over-drawing is rejected
  await assert.rejects(
    requestPayout({ user: { id: 'stu' }, supabase: db(50) }, { credits: 200, method: 'PayPal', handle: 'a@b.com' }),
    /larger than your balance of 50/,
  );
  // a raw account number is refused rather than quietly stored
  await assert.rejects(
    requestPayout({ user: { id: 'stu' }, supabase: db(500) }, { credits: 100, method: 'PayPal', handle: '4111 1111 1111 1111' }),
    /instead of an account number/,
  );
  // an unknown method is refused
  await assert.rejects(
    requestPayout({ user: { id: 'stu' }, supabase: db(500) }, { credits: 100, method: 'Crypto', handle: 'a@b.com' }),
    /Choose how you would like to be paid/,
  );
  // one open request at a time
  await assert.rejects(
    requestPayout({ user: { id: 'stu' }, supabase: db(500, { id: 'existing' }) }, { credits: 100, method: 'PayPal', handle: 'a@b.com' }),
    /already have a payout request/,
  );
});

test('account-number detection catches raw numbers but allows emails and handles', () => {
  assert.equal(looksLikeAccountNumber('4111111111111111'), true);
  assert.equal(looksLikeAccountNumber('4111 1111 1111 1111'), true);
  assert.equal(looksLikeAccountNumber('123-456-7890'), true);
  assert.equal(looksLikeAccountNumber('maya@example.com'), false);
  assert.equal(looksLikeAccountNumber('@maya'), false);
});

test('only a listed operator can settle a payout', async () => {
  const supabase = queuedSupabase([{ result: { id: 'req-1', status: 'paid' } }]);
  await assert.rejects(
    fulfilPayout({ user: { id: 'stu', email: 'student@example.com' }, supabase }, { requestId: PROJECT_UUID }, { COVENDA_ADMIN_EMAILS: 'ops@covenda.app' }),
    /Only a Covenda operator/,
  );
  const settled = await fulfilPayout({ user: { id: 'op', email: 'ops@covenda.app' }, supabase }, { requestId: PROJECT_UUID }, { COVENDA_ADMIN_EMAILS: 'ops@covenda.app' });
  assert.equal(settled.status, 'paid');
  assert.equal(supabase.rpcCalls[0].name, 'fulfil_payout_request');
});

test('opportunities matching the student vertical or work type are flagged and sorted first', () => {
  const ranked = rankOpportunities([
    { id: '1', verticals: ['Consumer & retail'], work_types: ['Operations'] },
    { id: '2', verticals: ['Software & AI'], work_types: [] },
    { id: '3', verticals: [], work_types: ['Research'] },
  ], { verticals: ['Software & AI'], work_types: ['Research'] });
  assert.equal(ranked[0].matched, true);
  assert.equal(ranked[ranked.length - 1].id, '1');
  assert.equal(ranked.find(project => project.id === '1').matched, false);
});

test('a show-me-everything student matches every open vertical', () => {
  const ranked = rankOpportunities([{ id: '1', verticals: ['Healthcare operations'], work_types: [] }], { verticals: ['Not sure yet — show me everything'], work_types: [] });
  assert.equal(ranked[0].matched, true);
});

test('project intake stores whitelisted targeting fields, secure attachments, and the AI brief', async () => {
  let inserted;
  const supabase = { from(table) { if (table === 'member_profiles') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role: 'company' }, error: null }; } }; return { insert(value) { inserted = value; return this; }, select() { return this; }, async single() { return { data: { id: 'p', ...inserted }, error: null }; } }; } };
  const project = await createMemberProject({ user: { id: 'c1' }, supabase }, {
    title: 'Pricing scan', summary: 'A public-source competitor pricing scan.', visibility: 'members',
    verticals: ['Software & AI', 'Bogus'], workTypes: ['Research', 'Bad'],
    attachments: [
      { name: 'brief.pdf', blobUrl: 'https://blob.example/x.pdf', contentType: 'application/pdf', sizeBytes: 1000 },
      { name: 'insecure', blobUrl: 'http://insecure/x', contentType: 'text/plain', sizeBytes: 1 },
    ],
    aiBrief: { summary: 's', structuredProblem: 'p', candidateDeliverables: ['d'], suggestedVerticals: ['Software & AI'], suggestedWorkTypes: ['Research'], safetyFlags: [], safeToPost: true },
    problemText: 'raw problem text', consultBooked: true,
  });
  assert.deepEqual(project.verticals, ['Software & AI']);
  assert.deepEqual(project.work_types, ['Research']);
  assert.equal(project.attachments.length, 1); // the insecure http attachment is dropped
  assert.equal(project.attachments[0].blobUrl, 'https://blob.example/x.pdf');
  assert.equal(project.ai_brief.safeToPost, true);
  assert.equal(project.consult_booked, true);
  assert.equal(project.problem_text, 'raw problem text');
});

test('only organization roles can create projects', async () => {
  let inserted;
  const supabase={from(table){if(table==='member_profiles')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{role:'company'},error:null};}};return {insert(value){inserted=value;return this;},select(){return this;},async single(){return {data:{id:'project-1',...inserted},error:null};}};}};
  const project=await createMemberProject({user:{id:'company-1'},supabase},{title:'Research synthesis',summary:'Synthesize twenty customer interviews.',visibility:'members',desiredSkills:'Research, Writing'});
  assert.equal(project.status,'open');
  assert.equal(project.owner_user_id,'company-1');
  assert.deepEqual(project.desired_skills,['Research','Writing']);
});

test('project messages require project membership and store only bounded text', async () => {
  let inserted;
  const supabase={from(table){if(table==='member_projects')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:'f65be0ad-7607-4c38-a1e1-095c34ad4f11',owner_user_id:'company-1',assigned_student_user_id:'student-1'},error:null};}};assert.equal(table,'project_messages');return {insert(value){inserted=value;return this;},select(){return this;},async single(){return {data:{id:'message-1',created_at:'2026-07-22T00:00:00Z',...inserted},error:null};}};}};
  const message=await sendProjectMessage({user:{id:'student-1'},supabase},{projectId:'f65be0ad-7607-4c38-a1e1-095c34ad4f11',message:'  The first milestone is ready.  '});
  assert.equal(message.body,'The first milestone is ready.');
  assert.equal(message.author_user_id,'student-1');
});

test('accepting an application assigns the student, moves the project in progress, and declines siblings', async () => {
  let acceptPayload, assignPayload, declinePayload;
  const supabase = queuedSupabase([
    { result: { id: APPLICATION_UUID, project_id: PROJECT_UUID, student_user_id: 'student-9', status: 'submitted' } },
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'open' } },
    { result: { id: APPLICATION_UUID, status: 'accepted' }, capture: value => { acceptPayload = value; } },
    { result: { id: PROJECT_UUID }, capture: value => { assignPayload = value; } },
    { result: [], capture: value => { declinePayload = value; } },
  ]);
  const accepted = await acceptApplication({ user: { id: 'owner-1' }, supabase }, { applicationId: APPLICATION_UUID });
  assert.equal(accepted.status, 'accepted');
  assert.equal(acceptPayload.status, 'accepted');
  assert.equal(assignPayload.assigned_student_user_id, 'student-9');
  assert.equal(assignPayload.status, 'in_progress');
  assert.equal(declinePayload.status, 'declined');
});

test('only the project owner can accept an applicant', async () => {
  const supabase = queuedSupabase([
    { result: { id: APPLICATION_UUID, project_id: PROJECT_UUID, student_user_id: 'student-9', status: 'submitted' } },
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'open' } },
  ]);
  await assert.rejects(
    acceptApplication({ user: { id: 'intruder' }, supabase }, { applicationId: APPLICATION_UUID }),
    /Only the project owner/,
  );
});

test('the assigned student submits a deliverable, folding links in and moving to review', async () => {
  let updatePayload;
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, assigned_student_user_id: 'student-9', status: 'in_progress' } },
    { result: { id: PROJECT_UUID, status: 'review' }, capture: value => { updatePayload = value; } },
  ]);
  await submitDeliverable({ user: { id: 'student-9' }, supabase }, {
    projectId: PROJECT_UUID,
    deliverable: 'Reconciled the month-end close and documented every exception.',
    deliverableLinks: ['https://docs.example.com/close', 'not-a-link', 'https://sheets.example.com/recon'],
  });
  assert.equal(updatePayload.status, 'review');
  assert.match(updatePayload.deliverable, /Links:\n- https:\/\/docs\.example\.com\/close\n- https:\/\/sheets\.example\.com\/recon/);
  assert.equal(updatePayload.review_note, null);
  assert.ok(updatePayload.deliverable_submitted_at);
});

test('a non-assigned user cannot submit a deliverable', async () => {
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, assigned_student_user_id: 'student-9', status: 'in_progress' } },
  ]);
  await assert.rejects(
    submitDeliverable({ user: { id: 'someone-else' }, supabase }, { projectId: PROJECT_UUID, deliverable: 'I would like to submit this work.' }),
    /Only the assigned student/,
  );
});

test('accepting a deliverable settles through the atomic database function, never a direct status write', async () => {
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'review' } },
    { result: { id: PROJECT_UUID, status: 'complete', credits_held: 0 } },
  ]);
  const project = await reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept' });
  assert.equal(project.status, 'complete');
  assert.equal(project.credits_held, 0);
  // the payout and the completion happen inside one transaction, not as separate writes
  assert.deepEqual(supabase.rpcCalls, [{ name: 'release_project_escrow', args: { p_project_id: PROJECT_UUID, p_owner_id: 'owner-1' } }]);
});

test('a failed settlement leaves the project incomplete rather than completing it unpaid', async () => {
  const supabase = {
    rpcCalls: [],
    from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'review' }, error: null }; } }; },
    rpc() { return Promise.resolve({ data: null, error: new Error('duplicate key value violates unique constraint "credit_ledger_one_release_per_project"') }); },
  };
  await assert.rejects(
    reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept' }),
    /credit_ledger_one_release_per_project/,
  );
});

test('cancelling before completion refunds through the database function', async () => {
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'in_progress' } },
    { result: { id: PROJECT_UUID, status: 'archived', credits_held: 0, platform_fee_credits: 0 } },
  ]);
  const project = await cancelProject({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID });
  assert.equal(project.status, 'archived');
  assert.equal(project.credits_held, 0);
  assert.deepEqual(supabase.rpcCalls, [{ name: 'refund_project_escrow', args: { p_project_id: PROJECT_UUID, p_owner_id: 'owner-1' } }]);
});

test('only the owner can cancel, and a finished project cannot be cancelled', async () => {
  const live = () => queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'in_progress' } }]);
  await assert.rejects(cancelProject({ user: { id: 'intruder' }, supabase: live() }, { projectId: PROJECT_UUID }), /Only the project owner can cancel/);
  const done = queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'complete' } }]);
  await assert.rejects(cancelProject({ user: { id: 'owner-1' }, supabase: done }, { projectId: PROJECT_UUID }), /already finished/);
});

test('requesting changes sends the project back to in_progress with a required note', async () => {
  let patch;
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'review' } },
    { result: { id: PROJECT_UUID, status: 'in_progress' }, capture: value => { patch = value; } },
  ]);
  await reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'revise', note: 'Please add the source citations.' });
  assert.equal(patch.status, 'in_progress');
  assert.equal(patch.review_note, 'Please add the source citations.');
  await assert.rejects(
    reviewDeliverable({ user: { id: 'owner-1' }, supabase: queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'review' } }]) }, { projectId: PROJECT_UUID, decision: 'revise' }),
    /Add a note/,
  );
});

test('a deliverable can only be reviewed while the project is in review', async () => {
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'in_progress' } },
  ]);
  await assert.rejects(
    reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept' }),
    /no submitted deliverable/,
  );
});
