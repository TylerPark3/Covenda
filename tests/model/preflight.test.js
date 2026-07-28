import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;

// Run the preflight against a throwaway copy of the repo, so a developer's real .env.local is
// never read and never touched by the test suite.
function runPreflight(envContents, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'covenda-preflight-'));
  cpSync(join(ROOT, 'scripts', 'preflight.mjs'), join(dir, 'preflight.mjs'));
  if (envContents !== null) writeFileSync(join(dir, '.env.local'), envContents);
  try {
    const stdout = execFileSync(process.execPath, ['preflight.mjs', ...args], { cwd: dir, encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stdout: error.stdout || '' };
  }
}

const GOOD = 'SUPABASE_URL="https://ref.supabase.co"\nSUPABASE_SECRET_KEY="sb_secret_long_enough_value"\n';

test('real credentials let the server start', () => {
  const { code, stdout } = runPreflight(GOOD);
  assert.equal(code, 0);
  assert.match(stdout, /Database credentials found/);
});

// The failure this exists to catch: `vercel env pull` writes the literal string [SENSITIVE]
// for variables it is not allowed to read, which passes any truthiness check and then fails
// several layers away at the first query.
test('a [SENSITIVE] placeholder is treated as missing, not as a value', () => {
  const { code, stdout } = runPreflight('SUPABASE_URL="[SENSITIVE]"\nSUPABASE_SECRET_KEY="[SENSITIVE]"\n');
  assert.equal(code, 1);
  assert.match(stdout, /no database/i);
  assert.match(stdout, /cannot be\s+read back/);
});

test('other placeholder shapes are caught too', () => {
  for (const value of ['your-project-url', 'PASTE_HERE', 'TODO', 'changeme']) {
    assert.equal(runPreflight(`SUPABASE_URL="${value}"\nSUPABASE_SECRET_KEY="${value}"\n`).code, 1, `${value} passed`);
  }
});

test('a missing .env.local fails with the same instructions rather than a crash', () => {
  const { code, stdout } = runPreflight(null);
  assert.equal(code, 1);
  assert.match(stdout, /Project Settings -> API/);
});

// The service-role key is named two different ways across this codebase.
test('either accepted name for the service key satisfies the check', () => {
  const alt = 'SUPABASE_URL="https://ref.supabase.co"\nSUPABASE_SERVICE_ROLE_KEY="sb_secret_long_enough_value"\n';
  assert.equal(runPreflight(alt).code, 0);
});

test('--force starts anyway, for working on pages that need no database', () => {
  assert.equal(runPreflight('', ['--force']).code, 0);
});

// Naming what is missing beats a generic failure: each optional variable breaks one feature.
test('optional variables are reported as degraded, not as failure', () => {
  const { code, stdout } = runPreflight(GOOD);
  assert.equal(code, 0);
  assert.match(stdout, /BLOB_READ_WRITE_TOKEN — video/);
  assert.match(stdout, /RESEND_API_KEY — sign-in/);
});

test('the instructions the preflight prints match the documented ones', () => {
  assert.ok(existsSync(join(ROOT, 'RUNNING_LOCALLY.md')));
});
