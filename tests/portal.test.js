import test from 'node:test';
import assert from 'node:assert/strict';

import { acceptApplication, authorizeMember, createMemberProject, loadMemberIntakes, memberAuthReadiness, requestGoogleLogin, requestMemberLink, reviewDeliverable, saveMemberProfile, sendProjectMessage, submitDeliverable } from '../api/portal.js';

// A queued Supabase double: each from() call consumes the next step in order. A step
// resolves maybeSingle()/single()/await to its `result` and can `capture` an update/
// insert payload — enough to assert the close-the-loop state transitions.
function queuedSupabase(steps) {
  let index = 0;
  return {
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

test('the owner accepts a deliverable, completing the project with a timestamp', async () => {
  let patch;
  const supabase = queuedSupabase([
    { result: { id: PROJECT_UUID, owner_user_id: 'owner-1', status: 'review' } },
    { result: { id: PROJECT_UUID, status: 'complete' }, capture: value => { patch = value; } },
  ]);
  await reviewDeliverable({ user: { id: 'owner-1' }, supabase }, { projectId: PROJECT_UUID, decision: 'accept' });
  assert.equal(patch.status, 'complete');
  assert.ok(patch.completed_at);
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
