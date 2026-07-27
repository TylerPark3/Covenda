import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler, { MAX_BYTES, TTL_SECONDS } from '../../api/upload-token.js';

function res() {
  const out = { code: 0, body: null };
  return { setHeader() {}, status(c) { out.code = c; return this; }, json(b) { out.body = b; return out; }, out };
}
const authEnv = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' };
const signedIn = {
  env: authEnv,
  createSupabaseClient: () => ({ auth: { async getUser() { return { data: { user: { id: 'stu-1' } }, error: null }; } } }),
};
function req(body = {}, headers = {}) {
  return { method: 'POST', headers: { authorization: 'Bearer t', ...headers }, body };
}

test('an anonymous caller gets no upload grant', async () => {
  const r = res();
  await handler(req({}, { authorization: '' }), r, {
    env: authEnv,
    createSupabaseClient: () => ({ auth: { async getUser() { return { data: null, error: new Error('no') }; } } }),
  });
  assert.equal(r.out.code, 401);
});

test('a cross-origin request is refused before auth is even checked', async () => {
  const r = res();
  await handler(req({}, { origin: 'https://evil.example.com', host: 'covenda.app' }), r, signedIn);
  assert.equal(r.out.code, 403);
});

test('only recording formats are accepted', async () => {
  const r = res();
  await handler(req({ contentType: 'application/zip' }), r, signedIn);
  assert.equal(r.out.code, 415);
});

// The URL is a bearer credential: whoever holds it can write.
test('the grant is narrow — one path, put only, short-lived, size-capped', () => {
  const src = readFileSync(new URL('../../api/upload-token.js', import.meta.url), 'utf8');
  assert.match(src, /operations: \['put'\]/, 'must not permit reads or deletes');
  assert.match(src, /maximumSizeInBytes: MAX_BYTES/, 'the storage layer enforces size, not us');
  assert.match(src, /allowedContentTypes: \[contentType\]/);
  assert.ok(TTL_SECONDS <= 900, 'a long-lived write URL is a write URL somebody else can use');
  // Derived from the caller's own id, so a token cannot be aimed at another member's key.
  assert.match(src, /\$\{member\.user\.id\}/);
  assert.doesNotMatch(src, /body\.pathname/, 'the client must never choose the path');
});

test('the ceiling fits a long screen share, which is why this route exists', () => {
  assert.ok(MAX_BYTES > 100 * 1024 * 1024, 'the 30 MB function limit is what broke uploads');
});
