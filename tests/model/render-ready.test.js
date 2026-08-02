// The repo has to be runnable by a host that was told nothing about it. These pin the
// contract render.yaml depends on, so a future edit cannot quietly break the migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const server = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
const render = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');

test('npm start exists — it is the first thing every host looks for', () => {
  assert.equal(pkg.scripts.start, 'node server.js');
});

test('a node version is pinned, so a host does not pick one that cannot parse the code', () => {
  assert.ok(pkg.engines?.node, 'engines.node must be set');
});

test('the port comes from the environment — hosts assign it, they do not ask', () => {
  assert.match(server, /process\.env\.PORT/);
});

test('the health check does not touch the database', () => {
  const line = server.split('\n').find(l => l.includes("'/healthz'"));
  assert.ok(line, '/healthz must exist');
  assert.equal(/supabase|postgres|select/i.test(line), false,
    'a health check that fails on a Supabase blip would restart a healthy server');
});

test('in-flight requests finish before exit, so a deploy does not cut off an upload', () => {
  assert.match(server, /SIGTERM/);
  assert.match(server, /server\.close/);
});

test('render.yaml runs the same entry point as every other host', () => {
  assert.match(render, /startCommand:\s*npm start/);
  assert.match(render, /healthCheckPath:\s*\/healthz/);
});

test('every secret in render.yaml is sync:false — none are committed', () => {
  const secrets = ['SUPABASE_SERVICE_ROLE_KEY', 'POSTGRES_PASSWORD', 'STRIPE_SECRET_KEY',
    'RESEND_API_KEY', 'ANTHROPIC_API_KEY', 'SUPABASE_JWT_SECRET'];
  for (const key of secrets) {
    const line = render.split('\n').find(l => l.includes(key) && !l.trim().startsWith('#'));
    assert.ok(line, `${key} must be declared`);
    assert.match(line, /sync:\s*false/, `${key} must never carry a value in the repo`);
  }
});

test('no secret value is hardcoded anywhere in render.yaml', () => {
  // Real credentials have recognisable shapes. None may appear here.
  for (const pattern of [/eyJ[A-Za-z0-9_-]{20,}/, /sk_live_[A-Za-z0-9]+/, /re_[A-Za-z0-9]{20,}/,
    /postgres:\/\/[^\s]*:[^\s]*@/]) {
    assert.equal(pattern.test(render), false, `render.yaml must not contain ${pattern}`);
  }
});

test('the last vendor import is still gone', () => {
  const storage = readFileSync(new URL('../../api/storage.js', import.meta.url), 'utf8');
  const code = storage.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.equal(/from '@vercel\/blob'/.test(code), false);
});
