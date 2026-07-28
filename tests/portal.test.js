import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { acceptApplication, applyToProject, authorizeMember, buyCredits, cancelProject, cleanWorkStyle, computeFitScore, createMemberProject, createProjectRequest, creditBalance, declineApplication, deleteApplication, deleteProject, fulfilPayout, loadMemberIntakes, loadNewMessages, looksLikeAccountNumber, memberAuthReadiness, projectCreditCost, rankOpportunities, recordConversion, requestGoogleLogin, requestMemberLink, requestPayout, respondToPacket, reviewDeliverable, saveMemberProfile, SCORER_VERSION, sendProjectMessage, submitDeliverable, verifiedPartnersFromEnv } from '../api/portal.js';

test('accepting a packet funds it — escrow held, status opens', async () => {
  const cap = {};
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'proposed', credits_listed: 400 } },
    { result: [{ credits: 1000 }] }, // balance covers 440
    { result: { id: PROJECT_UUID, status: 'open' }, capture: v => { cap.update = v; } },
    { result: [{ id: 'l1' }], capture: v => { cap.ledger = v; } },
  ]);
  await respondToPacket({ user: { id: 'co-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept' });
  assert.equal(cap.update.status, 'open');
  assert.equal(cap.update.credits_held, 400);
  assert.equal(cap.ledger[0].entry_type, 'escrow_hold');
  assert.equal(cap.ledger[0].credits, -440); // 400 listed + 40 (10%) platform fee
});

test('declining a packet closes it without charging', async () => {
  const cap = {};
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'proposed', credits_listed: 400 } },
    { result: { id: PROJECT_UUID, status: 'proposal_declined' }, capture: v => { cap.update = v; } },
  ]);
  await respondToPacket({ user: { id: 'co-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'decline' });
  assert.equal(cap.update.status, 'proposal_declined');
});

test('accepting a packet is blocked when the balance is short', async () => {
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'proposed', credits_listed: 400 } },
    { result: [{ credits: 100 }] }, // 100 < 440
  ]);
  await assert.rejects(
    respondToPacket({ user: { id: 'co-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept' }),
    /needs 440 credits/,
  );
});

test('a packet can only be answered by its owner', async () => {
  const supabase = queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'proposed', credits_listed: 400 } }]);
  await assert.rejects(
    respondToPacket({ user: { id: 'someone-else' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept' }),
    /not available to your account/,
  );
});

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
      for (const method of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'delete']) query[method] = same;
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
  await assert.rejects(buyCredits(member, { credits: 7 }, { COVENDA_CREDIT_GRANTS_ENABLED: 'true' }), /Choose between 50 and/);
  const result = await buyCredits(member, { credits: 100 }, { COVENDA_CREDIT_GRANTS_ENABLED: 'true' });
  assert.equal(result.balance, 100);
  // an operator on the allowlist can grant without the flag
  await buyCredits(member, { credits: 500 }, { COVENDA_ADMIN_EMAILS: 'ops@acme.com' });
});

test('a payout request is bounded by the balance and never stores an account number', async () => {
  const ledger = credits => ({ select() { return this; }, eq() { return Promise.resolve({ data: [{ credits }], error: null }); } });
  // identity defaults to a verified adult so the eligibility gate lets these cases through.
  const db = (balance, existingOpen = null, identity = { identity_verified: true, identity_18plus: true }) => ({
    from(table) {
      if (table === 'credit_ledger') return ledger(balance);
      if (table === 'member_profiles') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: identity, error: null }; } };
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: existingOpen, error: null }; },
        insert() { return this; },
        async single() { return { data: { id: 'req-1' }, error: null }; },
      };
    },
  });
  // an unverified student is stopped before anything else
  await assert.rejects(
    requestPayout({ user: { id: 'stu' }, supabase: db(500, null, { identity_verified: false, identity_18plus: false }) }, { credits: 100, method: 'PayPal', handle: 'a@b.com' }),
    /verify your identity/,
  );
  // a verified minor cannot be paid
  await assert.rejects(
    requestPayout({ user: { id: 'stu' }, supabase: db(500, null, { identity_verified: true, identity_18plus: false }) }, { credits: 100, method: 'PayPal', handle: 'a@b.com' }),
    /18 or older/,
  );
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

// Settling now reads the request first and refuses one that is already resolved, so the
// fixture has to offer a live request rather than a settled one.
test('only a listed operator can settle a payout', async () => {
  const supabase = queuedSupabase([
    { result: { id: 'req-1', status: 'requested', credits: 100, user_id: 'stu' } },
    { result: { id: 'req-1', status: 'paid' } },
  ]);
  await assert.rejects(
    fulfilPayout({ user: { id: 'stu', email: 'student@example.com' }, supabase }, { requestId: PROJECT_UUID }, { COVENDA_ADMIN_EMAILS: 'ops@covenda.app' }),
    /Only a Covenda operator/,
  );
  const settled = await fulfilPayout({ user: { id: 'op', email: 'ops@covenda.app' }, supabase }, { requestId: PROJECT_UUID }, { COVENDA_ADMIN_EMAILS: 'ops@covenda.app' });
  assert.equal(settled.status, 'paid');
  assert.equal(supabase.rpcCalls[0].name, 'fulfil_payout_request');
});

test('a completed project records a whitelisted conversion outcome, owner only', async () => {
  let patch;
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'complete' } },
    { result: { id: PROJECT_UUID, conversion_outcome: 'full_time' }, capture: value => { patch = value; } },
  ]);
  const project = await recordConversion({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, outcome: 'full_time', note: 'Hired onto the ops team.' });
  assert.equal(project.conversion_outcome, 'full_time');
  assert.equal(patch.conversion_outcome, 'full_time');
  assert.equal(patch.conversion_note, 'Hired onto the ops team.');
  assert.ok(patch.conversion_recorded_at);
});

test('conversion recording rejects unknown outcomes, non-owners, and unfinished projects', async () => {
  await assert.rejects(
    recordConversion({ user: { id: 'owner-1' }, supabase: queuedSupabase([]) }, { projectId: PROJECT_UUID, outcome: 'promoted' }),
    /Choose what the project led to/,
  );
  await assert.rejects(
    recordConversion({ user: { id: 'intruder' }, supabase: queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'complete' } }]) }, { projectId: PROJECT_UUID, outcome: 'interview' }),
    /Only the project owner/,
  );
  await assert.rejects(
    recordConversion({ user: { id: 'owner-1' }, supabase: queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'in_progress' } }]) }, { projectId: PROJECT_UUID, outcome: 'interview' }),
    /once the work is accepted/,
  );
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

test('fit score reflects vertical, work-type, skill and pay overlap, with explainable reasons', () => {
  const profile = { verticals: ['Software & AI'], work_types: ['Research'], skills: ['Python', 'SQL'] };
  const strong = computeFitScore({ verticals: ['Software & AI'], work_types: ['Research'], desired_skills: 'Python, R', credits_listed: 200, target_date: '2035-01-01' }, profile);
  const weak = computeFitScore({ verticals: ['Healthcare operations'], work_types: ['Operations'], desired_skills: 'Excel' }, profile);
  assert.ok(strong.score > weak.score);
  assert.ok(strong.score >= 65); // vertical + work type + partial skills
  assert.ok(strong.reasons.some(r => /skill/i.test(r)));
  assert.equal(weak.score, 0); // no overlap on any legitimate signal
});

test('fit score is explainable: reasons, >=1 concern, a recommended approach, and a version', () => {
  const out = computeFitScore({ verticals: ['Software & AI'], desired_skills: 'Rust' }, { verticals: ['Software & AI'], skills: ['Python'] });
  assert.ok(Array.isArray(out.reasons) && out.reasons.length);
  assert.ok(Array.isArray(out.concerns) && out.concerns.length >= 1); // never black-box: always a concern
  assert.ok(out.concerns.some(c => /Rust/i.test(c))); // names the un-evidenced desired skill
  assert.ok(typeof out.recommendedApproach === 'string' && out.recommendedApproach.length);
  assert.equal(out.scorerVersion, SCORER_VERSION);
});

test('startup-fit rewards work-style overlap and missing data never lowers the score', () => {
  const project = { env_structure: 'ambiguous', env_autonomy: 'independent' };
  const noPrefs = computeFitScore(project, { skills: [] });
  const aligned = computeFitScore(project, { skills: [], work_style: { structure: 'ambiguous', autonomy: 'independent' } });
  const mismatched = computeFitScore(project, { skills: [], work_style: { structure: 'structured', autonomy: 'guided' } });
  assert.ok(aligned.score > noPrefs.score); // alignment earns points
  assert.equal(mismatched.score, noPrefs.score); // a mismatch never dips below the no-data baseline
  assert.ok(aligned.reasons.some(r => /ambiguous|independent/i.test(r)));
  assert.ok(mismatched.concerns.some(c => /Prefers/i.test(c)));
});

test('execution has a cold-start guard: under 2 completed projects contributes nothing, honestly', () => {
  const project = { verticals: ['Software & AI'] };
  const profile = { verticals: ['Software & AI'] };
  const cold = computeFitScore(project, profile, { completedCount: 1 });
  const proven = computeFitScore(project, profile, { completedCount: 3, positiveOutcomes: 1 });
  assert.ok(proven.score > cold.score);
  assert.ok(cold.reasons.some(r => /unproven/i.test(r)));
  assert.ok(proven.reasons.some(r => /Proven execution/i.test(r)));
});

test('ADVERSARIAL: for an ambiguous startup, the env-fit student beats the higher-skill student', () => {
  const project = { env_structure: 'ambiguous', verticals: ['Software & AI'], work_types: ['Data & spreadsheets'], desired_skills: 'python' };
  const base = { verticals: ['Software & AI'], work_types: ['Data & spreadsheets'] };
  const higherSkill = computeFitScore(project, { ...base, skills: ['python'], work_style: { structure: 'structured' } });
  const higherAmbiguityTolerance = computeFitScore(project, { ...base, skills: [], work_style: { structure: 'ambiguous' } });
  assert.ok(higherAmbiguityTolerance.score > higherSkill.score); // environment fit can outrank raw skill
});

test('FAIRNESS: score is invariant to protected proxies (school prestige, gender-coded name)', () => {
  const project = { verticals: ['Software & AI'], work_types: ['Research'], desired_skills: 'Python' };
  const core = { verticals: ['Software & AI'], work_types: ['Research'], skills: ['Python'] };
  const a = computeFitScore(project, { ...core, display_name: 'Emily', school_name: 'Harvard University' });
  const b = computeFitScore(project, { ...core, display_name: 'Jamal', school_name: 'Community College' });
  assert.equal(a.score, b.score); // protected proxies MUST NOT move the score
});

test('cleanWorkStyle keeps only valid enum values and drops the rest', () => {
  assert.deepEqual(cleanWorkStyle({ structure: 'ambiguous', autonomy: 'nope', pace: 'fast', junk: 'x' }), { structure: 'ambiguous', pace: 'fast' });
  assert.equal(cleanWorkStyle({ structure: 'bad' }), null);
  assert.equal(cleanWorkStyle('not an object'), null);
});

test('applying stores skills, links, a referral and a snapshotted fit score, and logs a match event', async () => {
  const captured = { application: null, events: [] };
  const supabase = { from(table) {
    if (table === 'member_profiles') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role: 'student', verticals: ['Software & AI'], work_types: ['Research'], skills: ['Python'] }, error: null }; } };
    if (table === 'member_projects') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: PROJECT_UUID, status: 'open', visibility: 'members', verticals: ['Software & AI'], work_types: ['Research'], desired_skills: 'Python, R', credits_listed: 200 }, error: null }; } };
    if (table === 'project_applications') return { select() { return this; }, eq() { return this; }, insert(row) { captured.application = row; return this; }, async maybeSingle() { return { data: null, error: null }; }, async single() { return { data: { id: 'app-1', ...captured.application }, error: null }; } };
    if (table === 'match_events') return { insert(row) { captured.events.push(row); return Promise.resolve({ error: null }); } };
    throw new Error('unexpected table ' + table);
  } };
  await applyToProject({ user: { id: 'stu' }, supabase }, { projectId: PROJECT_UUID, note: 'keen', skills: ['Python', 'SQL'], demonstration: 'https://github.com/x', videoUrl: 'https://loom.com/y', referral: { name: 'Prof. Lee', code: 'REF-1' } });
  assert.deepEqual(captured.application.skills, ['Python', 'SQL']);
  assert.equal(captured.application.video_url, 'https://loom.com/y');
  assert.equal(captured.application.demonstration, 'https://github.com/x');
  assert.equal(captured.application.referral.name, 'Prof. Lee');
  assert.equal(captured.application.referral.verified, false); // never claims an unverified referral is certified
  // A floor, not a pinned value — the weights are rebalanced whenever a dimension is added,
  // and what this asserts is that a strong match still snapshots as a strong match.
  assert.ok(captured.application.fit_score >= 60, `fit was ${captured.application.fit_score}`);
  assert.equal(captured.events[0].event_type, 'applied');
  assert.equal(captured.events[0].student_user_id, 'stu');
});

test('a company can create a brokered request; a bogus type or a student is refused', async () => {
  const companySupabase = { from(table) {
    if (table === 'member_profiles') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role: 'company' }, error: null }; } };
    if (table === 'project_requests') return { insert(row) { this._row = row; return this; }, select() { return this; }, async single() { return { data: { id: 'r1', ...this._row }, error: null }; } };
    throw new Error('unexpected table ' + table);
  } };
  const r = await createProjectRequest({ user: { id: 'co' }, supabase: companySupabase }, { requestType: 'new_project', details: 'We need a pricing scan built from public pages.' });
  assert.equal(r.request_type, 'new_project');
  assert.equal(r.company_user_id, 'co');
  await assert.rejects(createProjectRequest({ user: { id: 'co' }, supabase: companySupabase }, { requestType: 'bogus', details: 'a long enough description here' }), /Choose what you are requesting/);
  const studentSupabase = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role: 'student' }, error: null }; } }; } };
  await assert.rejects(createProjectRequest({ user: { id: 'stu' }, supabase: studentSupabase }, { requestType: 'new_project', details: 'a long enough description here' }), /Only company and university/);
});

test('get-messages returns messages across the caller\'s owned and assigned projects since a timestamp', async () => {
  let sinceUsed = null;
  const supabase = { from(table) {
    if (table === 'member_projects') return { select() { return this; }, eq(col) { return Promise.resolve({ data: col === 'owner_user_id' ? [{ id: 'p1' }] : [{ id: 'p2' }], error: null }); } };
    if (table === 'project_messages') return { select() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; }, gt(_col, val) { sinceUsed = val; return Promise.resolve({ data: [{ id: 'm1', project_id: 'p1', body: 'hi', created_at: '2026-07-22T10:00:00Z' }], error: null }); } };
    throw new Error('unexpected table ' + table);
  } };
  const result = await loadNewMessages({ user: { id: 'u1' }, supabase }, { since: '2026-07-22T09:00:00Z' });
  assert.equal(sinceUsed, '2026-07-22T09:00:00Z');
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].id, 'm1');
});

test('verifiedPartnersFromEnv parses the founder allowlist and upper-cases codes', () => {
  const map = verifiedPartnersFromEnv({ COVENDA_VERIFIED_PARTNERS: 'REF-1042:Prof. Lee,core-01:CORE Club' });
  assert.equal(map.get('REF-1042'), 'Prof. Lee');
  assert.equal(map.get('CORE-01'), 'CORE Club');
  assert.equal(verifiedPartnersFromEnv({}).size, 0);
});

test('a referral code matching a founder-confirmed partner becomes Covenda-certified', async () => {
  const captured = { application: null };
  const supabase = { from(table) {
    if (table === 'member_profiles') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role: 'student', verticals: [], work_types: [], skills: [] }, error: null }; } };
    if (table === 'member_projects') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: PROJECT_UUID, status: 'open', visibility: 'members', verticals: [], work_types: [], desired_skills: '', credits_listed: 0 }, error: null }; } };
    if (table === 'project_applications') return { select() { return this; }, eq() { return this; }, insert(row) { captured.application = row; return this; }, async maybeSingle() { return { data: null, error: null }; }, async single() { return { data: { id: 'app', ...captured.application }, error: null }; } };
    if (table === 'match_events') return { insert() { return Promise.resolve({ error: null }); } };
    throw new Error('unexpected table ' + table);
  } };
  await applyToProject({ user: { id: 'stu' }, supabase }, { projectId: PROJECT_UUID, referral: { code: 'ref-1042' } }, { COVENDA_VERIFIED_PARTNERS: 'REF-1042:Prof. Lee @ Columbia' });
  assert.equal(captured.application.referral.verified, true);
  assert.equal(captured.application.referral.partner, 'Prof. Lee @ Columbia');
});

test('only the project owner can decline an applicant', async () => {
  const supabase = { from(table) {
    if (table === 'project_applications') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: 'app-1', project_id: PROJECT_UUID, student_user_id: 'stu', status: 'submitted', fit_score: 80, fit_reasons: [] }, error: null }; } };
    if (table === 'member_projects') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: PROJECT_UUID, owner_user_id: 'other-owner' }, error: null }; } };
    throw new Error('unexpected table ' + table);
  } };
  await assert.rejects(declineApplication({ user: { id: 'not-owner' }, supabase }, { applicationId: PROJECT_UUID }), /Only the project owner/);
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

test('createMemberProject persists talent-acquisition prefs and ignores protected proxies', async () => {
  let inserted;
  const supabase={from(table){if(table==='member_profiles')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{role:'company'},error:null};}};return {insert(value){inserted=value;return this;},select(){return this;},async single(){return {data:{id:'project-1',...inserted},error:null};}};}};
  const project=await createMemberProject({user:{id:'company-1'},supabase},{
    title:'Robotics research assist',summary:'Help wire up a ROS perception pipeline.',visibility:'members',
    opportunityType:'internship',experienceRequirement:'relevant_project',referralRequirement:'preferred',
    founderTimeBudgetMinWeek:45,complexityRating:4,ambiguityRating:3,
    talentSources:['university','research_lab'],availabilityHoursMin:10,
    // Protected proxies — must be silently dropped, never persisted.
    degree:'BS',major:'Robotics',location:'Boston',age:21,
  });
  assert.equal(project.opportunity_type,'internship');
  assert.equal(project.experience_requirement,'relevant_project');
  assert.equal(project.referral_requirement,'preferred');
  assert.equal(project.founder_time_budget_min_week,45);
  assert.equal(project.complexity_rating,4);
  assert.deepEqual(project.talent_source_prefs.sources.sort(),['research_lab','university']);
  assert.equal(project.talent_source_prefs.availabilityHoursMin,10);
  // No protected attribute leaked into the stored row.
  for(const k of Object.keys(project)) assert.ok(!/degree|major|location|age/i.test(k),`leaked ${k}`);
});

test('computeFitScore surfaces requirement signals honestly (evidence-based, no proxies)', async () => {
  const proj={verticals:['Software & AI'],desired_skills:'Python',experience_requirement:'relevant_project',referral_requirement:'required'};
  const proven=computeFitScore(proj,{verticals:['Software & AI'],skills:['Python']},{completedCount:2});
  const green=computeFitScore(proj,{verticals:['Software & AI'],skills:['Python']},{completedCount:0});
  assert.ok(proven.reasons.some(r=>/prior-experience bar/.test(r)));
  assert.ok(green.concerns.some(c=>/prior experience/.test(c)));
  assert.ok(green.concerns.some(c=>/staked referral is required/.test(c)));
});

test('project messages require project membership and store only bounded text', async () => {
  let inserted;
  const supabase={from(table){if(table==='member_projects')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:'f65be0ad-7607-4c38-a1e1-095c34ad4f11',owner_user_id:'company-1',assigned_student_user_id:'student-1'},error:null};}};assert.equal(table,'project_messages');return {insert(value){inserted=value;return this;},select(){return this;},async single(){return {data:{id:'message-1',created_at:'2026-07-22T00:00:00Z',...inserted},error:null};}};}};
  const message=await sendProjectMessage({user:{id:'student-1'},supabase},{projectId:'f65be0ad-7607-4c38-a1e1-095c34ad4f11',message:'  The first milestone is ready.  '});
  assert.equal(message.body,'The first milestone is ready.');
  assert.equal(message.author_user_id,'student-1');
});

// Accepting APPROVES the student; it does not put them to work. The student's own
// confirmation starts the trial, so nobody is ever mid-project on something they never
// agreed to begin.
test('accepting an application approves the student without starting the work, and declines siblings', async () => {
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
  assert.equal(assignPayload.status, 'matched', 'approved and waiting, not started');
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
  const project = await reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept', wouldRequestAgain: true });
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
    reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept', wouldRequestAgain: true }),
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

test('accepting without the close-out answer is refused, because that answer is the label', async () => {
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'review' }, error: null }) }) }) }) };
  await assert.rejects(
    () => reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept' }),
    err => err.code === 'CLOSEOUT_RATING_REQUIRED',
  );
});

test('a deliverable can only be reviewed while the project is in review', async () => {
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'in_progress' } },
  ]);
  await assert.rejects(
    reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept', wouldRequestAgain: true }),
    /no submitted deliverable/,
  );
});

test('a student can withdraw their own pending application, but not another student\'s or an accepted one', async () => {
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, student_user_id: 'stu-1', status: 'submitted' } },
    { result: null },
  ]);
  const out = await deleteApplication({ user: { id: 'stu-1' }, supabase }, { applicationId: PROJECT_UUID });
  assert.equal(out.withdrawn, true);
  await assert.rejects(
    deleteApplication({ user: { id: 'intruder' }, supabase: queuedSupabase([{ result: { id: PROJECT_UUID, student_user_id: 'stu-1', status: 'submitted' } }]) }, { applicationId: PROJECT_UUID }),
    /Only the applicant/,
  );
  await assert.rejects(
    deleteApplication({ user: { id: 'stu-1' }, supabase: queuedSupabase([{ result: { id: PROJECT_UUID, student_user_id: 'stu-1', status: 'accepted' } }]) }, { applicationId: PROJECT_UUID }),
    /was accepted/,
  );
});

test('a company can delete only a draft with no held escrow and no applicants', async () => {
  const ok = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'draft', credits_held: 0, platform_fee_credits: 0 } },
    { result: [] },
    { result: null },
  ]);
  const out = await deleteProject({ user: { id: 'co-1' }, supabase: ok }, { projectId: PROJECT_UUID });
  assert.equal(out.deleted, true);
  await assert.rejects(
    deleteProject({ user: { id: 'intruder' }, supabase: queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'draft' } }]) }, { projectId: PROJECT_UUID }),
    /Only the project owner/,
  );
  await assert.rejects(
    deleteProject({ user: { id: 'co-1' }, supabase: queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'open', credits_held: 100, platform_fee_credits: 10 } }]) }, { projectId: PROJECT_UUID }),
    /Only a draft can be deleted/,
  );
  await assert.rejects(
    deleteProject({ user: { id: 'co-1' }, supabase: queuedSupabase([{ result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'draft', credits_held: 50, platform_fee_credits: 5 } }]) }, { projectId: PROJECT_UUID }),
    /holding credits/,
  );
  await assert.rejects(
    deleteProject({ user: { id: 'co-1' }, supabase: queuedSupabase([
      { result: { id: PROJECT_UUID, owner_user_id: 'co-1', status: 'draft', credits_held: 0, platform_fee_credits: 0 } },
      { result: [{ id: 'app-1' }] },
    ]) }, { projectId: PROJECT_UUID }),
    /already has applicants/,
  );
});

test('computeReadinessScore is explainable, versioned, and never a gate', async () => {
  const { computeReadinessScore, READINESS_VERSION } = await import('../api/portal.js');
  const strong = computeReadinessScore({
    goal: 'Build a public-source competitor pricing scan across our top eight rivals with tiers.',
    blocked: 'Sales keeps asking for an up-to-date sheet and nobody owns it.',
    skills: ['Research', 'Spreadsheets'], supervisionHoursWeekly: 1, projectWeeks: 4, budget: 500, hireIntent: 'yes',
  });
  for (const key of ['projectClarity', 'talentAccessibility', 'suitabilityForEmergingTalent']) {
    const s = strong[key];
    assert.ok(s.score >= 0 && s.score <= 100);
    assert.ok(Array.isArray(s.reasons) && Array.isArray(s.concerns) && s.concerns.length >= 1);
  }
  assert.match(strong.recommendedTalentProfile, /Research student/);
  assert.equal(strong.nextStep, 'Submit your project to Covenda');
  assert.equal(strong.readinessVersion, READINESS_VERSION);
  // Weak intake: low scores arrive with how-to-fix concerns, and the door stays open.
  const weak = computeReadinessScore({});
  assert.ok(weak.projectClarity.score < strong.projectClarity.score);
  assert.ok(weak.projectClarity.concerns.some(c => /goal/i.test(c)));
  assert.equal(weak.nextStep, 'Submit your project to Covenda');
});

// Money moves before the ledger says it did. The other order can mark a student paid and
// then fail the transfer, which is the one mistake that is expensive to unwind.
test('a payout will not settle for a student who has not finished Stripe onboarding', async () => {
  const supabase = queuedSupabase([
    { result: { id: 'req-1', status: 'requested', credits: 100, user_id: 'stu' } },
    { result: { stripe_account_id: null, stripe_payouts_enabled: false } },
  ]);
  await assert.rejects(
    fulfilPayout(
      { user: { id: 'op', email: 'ops@covenda.app' }, supabase },
      { requestId: PROJECT_UUID },
      { COVENDA_ADMIN_EMAILS: 'ops@covenda.app', STRIPE_SECRET_KEY: 'sk_test', STRIPE_CONNECT_ENABLED: 'true' },
    ),
    /has not finished setting up payouts/,
  );
  assert.equal(supabase.rpcCalls.length, 0, 'the ledger is untouched when the transfer cannot happen');
});

test('an already-settled request cannot be settled twice', async () => {
  const supabase = queuedSupabase([{ result: { id: 'req-1', status: 'paid', credits: 100, user_id: 'stu' } }]);
  await assert.rejects(
    fulfilPayout({ user: { id: 'op', email: 'ops@covenda.app' }, supabase }, { requestId: PROJECT_UUID }, { COVENDA_ADMIN_EMAILS: 'ops@covenda.app' }),
    /already been resolved/,
  );
});

// A missing optional table must not take the whole portal down. The dashboard reads several
// tables added after the last schema anyone actually ran; checked() throws on a query error,
// which 503s everything — including features with no relationship to the missing table.
test('an optional read degrades to empty instead of failing the dashboard', async () => {
  const src = await readFile(new URL('../api/portal.js', import.meta.url), 'utf8');
  assert.match(src, /async function optional\(/);
  // The newest tables all go through it.
  for (const table of ['introductions', 'company_referrals', 'member_videos', 'company_profiles']) {
    const call = new RegExp(`optional\\([\\s\\S]{0,140}from\\('${table}'`);
    assert.match(src, call, `${table} should be read optionally`);
  }
  // The core tables still throw — if member_projects is missing, nothing works and hiding
  // that would be worse than a 503.
  assert.match(src, /checked\(\s*\n?\s*supabase\.from\('member_projects'/);
});

// Attaching the per-vertical process to a brief must not clobber `vetting`, which already
// exists and holds the rails. The first version overwrote it and broke sign-in for everyone
// with "brief.vetting.rails is not iterable".
test('the vetting process is added alongside the rails, never over them', async () => {
  const { BATCH_CATALOG, batchBrief } = await import('../api/batches.js');
  const { summarise, processFor } = await import('../api/vetting.js');
  const src = await readFile(new URL('../api/portal.js', import.meta.url), 'utf8');

  assert.doesNotMatch(src, /vetting: summariseVetting/, 'must not overwrite brief.vetting');
  assert.match(src, /vettingProcess: summariseVetting/);

  for (const b of BATCH_CATALOG) {
    const brief = { ...batchBrief(b), vettingProcess: summarise(b.discipline) };
    assert.ok(Array.isArray(brief.vetting.rails), `${b.slug}: rails must stay iterable`);
    assert.equal(typeof brief.vetting.apiVerified, 'boolean', b.slug);
  }
});

// Step 1 asks for a model. It has to be possible to give us one, and a reviewer has to be
// able to open it — the same gap the intro video had before the recorder existed.
test('a batch application carries the uploaded work sample through to the reviewer', async () => {
  const html = await readFile(new URL('../portal.html', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../portal.js', import.meta.url), 'utf8');
  const api = await readFile(new URL('../api/portal.js', import.meta.url), 'utf8');

  assert.match(html, /id="batchArtifactInput"/, 'an upload control exists');
  assert.match(html, /accept="\.xlsx[^"]*"/, 'and accepts a spreadsheet');
  assert.match(ui, /workSampleFiles:batchArtifacts/, 'the client sends them');
  assert.match(api, /workSampleFiles: \(Array\.isArray/, 'the API stores them');
  // A PDF has no formula layer, and saying so at upload beats a reviewer finding out.
  assert.match(ui, /A PDF cannot be read for formulas/);
});
