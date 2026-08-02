import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = path => readFileSync(join(ROOT, path), 'utf8');

test('the Cloudflare build publishes only the reviewed browser allowlist', () => {
  execFileSync(process.execPath, ['scripts/build-static.mjs'], { cwd: ROOT });
  for (const publicFile of ['index.html', 'portal.js', 'assets/covenda-mark.svg', '_headers', '_routes.json']) {
    assert.ok(existsSync(join(ROOT, 'dist', publicFile)), `${publicFile} should be in the static build`);
  }
  for (const privateFile of ['package.json', 'server.js', 'api/portal.js', 'data/vertical-specializations.csv', 'supabase/config.toml']) {
    assert.ok(!existsSync(join(ROOT, 'dist', privateFile)), `${privateFile} must never be in the static build`);
  }
});

test('only API requests invoke the Cloudflare Pages Function', () => {
  const routes = JSON.parse(read('deploy/cloudflare/_routes.json'));
  assert.deepEqual(routes.include, ['/api/*']);
  assert.deepEqual(routes.exclude, []);
  const proxy = read('functions/api/[[path]].ts');
  assert.match(proxy, /COVENDA_API_ORIGIN/);
  assert.match(proxy, /x-forwarded-host/);
  assert.doesNotMatch(proxy, /SUPABASE_(SECRET|SERVICE_ROLE)/, 'the edge proxy has no database secret');
});

test('the free API blueprint is explicit and cannot auto-cut over', () => {
  const blueprint = read('render.yaml');
  assert.match(blueprint, /plan: free/);
  assert.match(blueprint, /startCommand: npm run serve/);
  assert.match(blueprint, /healthCheckPath: \/healthz/);
  assert.match(blueprint, /autoDeployTrigger: off/);
  assert.doesNotMatch(blueprint, /SUPABASE_SECRET_KEY\s*\n\s*value:/, 'server secrets are prompted, never committed');
});

test('replacement cron jobs are disabled until the operator explicitly enables them', () => {
  const workflow = read('.github/workflows/covenda-cron.yml');
  assert.match(workflow, /COVENDA_CRON_ENABLED == 'true'/);
  assert.match(workflow, /Authorization: Bearer \$CRON_SECRET/);
  assert.match(workflow, /COVENDA_CRON_SECRET/);
  assert.doesNotMatch(workflow, /x-vercel-cron/);
});

test('Vercel analytics is not requested by the host-neutral static pages', () => {
  assert.doesNotMatch(read('index.html'), /_vercel\/insights/);
  assert.doesNotMatch(read('cohort.html'), /_vercel\/insights/);
});

test('storage setup uses the supported API and is dry-run by default', () => {
  const setup = read('scripts/setup-storage.mjs');
  assert.match(setup, /storage\.createBucket/);
  assert.match(setup, /storage\.updateBucket/);
  assert.match(setup, /process\.argv\.includes\('--apply'\)/);
  assert.doesNotMatch(setup, /insert\s+into\s+storage\.buckets/i);
});
