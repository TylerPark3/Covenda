import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mayView, parseBlobUrl, materialUrls, TTL_SECONDS } from '../../api/media.js';

const PRIVATE = 'https://str1.private.blob.vercel-storage.com/video-intros/abc-take-1.webm';
const PUBLIC = 'https://str1.public.blob.vercel-storage.com/logos/x.png';

// A tiny stand-in for the Supabase builder. Each table returns whatever the fixture holds.
function db(tables = {}) {
  return {
    from(name) {
      const rows = tables[name] || [];
      const q = {
        select: () => q,
        eq: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }),
        maybeSingle: () => Promise.resolve({ data: rows[0] || null, error: null }),
      };
      return q;
    },
  };
}

test('the access level is read from the hostname, not guessed', () => {
  assert.deepEqual(parseBlobUrl(PRIVATE), { storeId: 'str1', access: 'private', pathname: 'video-intros/abc-take-1.webm' });
  assert.equal(parseBlobUrl(PUBLIC).access, 'public');
  assert.equal(parseBlobUrl('https://evil.example.com/x.webm'), null);
});

test('a non-Covenda URL is refused before any lookup happens', async () => {
  const r = await mayView(db(), { id: 'u1' }, 'https://evil.example.com/x.webm');
  assert.equal(r.ok, false);
  assert.match(r.reason, /not a Covenda media URL/);
});

test('a student can always watch their own recording', async () => {
  const r = await mayView(db({ member_videos: [{ id: 'v1' }] }), { id: 'u1' }, PRIVATE);
  assert.equal(r.ok, true);
  assert.equal(r.as, 'owner');
});

// The company sees it because this student sent it to them, not because it exists.
test('a company can watch only what was sent to its own project', async () => {
  const app = { id: 'a1', project_id: 'p1', student_user_id: 'stu', video_url: PRIVATE };

  const theirs = db({ project_applications: [app], member_projects: [{ owner_user_id: 'co1' }] });
  assert.equal((await mayView(theirs, { id: 'co1' }, PRIVATE)).as, 'recipient');

  const someoneElses = db({ project_applications: [app], member_projects: [{ owner_user_id: 'co2' }] });
  const refused = await mayView(someoneElses, { id: 'co1' }, PRIVATE);
  assert.equal(refused.ok, false, 'a company that did not receive it cannot watch it');
});

test('an unrelated signed-in member is refused', async () => {
  const r = await mayView(db(), { id: 'random' }, PRIVATE);
  assert.equal(r.ok, false);
  assert.match(r.reason, /not shared with you/);
});

test('an operator can review batch material', async () => {
  const r = await mayView(db(), { id: 'op', email: 'Ops@Covenda.app' }, PRIVATE, { COVENDA_ADMIN_EMAILS: 'ops@covenda.app' });
  assert.equal(r.as, 'operator');
});

test('a batch applicant can replay their own submitted materials', async () => {
  const rows = [{ materials: { videoUrl: PRIVATE, workSampleFiles: [{ url: 'https://str1.private.blob.vercel-storage.com/s/1.pdf' }] } }];
  assert.equal((await mayView(db({ batch_applications: rows }), { id: 'stu' }, PRIVATE)).as, 'owner');
});

test('query strings never let a URL slip past the row check', () => {
  assert.deepEqual(
    materialUrls({ videoUrl: `${PRIVATE}?download=1` }),
    [PRIVATE],
    'a signed URL pasted back in still resolves to the stored blob',
  );
});

// A signed URL that outlives its session is a public URL with extra steps.
test('signing is short-lived, read-only, and the failure is named rather than swallowed', () => {
  assert.equal(TTL_SECONDS, 900);
  const src = readFileSync(new URL('../../api/media.js', import.meta.url), 'utf8');
  assert.match(src, /operations: \['get', 'head'\]/, 'the delegation cannot write or delete');
  assert.match(src, /pathname: parsed\.pathname/, 'the delegation is scoped to one blob');
  assert.match(src, /'Cache-Control', 'no-store'/, 'a per-caller URL must not be cached at the edge');
  // Recorded rather than swallowed. It now goes to error_events via recordError, which is
  // queryable, instead of a console line that dies in the platform logs.
  assert.match(src, /recordError\('media', 'error'/);
});
