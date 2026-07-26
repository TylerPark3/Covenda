import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFICATION_VERSION, CODE_TTL_MINUTES, MAX_ATTEMPTS,
  checkSchoolEmail, isAcademicDomain, looksLikeAlumniOrStaff,
  generateCode, checkCode, verificationStanding, domainOf,
} from '../../api/verification.js';

test('academic domains are matched by suffix, across countries', () => {
  for (const e of ['a@columbia.edu', 'b@ox.ac.uk', 'c@unimelb.edu.au', 'd@nus.edu.sg', 'e@iitb.ac.in', 'f@uct.ac.za']) {
    assert.equal(isAcademicDomain(e), true, `${e} should be academic`);
  }
  for (const e of ['a@gmail.com', 'b@acme.co', 'c@notedu.com', 'd@education.com']) {
    assert.equal(isAcademicDomain(e), false, `${e} should not be academic`);
  }
});

// A suffix list rather than an institution registry: a registry goes stale and quietly
// becomes a gate on WHERE someone studies.
test('a personal address is refused with a reason that says why', () => {
  const r = checkSchoolEmail('someone@gmail.com');
  assert.equal(r.ok, false);
  assert.match(r.reason, /school address/i);
});

test('alumni and staff addresses do not pass as current students', () => {
  assert.equal(looksLikeAlumniOrStaff('x@alumni.columbia.edu'), true);
  assert.equal(looksLikeAlumniOrStaff('x@staff.ox.ac.uk'), true);
  assert.equal(looksLikeAlumniOrStaff('x@columbia.edu'), false);
  assert.equal(checkSchoolEmail('x@alumni.columbia.edu').ok, false);
});

// The most important assertion here: the result carries its own limits.
test('a pass states what it does NOT prove', () => {
  const r = checkSchoolEmail('student@columbia.edu');
  assert.equal(r.ok, true);
  assert.equal(r.domain, 'columbia.edu');
  assert.equal(r.strength, 'floor');
  assert.match(r.doesNotProve, /not prove current enrolment or identity/i);
});

test('school email alone is never "student verified"', () => {
  const emailOnly = verificationStanding({ schoolVerifiedAt: '2026-08-01T00:00:00Z' });
  assert.equal(emailOnly.heldCount, 1);
  assert.equal(emailOnly.isStudentVerified, false, 'the floor must not read as the proof');

  const withClub = verificationStanding({ schoolVerifiedAt: '2026-08-01T00:00:00Z', confirmedClubs: 1 });
  assert.equal(withClub.isStudentVerified, true);
});

test('standing shows every signal, including the ones not held', () => {
  const s = verificationStanding({});
  assert.equal(s.signals.length, 3);
  assert.equal(s.signals.every(x => x.held === false), true);
  assert.match(s.summary, /Not yet verified/);
  // Never collapsed into one number — the three prove different things.
  assert.equal(s.score, undefined);
});

test('codes are six digits and zero-padded', () => {
  assert.match(generateCode(() => 42), /^\d{6}$/);
  assert.equal(generateCode(() => 42), '000042');
  assert.match(generateCode(), /^\d{6}$/);
});

test('a wrong, expired, or over-attempted code is refused', () => {
  const fresh = { code: '123456', attempts: 0, created_at: '2026-08-01T12:00:00Z' };
  assert.equal(checkCode(fresh, '123456', new Date('2026-08-01T12:05:00Z')).ok, true);
  assert.equal(checkCode(fresh, '000000', new Date('2026-08-01T12:05:00Z')).ok, false);
  assert.equal(checkCode(fresh, '12345', new Date('2026-08-01T12:05:00Z')).ok, false);

  const expired = checkCode(fresh, '123456', new Date(Date.parse('2026-08-01T12:00:00Z') + (CODE_TTL_MINUTES + 1) * 60_000));
  assert.equal(expired.ok, false);
  assert.equal(expired.expired, true);

  const locked = checkCode({ ...fresh, attempts: MAX_ATTEMPTS }, '123456', new Date('2026-08-01T12:01:00Z'));
  assert.equal(locked.ok, false);
  assert.equal(locked.locked, true, 'brute force must be stopped even with the right code');
});

test('a missing record is refused rather than throwing', () => {
  assert.equal(checkCode(null, '123456', new Date()).ok, false);
  assert.equal(domainOf('nonsense'), '');
  assert.equal(checkSchoolEmail('').ok, false);
  assert.equal(verificationStanding().version, VERIFICATION_VERSION);
});
