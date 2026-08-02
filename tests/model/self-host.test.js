import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { isPublicAssetPath, PUBLIC_ROOT_FILES } from '../../deploy/public-assets.js';

const server = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const apiDir = new URL('../../api/', import.meta.url);
const deployDir = new URL('../../deploy/', import.meta.url);
const vercelJson = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));

// Hosting cost $40/month, $20 of which bought a seat rather than compute. This makes the host
// replaceable. Nothing in api/ changed to allow it.

test('every handler is reachable through the shim', () => {
  const handlerFiles = readdirSync(apiDir)
    .filter(f => f.endsWith('.js'))
    .filter(f => /^export default (async )?function handler/m.test(readFileSync(new URL(f, apiDir), 'utf8')));
  assert.ok(handlerFiles.length >= 25, `found ${handlerFiles.length} handlers`);
  // The shim routes by filename, so the only way to miss one is to not have the file.
  assert.match(server, /app\.all\('\/api\/:name'/);
  assert.match(server, /handlers\.get\(req\.params\.name\)/);
  // Library modules must not become routes.
  assert.match(server, /if \(typeof mod\.default !== 'function'\) continue;/);
});

// Six handlers verify a Stripe signature or read an upload over the exact bytes. Parsing their
// body would corrupt both. The flag is read from the handler itself, so the list cannot drift.
test('raw-body handlers are detected from the handler, not a hardcoded list', () => {
  assert.match(server, /mod\.config\?\.api\?\.bodyParser === false/);
  assert.match(server, /if \(rawBody\.has\(req\.params\.name\)\) return next\(\)/);
  const declared = readdirSync(apiDir).filter(f => f.endsWith('.js'))
    .filter(f => /bodyParser: false/.test(readFileSync(new URL(f, apiDir), 'utf8')));
  assert.equal(declared.length, 6, 'six handlers need the raw body');
  assert.doesNotMatch(server, /'stripe-webhook'|'file-upload'/, 'no hardcoded route names');
});

// The platform imported functions lazily, so a broken import surfaced as a 500 on the first
// request that touched it — possibly days later, possibly to a customer.
test('a broken import stops the process at boot, not at first request', () => {
  assert.match(server, /const mod = await import\(`\.\/api\/\$\{file\}`\)/,
    'imports happen during startup, at the top level');
  assert.doesNotMatch(server, /await import\(`\.\/api\/\$\{req\./, 'never lazily per request');
});

test('a throwing handler returns 500 rather than killing the process', () => {
  assert.match(server, /catch \(error\)/);
  assert.match(server, /if \(!res\.headersSent\) res\.status\(500\)/,
    'and never double-sends when the handler already replied');
});

test('in-flight requests drain on shutdown', () => {
  assert.match(server, /server\.close\(\(\) => process\.exit\(0\)\)/);
  assert.match(server, /for \(const signal of \['SIGTERM', 'SIGINT'\]\)/);
});

// Rate limiting keys on the caller. Behind a proxy without trust proxy, every request looks
// like it came from localhost and the limiter protects nothing.
test('the real client address survives the proxy', () => {
  assert.match(server, /app\.set\('trust proxy', 1\)/);
  const caddy = readFileSync(new URL('Caddyfile', deployDir), 'utf8');
  assert.match(caddy, /header_up X-Real-IP \{remote_host\}/);
});

test('the server publishes an allowlist, never the repository root', () => {
  assert.match(server, /isPublicAssetPath\(req\.path\)/);
  assert.doesNotMatch(server, /app\.use\(express\.static\(root/,
    'an unguarded repository root exposes source, migrations and operational files');
  for (const path of ['/', '/index.html', '/portal', '/portal.js', '/assets/covenda-mark.svg']) {
    assert.equal(isPublicAssetPath(path), true, `${path} remains public`);
  }
  for (const path of [
    '/package.json',
    '/server.js',
    '/vercel.json',
    '/data/calibration_dataset.csv',
    '/supabase/migrations/20260721051450_create_submission_inbox.sql',
    '/api/portal.js',
    '/deploy/README.md',
    '/docs/COVENDA_MVP_SPEC.md',
    '/tests/model/self-host.test.js',
    '/assets/../package.json',
    '/assets/%2e%2e/package.json',
  ]) {
    assert.equal(isPublicAssetPath(path), false, `${path} must not be public`);
  }
  assert.ok(PUBLIC_ROOT_FILES.length >= 20, 'the actual browser entrypoints are explicit');
});

// ── The crons ──────────────────────────────────────────────────────────────────────────
test('every vercel.json cron has a systemd timer', () => {
  const units = readdirSync(deployDir);
  for (const cron of vercelJson.crons) {
    const name = cron.path.split('/').pop();
    assert.ok(units.includes(`covenda-${name}.timer`), `${cron.path} has a timer`);
    assert.ok(units.includes(`covenda-${name}.service`), `${cron.path} has a service`);
    const svc = readFileSync(new URL(`covenda-${name}.service`, deployDir), 'utf8');
    assert.ok(svc.includes(cron.path), 'it calls the same endpoint the platform called');
    assert.match(svc, /Authorization: Bearer \$\{CRON_SECRET\}/, 'and authenticates');
  }
});

test('a missed cron run is not silently skipped', () => {
  for (const cron of vercelJson.crons) {
    const timer = readFileSync(new URL(`covenda-${cron.path.split('/').pop()}.timer`, deployDir), 'utf8');
    assert.match(timer, /Persistent=true/, 'a run missed during a reboot fires on next boot');
    assert.match(timer, /OnCalendar=/);
  }
});

// ── Secrets ────────────────────────────────────────────────────────────────────────────
test('no unit file contains a secret', () => {
  for (const f of readdirSync(deployDir).filter(f => f.endsWith('.service'))) {
    const src = readFileSync(new URL(f, deployDir), 'utf8');
    assert.match(src, /EnvironmentFile=\/etc\/covenda\/env/, `${f} reads secrets from outside the repo`);
    assert.doesNotMatch(src, /(SUPABASE|RESEND|STRIPE)_[A-Z_]*=\S/, `${f} must not inline a value`);
  }
});

test('the host is replaceable: no vendor package remains', () => {
  assert.ok(!Object.keys(pkg.dependencies).some(d => d.startsWith('@vercel/')));
  assert.ok(pkg.dependencies.express, 'the shim needs express');
});
