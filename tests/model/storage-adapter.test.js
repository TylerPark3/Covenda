import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { putObject, getObject, signedReadUrl, isAbsoluteUrl, isLegacyBlobUrl, BUCKET } from '../../api/storage.js';

// A fake Supabase storage client that records what it was asked to do.
function fakeDb(behaviour = {}) {
  const calls = [];
  return {
    calls,
    storage: {
      from(bucket) {
        return {
          upload: async (path, body, opts) => {
            calls.push({ op: 'upload', bucket, path, opts });
            return behaviour.uploadError ? { error: new Error(behaviour.uploadError) } : { error: null };
          },
          download: async path => {
            calls.push({ op: 'download', bucket, path });
            if (behaviour.downloadError) return { data: null, error: new Error(behaviour.downloadError) };
            return { data: { arrayBuffer: async () => new TextEncoder().encode('hello').buffer, type: 'text/plain' }, error: null };
          },
          createSignedUrl: async (path, ttl) => {
            calls.push({ op: 'sign', bucket, path, ttl });
            return { data: { signedUrl: `https://sb.example/${path}?token=x` }, error: null };
          },
        };
      },
    },
  };
}

// ── The seam ───────────────────────────────────────────────────────────────────────────
// Eight handlers imported @vercel/blob directly, so the storage vendor was a dependency of the
// API surface rather than of one module.
test('no handler imports a storage vendor directly', () => {
  const dir = new URL('../../api/', import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'storage.js')) {
    const src = readFileSync(new URL(f, dir), 'utf8').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(src, /from '@vercel\/blob'/, `api/${f} must go through api/storage.js`);
  }
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.ok(!pkg.dependencies['@vercel/blob'], 'the dependency is gone from package.json');
  assert.ok(!Object.keys(pkg.dependencies).some(d => d.startsWith('@vercel/')),
    'no @vercel/* package remains, so hosting is a deployment decision not a rewrite');
});

// ── Old files must keep working ────────────────────────────────────────────────────────
// Rows written before the swap hold absolute Vercel URLs. Those files still live there and
// must stay readable, or every deliverable and recording uploaded to date breaks.
test('a legacy absolute URL is still readable', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(url, 'https://abc.public.blob.vercel-storage.com/deliverables/x.pdf');
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode('old file').buffer, headers: { get: () => 'application/pdf' } };
  };
  try {
    const out = await getObject('https://abc.public.blob.vercel-storage.com/deliverables/x.pdf');
    assert.equal(out.body.toString(), 'old file');
    assert.equal(out.legacy, true, 'flagged as legacy so callers can tell');
  } finally { globalThis.fetch = original; }
});

test('a legacy URL is handed back unchanged rather than re-signed', async () => {
  const out = await signedReadUrl('https://abc.public.blob.vercel-storage.com/v/1.webm');
  assert.equal(out.url, 'https://abc.public.blob.vercel-storage.com/v/1.webm');
  assert.equal(out.legacy, true);
  // Signing it against Supabase would produce a URL for an object that is not there.
});

test('legacy URLs are recognised, keys are not mistaken for them', () => {
  assert.equal(isAbsoluteUrl('https://x.blob.vercel-storage.com/a'), true);
  assert.equal(isAbsoluteUrl('deliverables/user-1/file.pdf'), false);
  assert.equal(isLegacyBlobUrl('https://x.public.blob.vercel-storage.com/a'), true);
  assert.equal(isLegacyBlobUrl('https://covenda.app/a'), false);
});

// ── Writes ─────────────────────────────────────────────────────────────────────────────
test('a write returns the key, not an absolute URL', async () => {
  const db = fakeDb();
  const out = await putObject('deliverables/u1/report.pdf', Buffer.from('x'), { contentType: 'application/pdf', client: db });
  assert.equal(out.url, 'deliverables/u1/report.pdf');
  assert.equal(out.key, out.url, 'url and key are the same thing, since the bucket is private');
  assert.equal(db.calls[0].bucket, BUCKET);
  assert.equal(db.calls[0].opts.contentType, 'application/pdf');
  assert.equal(db.calls[0].opts.upsert, true, 'a retry after a dropped response must not 409');
});

// project-upload relied on addRandomSuffix: two students uploading "resume.pdf" must not
// collide, and upsert alone would silently overwrite the first.
test('addRandomSuffix still prevents collisions', async () => {
  const db = fakeDb();
  await putObject('intake/u1/resume.pdf', Buffer.from('x'), { addRandomSuffix: true, client: db });
  const path = db.calls[0].path;
  assert.notEqual(path, 'intake/u1/resume.pdf', 'a suffix was added');
  assert.match(path, /^intake\/u1\/resume-[0-9a-f]{8}\.pdf$/, 'and the extension survives it');

  const db2 = fakeDb();
  await putObject('intake/u1/resume.pdf', Buffer.from('y'), { addRandomSuffix: true, client: db2 });
  assert.notEqual(db2.calls[0].path, path, 'two uploads of the same name do not collide');
});

test('a leading slash never creates an empty first path segment', async () => {
  const db = fakeDb();
  await putObject('/deliverables/u1/a.pdf', Buffer.from('x'), { client: db });
  assert.equal(db.calls[0].path, 'deliverables/u1/a.pdf');
});

test('an empty key is refused rather than writing to the bucket root', async () => {
  await assert.rejects(() => putObject('', Buffer.from('x'), { client: fakeDb() }), /needs a key/);
});

// ── Reads ──────────────────────────────────────────────────────────────────────────────
test('a signed read URL is time-bounded, and the bound is clamped', async () => {
  const db = fakeDb();
  await signedReadUrl('v/1.webm', { ttl: 120, client: db });
  assert.equal(db.calls[0].ttl, 120);
  // A signed URL that outlives its session is a public URL with extra steps.
  await signedReadUrl('v/1.webm', { ttl: 999999, client: db });
  assert.equal(db.calls[1].ttl, 3600, 'clamped to an hour however large the caller asks');
  await signedReadUrl('v/1.webm', { ttl: 1, client: db });
  assert.equal(db.calls[2].ttl, 30, 'and floored, so a zero does not mint a dead URL');
});

test('a missing object is a named error, not an empty success', async () => {
  await assert.rejects(
    () => getObject('missing/x.pdf', { client: fakeDb({ downloadError: 'Object not found' }) }),
    /Could not read the stored file/);
  await assert.rejects(
    () => putObject('a/b.pdf', Buffer.from('x'), { client: fakeDb({ uploadError: 'quota exceeded' }) }),
    /Upload failed/);
});

// Without credentials the adapter must say so, rather than throwing a TypeError deep inside
// a handler where it reads as an application bug.
test('an unconfigured deployment fails with a sentence, not a stack', async () => {
  const bare = { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '' };
  await assert.rejects(() => putObject('a/b', Buffer.from('x'), { env: bare }), /Storage is not configured/);
  await assert.rejects(() => getObject('a/b', { env: bare }), /Storage is not configured/);
});

// ── The bucket exists in the schema, not in somebody's browser history ─────────────────
// The adapter shipped writing to a bucket that no migration created, so a first upload in a
// fresh environment failed with "Bucket not found" after the request had already been accepted.
test('a migration creates the bucket the adapter writes to, and keeps it private', () => {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const sql = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(new URL(f, dir), 'utf8'))
    .join('\n');
  assert.match(sql, /insert into storage\.buckets/, 'the bucket is created by a migration');
  assert.ok(sql.includes(`'${BUCKET}'`), `the migration names ${BUCKET}, the same bucket the adapter uses`);
  assert.doesNotMatch(sql, /storage\.buckets[\s\S]{0,200}public\)\s*\n?values[^;]*true/,
    'these are student résumés and recordings — the bucket is never created public');
});

// api/storage.js defaults to 'uploads' and render.yaml names it explicitly. If the two ever
// disagree, uploads land in a bucket the migration never made private.
test('the deployed bucket name matches the adapter default', () => {
  const render = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');
  const declared = render.match(/key: SUPABASE_STORAGE_BUCKET,?\s*(?:value:|\n\s*value:) (\w+)/);
  assert.ok(declared, 'render.yaml names the bucket rather than relying on a default argument');
  assert.equal(declared[1], BUCKET);
});
