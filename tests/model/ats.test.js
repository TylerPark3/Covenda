import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareExport, checkConsent, redact, buildPayload, atsMode, PROVIDERS } from '../../api/ats.js';

const STUDENT = { display_name: 'Ada Lovelace', email: 'ada@uni.edu', links: ['https://github.com/ada'] };
const CONSENT = { student_user_id: 's1', company_user_id: 'c1' };
const FIT = { score: 87, band: { low: 79, high: 95 }, reasons: ['Shipped a similar pipeline'], concerns: ['No prior finance work'] };

// Pushing to an external ATS is the one consent decision Covenda cannot reverse.
test('nothing exports without explicit consent', () => {
  const r = prepareExport({ provider: 'greenhouse', student: STUDENT, consent: null, companyUserId: 'c1' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /has not agreed/);
});

test('consent for one company is not consent for another', () => {
  const r = checkConsent(CONSENT, { companyUserId: 'c2' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /does not carry across/);
});

test('withdrawn and expired consent both block the push', () => {
  assert.equal(checkConsent({ ...CONSENT, revoked_at: 'x' }, { companyUserId: 'c1' }).ok, false);
  const expired = checkConsent(
    { ...CONSENT, expires_at: '2020-01-01T00:00:00Z' },
    { companyUserId: 'c1', now: '2026-01-01T00:00:00Z' },
  );
  assert.equal(expired.ok, false);
  assert.match(expired.reason, /expired/);
});

// The scorer refuses to train on these. Exporting them would make that guarantee true only
// inside our own walls.
test('protected attributes never leave, whatever the caller passes', () => {
  const { profile, dropped } = redact({ ...STUDENT, school_name: 'MIT', gpa: 3.9, gender: 'f', avatar_url: 'x' });
  assert.equal(profile.school_name, undefined);
  assert.equal(profile.gpa, undefined);
  assert.equal(profile.gender, undefined);
  assert.ok(dropped.includes('school_name'));
  assert.equal(profile.display_name, 'Ada Lovelace', 'the useful fields survive');
});

test('a clean push carries the evidence an ATS cannot work out for itself', () => {
  const r = prepareExport({ provider: 'greenhouse', student: STUDENT, consent: CONSENT, companyUserId: 'c1', fit: FIT });
  assert.equal(r.ok, true);
  assert.match(r.summary, /Compatibility 87%/);
  assert.match(r.summary, /Shipped a similar pipeline/);
  assert.match(r.summary, /Watch: No prior finance work/);
});

// The honesty has to survive the boundary — a recruiter reading this in Greenhouse should
// know what the number is and is not.
test('the exported summary says the score is per opportunity, not a candidate rating', () => {
  const r = prepareExport({ provider: 'greenhouse', student: STUDENT, consent: CONSENT, companyUserId: 'c1', fit: FIT });
  assert.match(r.summary, /never as a global candidate rating/);
});

test('each provider gets the shape it expects, with the same content', () => {
  for (const provider of Object.keys(PROVIDERS)) {
    const r = prepareExport({ provider, student: STUDENT, consent: CONSENT, companyUserId: 'c1', fit: FIT });
    assert.equal(r.ok, true, provider);
    assert.equal(r.endpoint, PROVIDERS[provider].endpoint);
    assert.ok(JSON.stringify(r.payload).includes('Ada'), provider);
  }
});

test('an unknown provider is refused rather than half-attempted', () => {
  const r = prepareExport({ provider: 'workday', student: STUDENT, consent: CONSENT, companyUserId: 'c1' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /does not push to workday yet/);
});

test('a student with no email is refused, since the ATS record could never be matched', () => {
  const r = prepareExport({ provider: 'greenhouse', student: { display_name: 'A' }, consent: CONSENT, companyUserId: 'c1' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /cannot be matched/);
});

test('an unconnected ATS says so instead of offering a button that cannot work', () => {
  assert.equal(atsMode(null).connected, false);
  assert.match(atsMode(null).note, /Covenda keeps them here/);
  assert.equal(atsMode({ provider: 'ashby', api_key_set: true }).connected, true);
});

test('a name with one word still produces a usable record', () => {
  const { payload } = buildPayload({ student: { display_name: 'Prince', email: 'p@x.com' } });
  assert.equal(payload.firstName, 'Prince');
  assert.equal(payload.lastName, '');
});
