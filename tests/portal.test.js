import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeMember, createMemberProject, requestGoogleLogin, requestMemberLink, saveMemberProfile } from '../api/portal.js';

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

test('member authorization validates the bearer token with the server-side Supabase client', async () => {
  const result=await authorizeMember({headers:{authorization:'Bearer valid.jwt'}},{
    env:authEnv,
    createSupabaseClient(url,key){assert.equal(key,'secret');return {auth:{async getUser(token){assert.equal(token,'valid.jwt');return {data:{user:{id:'user-1',email:'MEMBER@example.com',user_metadata:{full_name:'Member'}}},error:null};}}};},
  });
  assert.equal(result.user.email,'member@example.com');
  assert.equal(result.user.metadata.full_name,'Member');
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
