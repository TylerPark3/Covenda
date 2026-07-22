import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeMember, createMemberProject, createProjectMilestone, loadMemberIntakes, memberAuthReadiness, requestGoogleLogin, requestMemberLink, reviewProjectApplication, saveMemberProfile, sendProjectMessage, updateProjectStatus } from '../api/portal.js';

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

test('only organization roles can create projects', async () => {
  let inserted;
  const supabase={from(table){if(table==='member_profiles')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{role:'company'},error:null};}};return {insert(value){inserted=value;return this;},select(){return this;},async single(){return {data:{id:'project-1',...inserted},error:null};}};}};
  const project=await createMemberProject({user:{id:'company-1'},supabase},{title:'Research synthesis',summary:'Synthesize twenty customer interviews.',visibility:'members',desiredSkills:'Research, Writing'});
  assert.equal(project.status,'open');
  assert.equal(project.owner_user_id,'company-1');
  assert.deepEqual(project.desired_skills,['Research','Writing']);
});

test('organization owners review applications through the atomic matching function', async () => {
  let rpcCall;
  const applicationId='aa013d65-b83a-48b7-a3f2-077dcfa502d8';
  const expected={id:applicationId,project_id:'project-1',student_user_id:'student-1',status:'accepted'};
  const supabase={
    from(table){assert.equal(table,'member_profiles');return {select(){return this;},eq(column,value){assert.equal(column,'user_id');assert.equal(value,'company-1');return this;},async maybeSingle(){return {data:{role:'company'},error:null};}};},
    async rpc(name,params){rpcCall={name,params};return {data:expected,error:null};},
  };
  const result=await reviewProjectApplication({user:{id:'company-1'},supabase},{applicationId,status:'accepted'});
  assert.deepEqual(rpcCall,{name:'review_project_application',params:{p_owner_user_id:'company-1',p_application_id:applicationId,p_status:'accepted'}});
  assert.deepEqual(result,expected);
});

test('students cannot review project applications', async () => {
  const applicationId='aa013d65-b83a-48b7-a3f2-077dcfa502d8';
  const supabase={from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{role:'student'},error:null};}};}};
  await assert.rejects(()=>reviewProjectApplication({user:{id:'student-1'},supabase},{applicationId,status:'shortlisted'}),/Only company and university accounts/);
});

test('matched participants can add bounded milestones to the shared workspace', async () => {
  let inserted;
  const projectId='f65be0ad-7607-4c38-a1e1-095c34ad4f11';
  const milestoneQuery={
    select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},
    async maybeSingle(){return {data:{position:2},error:null};},
    insert(value){inserted=value;return this;},async single(){return {data:{id:'milestone-1',status:'planned',...inserted},error:null};},
  };
  const supabase={from(table){if(table==='member_projects')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:projectId,status:'matched',owner_user_id:'company-1',assigned_student_user_id:'student-1'},error:null};}};assert.equal(table,'project_milestones');return milestoneQuery;}};
  const milestone=await createProjectMilestone({user:{id:'student-1'},supabase},{projectId,title:'  Draft the evidence summary  ',notes:'Include citations.',dueDate:'2026-08-12'});
  assert.equal(milestone.title,'Draft the evidence summary');
  assert.equal(milestone.position,3);
  assert.equal(milestone.created_by_user_id,'student-1');
});

test('project lifecycle allows a matched participant to request review with an optimistic status check', async () => {
  let updated;
  const projectId='f65be0ad-7607-4c38-a1e1-095c34ad4f11';
  const projectQuery={select(){return this;},eq(){return this;},update(value){updated=value;return this;},async maybeSingle(){return {data:updated?{id:projectId,owner_user_id:'company-1',assigned_student_user_id:'student-1',...updated}:{id:projectId,status:'in_progress',owner_user_id:'company-1',assigned_student_user_id:'student-1'},error:null};}};
  const supabase={from(table){assert.equal(table,'member_projects');return projectQuery;}};
  const project=await updateProjectStatus({user:{id:'student-1'},supabase},{projectId,status:'review'});
  assert.equal(project.status,'review');
  assert.match(updated.updated_at,/^\d{4}-\d{2}-\d{2}T/);
});

test('project messages require project membership and store only bounded text', async () => {
  let inserted;
  const supabase={from(table){if(table==='member_projects')return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:'f65be0ad-7607-4c38-a1e1-095c34ad4f11',owner_user_id:'company-1',assigned_student_user_id:'student-1'},error:null};}};assert.equal(table,'project_messages');return {insert(value){inserted=value;return this;},select(){return this;},async single(){return {data:{id:'message-1',created_at:'2026-07-22T00:00:00Z',...inserted},error:null};}};}};
  const message=await sendProjectMessage({user:{id:'student-1'},supabase},{projectId:'f65be0ad-7607-4c38-a1e1-095c34ad4f11',message:'  The first milestone is ready.  '});
  assert.equal(message.body,'The first milestone is ready.');
  assert.equal(message.author_user_id,'student-1');
});
