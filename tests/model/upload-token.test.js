import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler, { MAX_BYTES, TTL_SECONDS, uploadLimit } from '../../api/upload-token.js';

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
test('the grant is narrow — one path, upload only, and the client never picks the path', () => {
  const src = readFileSync(new URL('../../api/upload-token.js', import.meta.url), 'utf8');
  assert.match(src, /signedUploadUrl\(pathname, \{ env \}\)/, 'scoped to the one path this handler derived');
  assert.doesNotMatch(src, /issueSignedToken|presignUrl/, 'no vendor token API remains');
  assert.ok(TTL_SECONDS <= 900, 'a long-lived write URL is a write URL somebody else can use');
  // Derived from the caller's own id, so a URL cannot be aimed at another member's key.
  assert.match(src, /\$\{member\.user\.id\}/);
  assert.doesNotMatch(src, /body\.pathname/, 'the client must never choose the path');
});

test('the ceiling fits a long screen share, which is why this route exists', () => {
  assert.ok(MAX_BYTES > 100 * 1024 * 1024, 'the 30 MB function limit is what broke uploads');
});

test('a deployment can lower the limit to match its Supabase plan', () => {
  assert.equal(uploadLimit({ COVENDA_UPLOAD_MAX_BYTES: String(50 * 1024 * 1024) }), 50 * 1024 * 1024);
  assert.equal(uploadLimit({ COVENDA_UPLOAD_MAX_BYTES: String(999 * 1024 * 1024) }), MAX_BYTES);
});

// Two guarantees genuinely weakened by moving off the previous provider, recorded here rather
// than quietly dropped.
//
// The old signed token carried maximumSizeInBytes and allowedContentTypes, so the STORAGE
// SERVICE refused an oversized or wrong-typed upload even if the client ignored every limit we
// stated. A Supabase signed upload URL carries neither. Both limits still exist in this
// handler, but they are now enforced by us before minting the URL, not by storage after.
//
// The practical exposure: a caller who obtains a URL legitimately could PUT something larger
// than MAX_BYTES to their own path. They cannot aim it at another member, and they cannot read
// or delete. Bounded, real, and worth a bucket-level file-size limit in Supabase.
test('the size and type limits still exist, and are ours to enforce now', () => {
  const src = readFileSync(new URL('../../api/upload-token.js', import.meta.url), 'utf8');
  assert.match(src, /MAX_BYTES/, 'a ceiling is still stated to the client');
  assert.match(src, /KINDS\[kind\]/, 'and content type is still validated before signing');
  assert.match(src, /no longer enforced at the storage boundary/,
    'the downgrade is written down next to the code, not only in a commit message');
});
