import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../../api/resume-interview.js';
import { stripProxies } from '../../api/resume-questions.js';

function res() {
  const out = { code: 0, body: null, headers: {} };
  return {
    setHeader(k, v) { out.headers[k] = v; },
    status(c) { out.code = c; return this; },
    json(b) { out.body = b; return out; },
    out,
  };
}
function req({ headers = {}, ...over } = {}) {
  return {
    method: 'POST',
    body: Buffer.from('x'),
    ...over,
    headers: { 'content-type': 'application/pdf', authorization: 'Bearer t', ...headers },
  };
}
// authorizeMember resolves the caller through the Supabase client it is handed, so the stub
// goes in at that seam rather than replacing the function.
const authEnv = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' };
function deps(user = { id: 'stu', email: 'stu@example.edu' }) {
  return {
    env: authEnv,
    createSupabaseClient: () => ({ auth: { async getUser() { return { data: { user }, error: null }; } } }),
  };
}
const signedIn = deps();
const anonymous = { env: authEnv, createSupabaseClient: () => ({ auth: { async getUser() { return { data: null, error: new Error('bad token') }; } } }) };

test('an anonymous caller gets nothing', async () => {
  const r = res();
  await handler(req({ headers: { authorization: '' } }), r, anonymous);
  assert.equal(r.out.code, 401);
});

test('only résumé formats are accepted', async () => {
  const r = res();
  await handler(req({ headers: { 'content-type': 'image/png' } }), r, signedIn);
  assert.equal(r.out.code, 415);
  assert.match(r.out.body.error, /PDF, Word document, or plain text/);
});

// A failure here must never block the application — the published questions still apply.
test('an unreadable résumé degrades to a note rather than an error', async () => {
  const r = res();
  await handler(req({ body: Buffer.from('not really a pdf') }), r, signedIn);
  assert.equal(r.out.code, 200, 'still 200 so the form is not blocked');
  assert.equal(r.out.body.ok, false);
  assert.equal(r.out.body.fallback, true);
  assert.ok(r.out.body.reason, 'the student is told why');
});

test('an empty body is refused before anything is spent on it', async () => {
  const r = res();
  await handler(req({ body: Buffer.alloc(0) }), r, signedIn);
  assert.equal(r.out.code, 400);
});

// A model told not to probe prestige still occasionally does, and a résumé is dense with it.
test('prestige questions are dropped from the model output, not just forbidden in the prompt', () => {
  const { questions, dropped } = stripProxies([
    { question: 'You list a summer at a logistics firm. What did you own there?', followUp: 'What broke?' },
    { question: 'Was that a target school for banking?', followUp: '' },
    { question: 'Your GPA dipped in year two. Why?', followUp: '' },
  ]);
  assert.equal(questions.length, 1);
  assert.equal(dropped.length, 2);
  assert.match(questions[0].question, /logistics firm/);
});

test('the route stores nothing and returns questions, never a judgement', async () => {
  const src = readFileSync(new URL('../../api/resume-interview.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\bput\(|\.insert\(|\.upsert\(/, 'the résumé text is read and discarded');
  assert.match(src, /Cache-Control', 'no-store'/);

  const r = res();
  await handler(req({ body: Buffer.from('not really a pdf') }), r, signedIn);
  // These are questions for a human to ask. Nothing here decides anything.
  const keys = Object.keys(r.out.body);
  assert.ok(!keys.some(k => /score|rating|rank|verdict|decision/i.test(k)), keys.join(','));
});
