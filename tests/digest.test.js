import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDigest, partnerDigestEmail, sendPartnerDigests } from '../api/digest.js';
import { summarizeCohort } from '../api/cohort.js';

const now = new Date('2026-07-15T00:00:00Z');

function sampleDigest({ endorsed = 0, applied = 0, verified = 0, orgName = 'Princeton Quant Club' } = {}) {
  const cohort = summarizeCohort({
    code: 'REF-ABC123',
    endorsementSubs: [{ details: { contact: { company: orgName }, endorsements: Array.from({ length: endorsed }, (_, i) => ({ email: `s${i}@x.edu`, function: 'Accounting & finance' })) } }],
    codedApplications: Array.from({ length: applied }, (_, i) => ({ student_user_id: `u${i}` })),
    completedStudentIds: new Set(Array.from({ length: verified }, (_, i) => `u${i}`)),
  });
  return buildDigest({ code: 'REF-ABC123', cohort, contactEmail: 'prof@x.edu', newThisPeriod: { endorsed: 2, applied: 1, verified: 1 }, now });
}

test('buildDigest carries the period + cohort funnel', () => {
  const d = sampleDigest({ endorsed: 5, applied: 3, verified: 1 });
  assert.equal(d.period, '2026-07');
  assert.equal(d.periodLabel, 'July 2026');
  assert.equal(d.cohort.endorsedCount, 5);
  assert.equal(d.orgName, 'Princeton Quant Club');
  assert.deepEqual(d.newThisPeriod, { endorsed: 2, applied: 1, verified: 1 });
});

test('partnerDigestEmail builds a subject + funnel and leaks no student PII', () => {
  const d = sampleDigest({ endorsed: 5, applied: 3, verified: 1 });
  const email = partnerDigestEmail(d, { to: 'prof@x.edu', from: 'hello@covenda.app', cohortUrl: 'https://covenda.app/cohort.html?ref=REF-ABC123' });
  assert.match(email.subject, /Princeton Quant Club/);
  assert.match(email.subject, /July 2026/);
  assert.deepEqual(email.to, ['prof@x.edu']);
  assert.match(email.html, /View your live cohort page/);
  assert.match(email.text, /Employer-Verified: 1/);
  // Student emails from the roster must never appear in the partner email.
  assert.ok(!/s\d@x\.edu/.test(email.html), 'no student emails in html');
  assert.ok(!/s\d@x\.edu/.test(email.text), 'no student emails in text');
});

test('partnerDigestEmail has an honest empty-movement line', () => {
  const cohort = summarizeCohort({ code: 'REF-ABC123', endorsementSubs: [{ details: { contact: { company: 'Yale FinClub' }, endorsements: [{ email: 'a@y.edu' }] } }] });
  const d = buildDigest({ code: 'REF-ABC123', cohort, contactEmail: 'p@y.edu', newThisPeriod: {}, now });
  const email = partnerDigestEmail(d, { to: 'p@y.edu', from: 'hello@covenda.app' });
  assert.match(email.text, /No new movement this month/);
});

test('sendPartnerDigests dry-run builds without sending and reports config state', async () => {
  const supabase = fakeSupabase();
  let sendCalls = 0;
  const createResendClient = () => ({ emails: { send: async () => { sendCalls += 1; return { error: null }; } } });
  const out = await sendPartnerDigests(supabase, { env: {}, createResendClient, send: false, now });
  assert.equal(sendCalls, 0, 'dry-run never sends');
  assert.equal(out.sent, 0);
  assert.equal(out.results[0].reason, 'dry-run');
  assert.equal(out.configured, false);
});

test('sendPartnerDigests refuses to send when Resend is not configured', async () => {
  const supabase = fakeSupabase();
  let sendCalls = 0;
  const createResendClient = () => ({ emails: { send: async () => { sendCalls += 1; return { error: null }; } } });
  const out = await sendPartnerDigests(supabase, { env: { COVENDA_DIGEST_ENABLED: 'true' }, createResendClient, send: true, now });
  assert.equal(sendCalls, 0, 'no API key/from → no send');
  assert.equal(out.results[0].reason, 'not-configured');
});

test('sendPartnerDigests sends per partner with an idempotency key when fully configured', async () => {
  const supabase = fakeSupabase();
  const keys = [];
  const createResendClient = () => ({ emails: { send: async (_payload, opts) => { keys.push(opts.idempotencyKey); return { error: null }; } } });
  const env = { COVENDA_DIGEST_ENABLED: 'true', RESEND_API_KEY: 'k', COVENDA_NOTIFICATION_FROM: 'hello@covenda.app' };
  const out = await sendPartnerDigests(supabase, { env, createResendClient, send: true, now });
  assert.equal(out.sent, 1);
  assert.equal(out.results[0].sent, true);
  assert.match(keys[0], /covenda-digest-ref-abc123-2026-07/);
});

// Minimal queued Supabase double: submissions → applications → member_projects, in the order
// buildPartnerDigests queries them.
function fakeSupabase() {
  const tables = {
    submissions: [{ details: { attributionCode: 'REF-ABC123', contact: { company: 'Princeton Quant Club', email: 'prof@x.edu' }, endorsements: [{ email: 'a@x.edu', function: 'Accounting & finance' }] }, created_at: '2026-07-10T00:00:00Z' }],
    project_applications: [{ student_user_id: 'u0', project_id: 'p1', referral: { code: 'REF-ABC123' }, created_at: '2026-07-12T00:00:00Z' }],
    member_projects: [{ assigned_student_user_id: 'u0', status: 'complete', completed_at: '2026-07-13T00:00:00Z' }],
  };
  function builder(rows) {
    const b = {
      _rows: rows,
      select() { return b; },
      eq() { return b; },
      in() { return b; },
      limit() { return Promise.resolve({ data: b._rows, error: null }); },
      then(resolve) { return resolve({ data: b._rows, error: null }); },
    };
    return b;
  }
  return { from(table) { return builder(tables[table] || []); } };
}
