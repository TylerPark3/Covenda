import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { checkCode, MAX_ATTEMPTS } from '../../api/verification.js';

const mig = readFileSync(
  new URL('../../supabase/migrations/20260801300000_security_definer_and_attempt_cap.sql', import.meta.url), 'utf8');
const apiPortal = readFileSync(new URL('../../api/portal.js', import.meta.url), 'utf8');
const portal = readFileSync(new URL('../../portal.js', import.meta.url), 'utf8');

// ── 1. bump_rate_limit was callable by anyone ──────────────────────────────────────────
// SECURITY DEFINER with no REVOKE, while every other definer function in the repo revokes.
// The subject is caller-supplied, so an unauthenticated caller could inflate the counter for
// someone else's subject and lock that person out of their own sign-in.

test('every SECURITY DEFINER function is revoked from browser roles', () => {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.sql'));
  const revokes = files.map(f => readFileSync(new URL(f, dir), 'utf8')).join('\n');

  const definers = [];
  for (const f of files) {
    const sql = readFileSync(new URL(f, dir), 'utf8');
    for (const m of sql.matchAll(/create or replace function\s+(public\.[a-z_]+)\s*\(([^)]*)\)/gi)) {
      const after = sql.slice(m.index, m.index + 600);
      if (/security definer/i.test(after)) definers.push(m[1]);
    }
  }
  assert.ok(definers.length >= 3, 'the repo has definer functions to check');
  for (const fn of new Set(definers)) {
    assert.match(revokes, new RegExp(`revoke all on function ${fn.replace('.', '\\.')}`, 'i'),
      `${fn} runs with owner privileges and must be revoked from public/anon/authenticated`);
  }
});

test('the rate limit table itself is not browser-readable', () => {
  assert.match(mig, /revoke all on table public\.rate_limits from public, anon, authenticated/);
});

// ── 2. The company attempt cap never fired ─────────────────────────────────────────────
// checkCode gates on Number(record.attempts) >= MAX_ATTEMPTS. company_email_codes had no
// attempts column and nothing wrote one, so the expression was NaN >= 5 — false, always.

test('the cap is unreachable when attempts is absent, which is why the column had to exist', () => {
  const noColumn = { created_at: new Date().toISOString() };            // what the row used to look like
  const verdict = checkCode(noColumn, '000000', new Date());
  assert.notEqual(verdict.locked, true,
    'this is the bug: with no attempts field the lockout branch cannot be reached');

  // With the column present and at the cap, it locks.
  const atCap = { attempts: MAX_ATTEMPTS, created_at: new Date().toISOString() };
  assert.equal(checkCode(atCap, '000000', new Date()).locked, true);
});

test('the column exists now, with a sane bound', () => {
  assert.match(mig, /alter table public\.company_email_codes\s*\n\s*add column if not exists attempts integer not null default 0/);
  assert.match(mig, /attempts >= 0 and attempts <= 100/);
});

test('a failed company code is actually counted', () => {
  const fn = apiPortal.slice(apiPortal.indexOf('export async function confirmCompanyVerification'),
                             apiPortal.indexOf('work_email_domain'));
  assert.match(fn, /attempts: Number\(record\.attempts \|\| 0\) \+ 1/,
    'the failure increments, or the cap can never be reached');
  // An expired code is not a guess, so it must not burn an attempt.
  assert.match(fn, /if \(record && !verdict\.expired\)/);
  // Counting must never turn a wrong code into a 500, nor reveal which failure occurred.
  assert.match(fn, /\.then\(\(\) => \{\}, \(\) => \{\}\)/);
});

// The student path has always done this. The fix mirrors it rather than inventing a second
// scheme — the mistake this branch already made twice.
test('both verification paths count failures the same way', () => {
  const hits = apiPortal.match(/attempts: Number\(record\.attempts \|\| 0\) \+ 1/g) || [];
  assert.equal(hits.length, 2, 'school_email_codes and company_email_codes, one each');
});

// ── 3. The crash class, closed on the field that caused it ─────────────────────────────
// verification.signals is the same shape of field as t.unprompted, which killed the whole
// portal render. studentJourney was hardened for it on this branch; three other readers were
// missed and are live today.

test('every read of verification.signals is shape-guarded', () => {
  const code = portal.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /\bv\.signals\.forEach/, 'no bare forEach on a possibly-non-array');
  assert.doesNotMatch(code, /\(v\.signals\s*\|\|\s*\[\]\)/, 'truthiness is not a shape test');
  assert.doesNotMatch(code, /verification\?\.signals\?\.find/, 'optional chaining is not a shape test either');
  assert.ok((portal.match(/asList\((v\.signals|state\.dashboard\?\.verification\?\.signals)\)/g) || []).length >= 4,
    'all four readers go through asList');
});
