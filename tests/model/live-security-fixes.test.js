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

// ── 4. A club record could be taken over by anyone ─────────────────────────────────────
// registerClub derives a slug from name + school, looks for an existing club with that slug,
// and updated the whole row for any caller — created_by included. So anyone signed in could
// re-register a club by name and school and own the record.
//
// A club confirmation is a verification signal: studentJourney reads held('club') as evidence
// that somebody stands behind a student. Owning the record is the power to vouch, so a silent
// takeover is a silent transfer of that power.
test('a club cannot be taken over by re-registering its name', () => {
  const fn = apiPortal.slice(apiPortal.indexOf('export async function registerClub'),
                             apiPortal.indexOf('// ── Club officer confirmation'));
  assert.match(fn, /existing && existing\.created_by && existing\.created_by !== member\.user\.id/,
    'a different caller is refused, not silently allowed to overwrite');
  assert.match(fn, /throw new Error\('This club is already registered\./,
    'and told why, rather than getting a silent no-op');
  assert.match(fn, /\.select\('id, created_by'\)/, 'ownership is actually read');
});

test('club ownership is never rewritten by an update', () => {
  const fn = apiPortal.slice(apiPortal.indexOf('export async function registerClub'),
                             apiPortal.indexOf('// ── Club officer confirmation'));
  assert.match(fn, /row\.created_by = existing\.created_by \|\| member\.user\.id/,
    'the original registrant survives the update');
  // The insert path still stamps the creator.
  assert.match(fn, /created_by: member\.user\.id/);
});

// club_confirmed feeds verification, which is why the above matters.
test('club confirmation really is a verification signal', () => {
  assert.match(portal, /held\('club'\)/,
    'studentJourney reads it as evidence, so the record bears on who can vouch');
});

// ── 5. A live code should not be readable from a lock screen ───────────────────────────
test('verification codes are never in the email subject', () => {
  assert.doesNotMatch(apiPortal, /subject: `[^`]*\$\{code\}/,
    'subjects render in lock-screen and inbox previews, readable without unlocking the phone');
  assert.equal((apiPortal.match(/subject: 'Your Covenda verification code'/g) || []).length, 2,
    'both the student and company paths are fixed');
  // The code still has to reach the person.
  assert.match(apiPortal, /\$\{code\}/, 'it is still in the body');
});

// ── 6. Provider errors are not ours to store raw ───────────────────────────────────────
// Bounce text routinely echoes the recipient back ("550 5.1.1 <x@y.com> does not exist").
// Everything else in this codebase runs detail through safeDetail; this path inserted raw.
test('delivery failures are redacted like every other error path', () => {
  const notify = readFileSync(new URL('../../api/notify.js', import.meta.url), 'utf8');
  assert.match(notify, /import \{ safeDetail \} from '\.\/limits\.js'/);
  assert.match(notify, /detail: safeDetail\(\{ event, reason:/);
  assert.match(notify, /message: `\$\{event\} not delivered`/,
    'the message no longer interpolates provider text either');
});
