import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

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

// ── Render ─────────────────────────────────────────────────────────────────────────────
// The systemd units above describe the same deployment for a box we rent. render.yaml
// describes it for a host we don't. Both are checked against vercel.json rather than against
// each other, so adding a cron to one and forgetting the other fails here instead of in
// production, where a skipped job is silent by nature.
const render = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');

test('every vercel.json cron has a Render job on the same schedule', () => {
  for (const cron of vercelJson.crons) {
    const name = cron.path.split('/').pop();
    assert.match(render, new RegExp(`name: covenda-${name}\\b`), `${cron.path} has a Render job`);
    assert.ok(render.includes(`schedule: "${cron.schedule}"`), `${cron.path} keeps its schedule`);
    assert.ok(render.includes(`/api/${name}"`), 'it calls the same endpoint the platform called');
  }
  // Three jobs and no more: a stray cron would double-run a batch.
  assert.equal(render.match(/^ {2}- type: cron$/gm).length, vercelJson.crons.length);
});

test('the Render crons authenticate, and hold only the secret they need', () => {
  const jobs = render.split(/^ {2}- type: cron$/m).slice(1);
  assert.equal(jobs.length, vercelJson.crons.length);
  for (const job of jobs) {
    assert.match(job, /Authorization: Bearer \$CRON_SECRET/, 'the job authenticates');
    // The header contains a colon-space, which YAML reads as a mapping unless the whole command
    // is quoted. Unquoted, the file does not parse and the deploy fails at the host rather than
    // here — which is a slow way to learn about a punctuation error.
    assert.match(job, /startCommand: '.*'$/m, 'the command is quoted');
    assert.match(job, /key: CRON_SECRET/, 'and is given the secret to authenticate with');
    // A job that only calls an HTTP endpoint has no business holding the payment keys.
    assert.doesNotMatch(job, /STRIPE_|ANTHROPIC_|SUPABASE_SERVICE_ROLE/,
      'a cron holds the one secret it needs, not the whole set');
  }
});

// The sketch this replaced ran `node -e "import('./api/roles-cron.js').then(m => m.default())"`.
// A handler's signature is (req, res); called with neither it reads req.headers off undefined
// and dies before doing any work, every night, reporting only a crash.
test('a cron invokes the endpoint, not the handler with no request', () => {
  assert.doesNotMatch(render, /import\(['"]\.\/api\/.*\)\.then\(m => m\.default\(\)\)/,
    'a handler is never called without a req and res');
});

test('the web service starts the shim and is health-checked without the database', () => {
  // Either spelling is fine; what matters is that it is the one long-lived process.
  assert.match(render, /startCommand: (npm start|node server\.js)/);
  assert.equal(pkg.scripts.start, 'node server.js', 'and `npm start` resolves to the shim');
  assert.match(render, /healthCheckPath: \/healthz/);
  assert.match(render, /buildCommand: npm ci/, 'the lockfile is the build input, not npm install');
});

test('render.yaml declares secrets without containing one', () => {
  // Every secret is prompted for and stored by the host. A value here would be a value in the
  // git history, which no rotation afterwards can undo.
  const secretish = /\{ key: ((?:SUPABASE|RESEND|STRIPE|ANTHROPIC|BLOB|POSTGRES|GITHUB|CRON|CONNECTOR)_[A-Z0-9_]*), ([^}]*)\}/g;
  const found = [...render.matchAll(secretish)];
  assert.ok(found.length > 15, 'the file enumerates the secrets rather than a token few');
  for (const [, key, rest] of found) {
    // SUPABASE_STORAGE_BUCKET is a bucket name, not a credential, and is supposed to carry one.
    if (key === 'SUPABASE_STORAGE_BUCKET') continue;
    assert.match(rest, /sync: false/, `${key} is asked for, never committed`);
  }
});
